const m = require("mongoose");
(async () => {
  await m.connect("mongodb://localhost:27017/TableSpot");
  const r = await m.connection.collection("users").findOneAndUpdate(
    { email: "pwadmin1@gmail.com" },
    { $set: { isActive: true, isDeleted: false }, $unset: { deletedAt: "" } },
    { returnDocument: "after" }
  );
  console.log("restored:", r.email, "active:", r.isActive, "deleted:", r.isDeleted);
  await m.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
