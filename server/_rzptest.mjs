import Razorpay from "razorpay";
const razorpay = new Razorpay({
  key_id: "rzp_test_TLKIAGz6ugAXGP",
  key_secret: "DxF17F7LgQSOvjmA2YRXgtpH",
});

try {
  const account = await razorpay.accounts.create({
    type: "route",
    email: "pwowner1@gmail.com",
    contact: "9876543210",
    legal_business_name: "TableSpot Test Restaurant",
    business_type: "individual",
    profile: {
      category: "food",
      subcategory: "restaurants",
      addresses: {
        registered: {
          street1: "Test Street",
          city: "Mumbai",
          state: "MH",
          postal_code: "400001",
          country: "IN",
        },
      },
    },
    notes: { source: "tablespot" },
  });
  console.log("ACCOUNT CREATED:", JSON.stringify(account, null, 2));

  try {
    const link = await razorpay.api.post({
      version: "v2",
      url: `/accounts/${account.id}/account_link`,
      data: {
        amount: 0,
        currency: "INR",
        customer: {
          name: "PW Owner",
          email: "pwowner1@gmail.com",
          contact: "9876543210",
        },
        notify: { email: true, sms: false, whatsapp: false },
      },
    });
    console.log("ONBOARDING LINK:", JSON.stringify(link, null, 2));
  } catch (linkErr) {
    console.log("ACCOUNT_LINK ERROR:", linkErr.message);
    if (linkErr.response) console.log(linkErr.response.data);
  }

  try {
    const fetched = await razorpay.accounts.fetch(account.id);
    console.log("FETCHED:", JSON.stringify({ id: fetched.id, status: fetched.status, activation_details: fetched.activation_details, email: fetched.email, legal_business_name: fetched.legal_business_name }, null, 2));
  } catch (err) {
    console.log("FETCH ERROR:", err.message);
  }

  try {
    await razorpay.accounts.delete(account.id);
    console.log("ACCOUNT DELETED (cleanup)");
  } catch (err) {
    console.log("DELETE ERROR:", err.message);
  }
} catch (err) {
  console.log("CREATE ERROR:", err.message || err);
  if (err.response) console.log(JSON.stringify(err.response.data));
  if (err.error) console.log(JSON.stringify(err.error));
  console.log(JSON.stringify(Object.keys(err)));
}
