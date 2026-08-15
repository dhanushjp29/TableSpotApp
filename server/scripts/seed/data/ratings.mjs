import Food from "../../../src/models/food.js";
import FoodReview from "../../../src/models/FoodReview.js";
import Restaurant from "../../../src/models/Restaurant.js";
import RestaurantReview from "../../../src/models/RestaurantReview.js";

const roundToOne = (value) => Math.round(value * 10) / 10;

const buildRatingOps = async (ReviewModel, refField) => {
  const stats = await ReviewModel.aggregate([
    { $match: { isDeleted: false, status: "Published" } },
    {
      $group: {
        _id: `$${refField}`,
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  return stats.map((s) => ({
    updateOne: {
      filter: { _id: s._id },
      update: {
        $set: {
          averageRating: roundToOne(s.averageRating),
          totalReviews: s.totalReviews,
        },
      },
    },
  }));
};

export const seedRatings = async () => {
  const [restaurantOps, foodOps] = await Promise.all([
    buildRatingOps(RestaurantReview, "restaurantId"),
    buildRatingOps(FoodReview, "foodId"),
  ]);

  const restaurantRes = restaurantOps.length
    ? await Restaurant.bulkWrite(restaurantOps)
    : { modifiedCount: 0 };
  const foodRes = foodOps.length
    ? await Food.bulkWrite(foodOps)
    : { modifiedCount: 0 };

  return {
    created: 0,
    updated: restaurantRes.modifiedCount + foodRes.modifiedCount,
    restaurants: restaurantRes.modifiedCount,
    foods: foodRes.modifiedCount,
  };
};

export default seedRatings;
