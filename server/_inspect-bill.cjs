const m = require("mongoose");
(async () => {
  await m.connect("mongodb://localhost:27017/TableSpot");
  const db = m.connection.db;
  const bookings = await db.collection("bookings").find({}).toArray();
  console.log("BOOKINGS:");
  for (const b of bookings) {
    console.log(
      ` ${b.bookingCode} | rest=${b.restaurantId} | user=${b.userId} | status=${b.bookingStatus} | dt=${b.bookingDateTime}`
    );
  }
  const bills = await db.collection("bills").find({}).toArray();
  console.log("BILLS:");
  for (const b of bills) {
    console.log(
      ` ${b.billCode} | rest=${b.restaurantId} | booking=${b.bookingId} | status=${b.billStatus} | deleted=${b.isDeleted} | total=${b.totalAmount}`
    );
  }
  await m.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
