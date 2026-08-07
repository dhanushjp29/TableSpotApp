const m = require("mongoose");
(async () => {
  await m.connect("mongodb://localhost:27017/TableSpot");
  const db = m.connection.db;
  const b = await db.collection("bookings").findOne({ bookingCode: "BKG400003" });
  if (!b) { console.log("booking not found"); process.exit(1); }
  const existing = await db.collection("bills").findOne({ bookingId: b._id });
  if (existing) { console.log("bill exists:", existing.billCode, existing.billStatus); process.exit(0); }
  const foods = await db.collection("foods").find({
    restaurantId: b.restaurantId,
    foodCode: { $in: ["FOD300012", "FOD300013"] },
  }).toArray();
  const orderedItems = foods.map((f) => ({
    foodId: f._id,
    foodName: f.foodName,
    variantName: "Regular",
    quantity: f.code === "FOD300013" ? 2 : 1,
    unitPrice: f.price,
    offerPrice: 0,
    totalPrice: f.price * (f.code === "FOD300013" ? 2 : 1),
    orderSource: "Spot Order",
    gstRate: f.gstRate || 5,
  }));
  const subTotal = orderedItems.reduce((s, i) => s + i.totalPrice, 0);
  const res = await db.collection("bills").insertOne({
    billCode: "BIL_TEST1",
    bookingId: b._id,
    restaurantId: b.restaurantId,
    userId: b.userId,
    orderedItems,
    subTotal,
    discount: { type: "Amount", value: 0 },
    taxableAmount: subTotal,
    grandTotal: subTotal,
    billStatus: "Paid",
    isDeleted: false,
    payment: {
      payments: [{ paymentMethod: "UPI", amount: subTotal, paidAt: new Date() }],
      totalPaid: subTotal,
      balanceDue: 0,
      paymentStatus: "Paid",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log("inserted:", res.insertedId);
  await m.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
