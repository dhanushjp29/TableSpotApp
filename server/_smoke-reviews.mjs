import mongoose from "mongoose";
import * as restaurantReviewService from "./src/services/restaurantReview.service.js";
import * as foodReviewService from "./src/services/foodReview.service.js";

const MONGO_URI = "mongodb://localhost:27017/TableSpot";

const results = [];
const check = (name, cond, extra = "") => {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
};

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;

    const customer = await db.collection("users").findOne({ email: "pwcust1@gmail.com" });
    if (!customer) {
      console.log("SKIP: demo customer pwcust1@gmail.com not found. Run `node seed-demo.cjs` first.");
      return;
    }

    const bookings = await db.collection("bookings").find({ userId: customer._id }).toArray();
    const bills = await db.collection("bills").find({ bookingId: { $in: bookings.map((b) => b._id) } }).toArray();
    if (!bills.length) {
      console.log("SKIP: no bill found for demo customer.");
      return;
    }

    let bill = null;
    let restaurant = null;
    let existingRestReview = null;
    for (const b of bills) {
      const r = await db.collection("restaurants").findOne({ _id: b.restaurantId });
      const existing = await db.collection("restaurantreviews").findOne({
        userId: customer._id,
        restaurantId: b.restaurantId,
        isDeleted: false,
      });
      if (!existing) {
        bill = b;
        restaurant = r;
        existingRestReview = null;
        break;
      }
      if (!bill) {
        bill = b;
        restaurant = r;
        existingRestReview = existing;
      }
    }
    if (!bill) {
      console.log("SKIP: no bill found for demo customer.");
      return;
    }

    const restaurantId = bill.restaurantId;
    const originalBillStatus = bill.billStatus;

    const orderedFoodIds = (bill.orderedItems || []).map((i) => String(i.foodId));
    const otherFood = await db.collection("foods").findOne({
      restaurantId,
      isDeleted: false,
      _id: { $nin: orderedFoodIds.map((id) => new mongoose.Types.ObjectId(id)) },
    });

    const resSnapshot = {
      averageRating: restaurant.averageRating,
      totalReviews: restaurant.totalReviews,
    };
    let orderedFoodId = null;
    for (const id of orderedFoodIds) {
      // Include soft-deleted reviews: the userId_1_foodId_1 index is unique
      // regardless of isDeleted, so re-creating for an already-reviewed food
      // would hit a duplicate-key error.
      const existingFoodReview = await db.collection("foodreviews").findOne({
        userId: customer._id,
        foodId: new mongoose.Types.ObjectId(id),
      });
      if (!existingFoodReview) {
        orderedFoodId = id;
        break;
      }
    }
    const orderedFood = orderedFoodId
      ? await db.collection("foods").findOne({ _id: new mongoose.Types.ObjectId(orderedFoodId) })
      : null;
    const foodSnapshot = orderedFood
      ? {
          averageRating: orderedFood.averageRating,
          totalReviews: orderedFood.totalReviews,
        }
      : null;

    const restore = async () => {
      await db.collection("bills").updateOne({ _id: bill._id }, { $set: { billStatus: originalBillStatus } });
      await db.collection("restaurants").updateOne(
        { _id: restaurantId },
        { $set: { averageRating: resSnapshot.averageRating, totalReviews: resSnapshot.totalReviews } }
      );
      if (orderedFoodId && foodSnapshot) {
        await db.collection("foods").updateOne(
          { _id: orderedFoodId },
          { $set: { averageRating: foodSnapshot.averageRating, totalReviews: foodSnapshot.totalReviews } }
        );
      }
    };

    if (!orderedFoodId) {
      console.log("SKIP  food reply test (customer already reviewed every ordered food)");
      await restore();
      console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed.`);
      return;
    }
    if (!orderedFood) {
      console.log("SKIP: ordered food not found in foods collection.");
      await restore();
      return;
    }

    // 1. Eligibility: Paid bill -> eligible
    const eligPaid = await restaurantReviewService.getEligibility({ userId: customer._id, restaurantId });
    check("eligible when bill is Paid", eligPaid.canReview === true, `items=${eligPaid.billOrderedItems.length}`);

    // 2. NEW: Generated bill (owner created, not yet paid) -> NOT eligible
    await db.collection("bills").updateOne({ _id: bill._id }, { $set: { billStatus: "Generated" } });
    const eligGenerated = await restaurantReviewService.getEligibility({ userId: customer._id, restaurantId });
    check("NOT eligible when bill is Generated (owner-created, unpaid)", eligGenerated.canReview === false);

    // 3. Negative: Draft bill -> not eligible
    await db.collection("bills").updateOne({ _id: bill._id }, { $set: { billStatus: "Draft" } });
    const eligDraft = await restaurantReviewService.getEligibility({ userId: customer._id, restaurantId });
    check("not eligible when bill is Draft", eligDraft.canReview === false);

    // restore bill to Paid so the review-creation steps below are eligible
    await db.collection("bills").updateOne({ _id: bill._id }, { $set: { billStatus: "Paid" } });

    // 4. Restaurant review create + owner reply update
    let restReviewId;
    if (existingRestReview) {
      console.log("NOTE  demo customer already reviewed this restaurant; using existing review for reply test");
      restReviewId = existingRestReview._id;
      const origReply = existingRestReview.ownerReply || "";
      const origRepliedAt = existingRestReview.ownerRepliedAt || null;
      const replied = await restaurantReviewService.updateReview({
        reviewId: restReviewId,
        updates: { ownerReply: "Thank you for your feedback!" },
      });
      check("owner reply persisted", replied.review.ownerReply === "Thank you for your feedback!");
      check("ownerRepliedAt set", Boolean(replied.review.ownerRepliedAt));
      const cleared = await restaurantReviewService.updateReview({
        reviewId: restReviewId,
        updates: { ownerReply: "" },
      });
      check("empty ownerReply clears reply", cleared.review.ownerReply === "" && cleared.review.ownerRepliedAt === null);
      await restaurantReviewService.updateReview({
        reviewId: restReviewId,
        updates: { ownerReply: origReply },
      });
      await db.collection("restaurantreviews").updateOne(
        { _id: restReviewId },
        { $set: { ownerRepliedAt: origRepliedAt } }
      );
    } else {
      const created = await restaurantReviewService.createReview({
        userId: customer._id,
        restaurantId,
        rating: 5,
        comment: "Smoke review for owner reply test.",
      });
      restReviewId = created.review._id;
      const replied = await restaurantReviewService.updateReview({
        reviewId: restReviewId,
        updates: { ownerReply: "Thank you for your feedback!" },
      });
      check("owner reply persisted", replied.review.ownerReply === "Thank you for your feedback!");
      check("ownerRepliedAt set", Boolean(replied.review.ownerRepliedAt));
      const cleared = await restaurantReviewService.updateReview({
        reviewId: restReviewId,
        updates: { ownerReply: "" },
      });
      check("empty ownerReply clears reply", cleared.review.ownerReply === "" && cleared.review.ownerRepliedAt === null);
      await restaurantReviewService.updateReview({
        reviewId: restReviewId,
        updates: { ownerReply: "Final reply" },
      });
      // Hard-delete so the demo customer can still review this restaurant later
      await db.collection("restaurantreviews").deleteOne({ _id: restReviewId });
    }

    // 5. Food review: only bill items allowed
    if (otherFood) {
      let rejected = false;
      try {
        await foodReviewService.createReview({
          userId: customer._id,
          restaurantId,
          foodId: otherFood._id,
          rating: 4,
          comment: "Should not be allowed.",
        });
      } catch (e) {
        rejected = e.statusCode === 403;
      }
      check("non-bill food review rejected with 403", rejected);
    } else {
      console.log("SKIP  non-bill food negative check (all restaurant foods were on the bill)");
    }

    const foodReview = await foodReviewService.createReview({
      userId: customer._id,
      restaurantId,
      foodId: orderedFoodId,
      rating: 4,
      comment: "Smoke food review.",
    });
    const foodReviewId = foodReview.review._id;
    const foodReplied = await foodReviewService.updateReview({
      reviewId: foodReviewId,
      updates: { ownerReply: "Thanks for ordering the Fish Curry!" },
    });
    check("food owner reply persisted", foodReplied.review.ownerReply === "Thanks for ordering the Fish Curry!");
    check("food ownerRepliedAt set", Boolean(foodReplied.review.ownerRepliedAt));
    // Hard-delete (not soft) so the unique userId_1_foodId_1 index is freed
    await db.collection("foodreviews").deleteOne({ _id: foodReviewId });

    await restore();

    const failed = results.filter((r) => !r.pass).length;
    console.log(`\n${results.length - failed}/${results.length} checks passed.`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
