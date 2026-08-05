const m = require("mongoose");
const emails = ["pwadmin1@gmail.com", "pwowner1@gmail.com", "pwcust1@gmail.com"];
(async () => {
  await m.connect("mongodb://localhost:27017/TableSpot");
  for (const email of emails) {
    const r = await m.connection.collection("users").findOneAndUpdate(
      { email },
      { $set: { isActive: true, isDeleted: false }, $unset: { deletedAt: "" } },
      { returnDocument: "after" }
    );
    console.log("restored:", r?.email, "active:", r?.isActive, "deleted:", r?.isDeleted);
  }
  await m.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
