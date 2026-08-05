const m = require("mongoose");
(async () => {
  await m.connect("mongodb://localhost:27017/TableSpot");
  const db = m.connection.db;
  const cols = await db.listCollections().toArray();
  for (const c of cols) {
    const name = c.name;
    if (!/system/.test(name)) {
      const count = await db.collection(name).countDocuments();
      console.log(`== ${name} (${count}) ==`);
      const docs = await db.collection(name).find().limit(20).toArray();
      for (const d of docs) {
        const code = d.restaurantCode || d.tableCode || d.foodCode || d.bookingCode || d.reviewCode || d.notificationCode || d.userCode || d.email || d.billCode || "";
        const name2 = d.restaurantName || d.tableName || d.foodName || d.fullName || d.title || d.billNumber || "";
        const extra = d.status || d.bookingStatus || d.verificationStatus || d.isActive || "";
        console.log(`   - ${code} | ${name2} | ${extra} | ${d.bookingDateTime || ""}`);
      }
    }
  }
  await m.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
