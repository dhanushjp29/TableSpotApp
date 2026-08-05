const m = require("mongoose");

const MONGO_URI = "mongodb://localhost:27017/TableSpot";
const PASSWORD = "Test@1234";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const operatingHours = (open = "09:00", close = "23:00") =>
  DAYS.map((day) => ({ day, isOpen: true, open, close }));

const img = (seed, w = 900, h = 600) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

const gallery = (slug) => [
  img(`${slug}-1`),
  img(`${slug}-2`),
  img(`${slug}-3`),
];

const restaurants = [
  {
    code: "RST100001",
    slug: "spice-garden",
    name: "Spice Garden",
    description:
      "Authentic North Indian fine dining with a modern twist. Known for our rich curries, tandoori specialties and warm hospitality.",
    contactPerson: "Rahul Mehta",
    phoneNumber: "9845000001",
    email: "spicegarden@demo.com",
    address: "12, MG Road, Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    country: "India",
    pincode: "560038",
    lat: 12.9719,
    lng: 77.6412,
    cuisine: ["North Indian", "Veg", "Non-Veg", "Mughlai"],
    priceRange: "₹₹",
    avgCost: 900,
    featured: true,
    offers: [
      {
        title: "20% off on weekends",
        description: "Flat 20% off on the total bill every Saturday and Sunday.",
        offerType: "Percentage",
        offerValue: 20,
        isActive: true,
      },
      {
        title: "Free dessert",
        description: "Complimentary dessert for table bookings above 4 guests.",
        offerType: "Free Item",
        offerValue: 0,
        isActive: true,
      },
    ],
    foods: [
      { code: "FOD300001", name: "Paneer Tikka", category: "Starters", type: "Veg", spice: "Medium", price: 280, prep: 15, popular: true },
      { code: "FOD300002", name: "Chicken Biryani", category: "Biryani", type: "Non-Veg", spice: "Hot", price: 340, prep: 25, popular: true },
      { code: "FOD300003", name: "Butter Chicken", category: "Main Course", type: "Non-Veg", spice: "Mild", price: 380, prep: 20 },
      { code: "FOD300004", name: "Dal Makhani", category: "Main Course", type: "Veg", spice: "Mild", price: 240, prep: 20 },
      { code: "FOD300005", name: "Garlic Naan", category: "North Indian", type: "Veg", spice: "Mild", price: 60, prep: 10 },
      { code: "FOD300006", name: "Gulab Jamun", category: "Desserts", type: "Veg", spice: "Mild", price: 120, prep: 10 },
    ],
  },
  {
    code: "RST100002",
    slug: "cafe-velvet",
    name: "Cafe Velvet",
    description:
      "A cozy café with artisanal coffee, all-day breakfast and wood-fired pizzas. Perfect for brunches and casual meetups.",
    contactPerson: "Sneha Rao",
    phoneNumber: "9845000002",
    email: "cafevelvet@demo.com",
    address: "22, Besant Nagar Beach Road",
    city: "Chennai",
    state: "Tamil Nadu",
    country: "India",
    pincode: "600090",
    lat: 13.0028,
    lng: 80.2695,
    cuisine: ["Cafe", "Continental", "Pizza", "Beverages"],
    priceRange: "₹₹₹",
    avgCost: 1200,
    featured: false,
    offers: [
      {
        title: "Buy 1 Get 1 Coffee",
        description: "BOGO on all handcrafted beverages before 11 AM.",
        offerType: "Free Item",
        offerValue: 0,
        isActive: true,
      },
    ],
    foods: [
      { code: "FOD300007", name: "Cappuccino", category: "Beverages", type: "Veg", spice: "Mild", price: 180, prep: 5 },
      { code: "FOD300008", name: "Margherita Pizza", category: "Pizza", type: "Veg", spice: "Mild", price: 420, prep: 20, popular: true },
      { code: "FOD300009", name: "Pepperoni Pizza", category: "Pizza", type: "Non-Veg", spice: "Medium", price: 490, prep: 20, popular: true },
      { code: "FOD300010", name: "Avocado Toast", category: "Sandwich", type: "Vegan", spice: "Mild", price: 320, prep: 10 },
      { code: "FOD300011", name: "Blueberry Cheesecake", category: "Desserts", type: "Veg", spice: "Mild", price: 260, prep: 5 },
    ],
  },
  {
    code: "RST100003",
    slug: "sea-breeze",
    name: "Sea Breeze",
    description:
      "Fresh coastal seafood served right by the shore. From classic fish curry to grilled prawns, everything tastes like the ocean.",
    contactPerson: "Vijay Kumar",
    phoneNumber: "9845000003",
    email: "seabreeze@demo.com",
    address: "5, Promenade Beach Road",
    city: "Puducherry",
    state: "Puducherry",
    country: "India",
    pincode: "605001",
    lat: 11.9286,
    lng: 79.8343,
    cuisine: ["South Indian", "Seafood", "Non-Veg"],
    priceRange: "₹₹",
    avgCost: 800,
    featured: false,
    offers: [],
    foods: [
      { code: "FOD300012", name: "Grilled Prawns", category: "Starters", type: "Non-Veg", spice: "Medium", price: 350, prep: 15, popular: true },
      { code: "FOD300013", name: "Fish Curry", category: "Main Course", type: "Non-Veg", spice: "Hot", price: 280, prep: 20 },
      { code: "FOD300014", name: "Meen Fry", category: "Starters", type: "Non-Veg", spice: "Hot", price: 260, prep: 15 },
      { code: "FOD300015", name: "Kerala Parotta", category: "South Indian", type: "Veg", spice: "Mild", price: 40, prep: 10 },
      { code: "FOD300016", name: "Tender Coconut Payasam", category: "Desserts", type: "Veg", spice: "Mild", price: 90, prep: 5 },
    ],
  },
  {
    code: "RST100004",
    slug: "green-bowl",
    name: "Green Bowl",
    description:
      "100% plant-based kitchen serving vibrant bowls, fresh salads, smoothies and guilt-free desserts. Healthy never tasted this good.",
    contactPerson: "Ananya Iyer",
    phoneNumber: "9845000004",
    email: "greenbowl@demo.com",
    address: "44, Jubilee Hills Road",
    city: "Hyderabad",
    state: "Telangana",
    country: "India",
    pincode: "500033",
    lat: 17.4319,
    lng: 78.4107,
    cuisine: ["Vegan", "Salad", "Juices", "Healthy"],
    priceRange: "₹",
    avgCost: 500,
    featured: false,
    offers: [
      {
        title: "10% off on takeaway",
        description: "Enjoy 10% off when you order takeaway before 6 PM.",
        offerType: "Percentage",
        offerValue: 10,
        isActive: true,
      },
    ],
    foods: [
      { code: "FOD300017", name: "Quinoa Power Bowl", category: "Main Course", type: "Vegan", spice: "Mild", price: 380, prep: 15, popular: true },
      { code: "FOD300018", name: "Kale Caesar Salad", category: "Salad", type: "Vegan", spice: "Mild", price: 300, prep: 10 },
      { code: "FOD300019", name: "Green Detox Juice", category: "Juices", type: "Vegan", spice: "Mild", price: 180, prep: 5 },
      { code: "FOD300020", name: "Mango Chia Pudding", category: "Desserts", type: "Vegan", spice: "Mild", price: 220, prep: 5 },
    ],
  },
];

const tableTypes = [
  { number: 1, name: "Table 1", capacity: 2, minCap: 1, type: "Couple", location: "Window", status: "Available" },
  { number: 2, name: "Table 2", capacity: 4, minCap: 1, type: "Normal", location: "Indoor", status: "Available" },
  { number: 3, name: "Table 3", capacity: 4, minCap: 2, type: "Family", location: "Ground Floor", status: "Reserved" },
  { number: 4, name: "Table 4", capacity: 6, minCap: 2, type: "Family", location: "1st Floor", status: "Available" },
  { number: 5, name: "VIP Table", capacity: 8, minCap: 4, type: "VIP", location: "Rooftop", status: "Available" },
];

const toDate = (offsetDays, hour = 19, minute = 30) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d;
};

async function upsert(collection, filter, doc) {
  const existing = await m.connection.db.collection(collection).findOne(filter);
  if (existing) {
    await m.connection.db.collection(collection).updateOne(filter, { $set: doc });
    return existing._id;
  }
  const res = await m.connection.db.collection(collection).insertOne(doc);
  return res.insertedId;
}

(async () => {
  await m.connect(MONGO_URI);
  const db = m.connection.db;

  console.log("Cleaning previous demo data...");
  const codeFields = [
    ["restaurants", "restaurantCode"],
    ["restauranttables", "tableCode"],
    ["foods", "foodCode"],
    ["bookings", "bookingCode"],
    ["restaurantreviews", "reviewCode"],
    ["notifications", "notificationCode"],
  ];
  for (const [col, field] of codeFields) {
    const del = await db.collection(col).deleteMany({
      $or: [{ [field]: { $regex: "-DEMO-" } }, { [field]: /NaN$/ }],
    });
    if (del.deletedCount) console.log(`   ${col}: removed ${del.deletedCount}`);
  }

  console.log("Seeding demo users...");
  const ownerFilter = { email: "pwowner1@gmail.com" };
  const customerFilter = { email: "pwcust1@gmail.com" };
  const adminFilter = { email: "pwadmin1@gmail.com" };

  await db.collection("users").updateOne(ownerFilter, { $set: { isActive: true, isDeleted: false, isEmailVerified: true }, $unset: { deletedAt: "" } });
  await db.collection("users").updateOne(customerFilter, { $set: { isActive: true, isDeleted: false, isEmailVerified: true }, $unset: { deletedAt: "" } });
  await db.collection("users").updateOne(adminFilter, { $set: { isActive: true, isDeleted: false, isEmailVerified: true }, $unset: { deletedAt: "" } });

  const owner = await db.collection("users").findOne(ownerFilter);
  const customer = await db.collection("users").findOne(customerFilter);

  const otherCustomerFilter = { email: "dhanushwar771@gmail.com" };
  let otherCustomer = await db.collection("users").findOne(otherCustomerFilter);
  if (!otherCustomer) {
    const res = await db.collection("users").insertOne({
      userCode: "USR900001",
      fullName: "Dhanush K",
      email: "dhanushwar771@gmail.com",
      password: PASSWORD,
      provider: "local",
      phoneNumber: "9876554231",
      role: "customer",
      profileImage: "",
      favoriteCuisines: ["South Indian"],
      favoriteRestaurantIds: [],
      isEmailVerified: true,
      totalBookings: 0,
      isActive: true,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    otherCustomer = { _id: res.insertedId };
  }
  await db.collection("users").updateOne(otherCustomerFilter, { $set: { userCode: "USR900001" } });

  console.log("Seeding restaurants, tables and foods...");
  const seededRestaurantIds = [];
  for (const [rIndex, r] of restaurants.entries()) {
    const restaurantId = await upsert(
      "restaurants",
      { restaurantCode: r.code },
      {
        restaurantCode: r.code,
        slug: r.slug,
        ownerId: owner._id,
        restaurantName: r.name,
        description: r.description,
        contactPerson: r.contactPerson,
        phoneNumber: r.phoneNumber,
        email: r.email,
        address: r.address,
        city: r.city,
        state: r.state,
        country: r.country,
        pincode: r.pincode,
        location: { latitude: r.lat, longitude: r.lng },
        coverImage: img(r.slug, 1200, 600),
        galleryImages: gallery(r.slug),
        cuisineTypes: r.cuisine,
        operatingHours: operatingHours(),
        amenities: ["Free WiFi", "Parking", "AC", "Family Seating"],
        services: ["Table Booking", "Home Delivery", "Takeaway"],
        currentOffers: r.offers,
        priceRange: r.priceRange,
        averageCostForTwo: r.avgCost,
        averageRating: 0,
        totalReviews: 0,
        totalBookings: 0,
        verificationStatus: "Verified",
        verifiedBy: adminFilter._id ? null : null,
        verifiedAt: new Date(),
        isFeatured: r.featured,
        isActive: true,
        isDeleted: false,
      }
    );
    seededRestaurantIds.push(restaurantId);

    const slug = r.slug;
    for (const [tIndex, t] of tableTypes.entries()) {
      const tableCode = `TBL${String(200001 + rIndex * tableTypes.length + tIndex).padStart(6, "0")}`;
      await upsert(
        "restauranttables",
        { tableCode },
        {
          tableCode,
          restaurantId,
          tableNumber: t.number,
          tableName: t.name,
          capacity: t.capacity,
          minimumCapacity: t.minCap,
          tableType: t.type,
          tableLocation: t.location,
          status: t.status,
          isReservable: t.status === "Available",
          isActive: true,
          totalBookings: 0,
          displayOrder: t.number,
        }
      );
    }

    for (const f of r.foods) {
      await upsert(
        "foods",
        { foodCode: f.code },
        {
          foodCode: f.code,
          restaurantId,
          foodName: f.name,
          description: `${f.name} prepared fresh at ${r.name}.`,
          category: f.category,
          foodType: f.type,
          spiceLevel: f.spice,
          hasVariants: false,
          variants: [{ variantName: "Regular", price: f.price, offerPrice: 0 }],
          preparationTime: f.prep,
          coverImage: img(`${slug}-${f.code}`),
          galleryImages: [],
          isAvailable: true,
          isRecommended: f.popular || false,
          isPopular: f.popular || false,
          totalOrders: 0,
          averageRating: 0,
          totalReviews: 0,
          displayOrder: 1,
          isActive: true,
          isDeleted: false,
        }
      );
    }
  }

  console.log("Seeding bookings for demo customer...");
  const bookableRestaurantId = seededRestaurantIds[0]; // Spice Garden
  const tableId = await db.collection("restauranttables").findOne({
    restaurantId: bookableRestaurantId,
    status: "Available",
    isReservable: true,
  });
  const completedTable = await db.collection("restauranttables").findOne({
    restaurantId: seededRestaurantIds[2], // Sea Breeze
    tableNumber: 3,
  });

  const demoBookings = [
    {
      code: "BKG400001",
      restaurant: seededRestaurantIds[0],
      table: await db.collection("restauranttables").findOne({ restaurantId: seededRestaurantIds[0], tableNumber: 1 }),
      status: "Pending",
      guests: 2,
      at: toDate(1, 19, 30),
      special: "Window seat preferred.",
      setTableReserved: true,
    },
    {
      code: "BKG400002",
      restaurant: seededRestaurantIds[1],
      table: await db.collection("restauranttables").findOne({ restaurantId: seededRestaurantIds[1], tableNumber: 2 }),
      status: "Confirmed",
      guests: 4,
      at: toDate(3, 20, 0),
      special: "Anniversary celebration, please decorate the table.",
      setTableReserved: true,
    },
    {
      code: "BKG400003",
      restaurant: seededRestaurantIds[2],
      table: completedTable,
      status: "Completed",
      guests: 2,
      at: toDate(-7, 21, 0),
      special: "",
      setTableReserved: false,
    },
    {
      code: "BKG400004",
      restaurant: seededRestaurantIds[3],
      table: await db.collection("restauranttables").findOne({ restaurantId: seededRestaurantIds[3], tableNumber: 4 }),
      status: "Cancelled",
      guests: 3,
      at: toDate(-14, 19, 0),
      special: "Cancelled due to travel plans.",
      setTableReserved: false,
    },
  ];

  for (const b of demoBookings) {
    if (!b.table) {
      console.log(`   SKIP ${b.code} (no table found)`);
      continue;
    }
    const status = b.status;
    await upsert(
      "bookings",
      { bookingCode: b.code },
      {
        bookingCode: b.code,
        userId: customer._id,
        restaurantId: b.restaurant,
        tableId: b.table._id,
        bookingDateTime: b.at,
        expectedDuration: 120,
        numberOfGuests: b.guests,
        bookingStatus: status,
        bookingType: "Online",
        paymentStatus: status === "Completed" ? "Paid" : "Pending",
        paymentMethod: "Cash",
        advanceAmount: 0,
        totalAmount: status === "Completed" ? 860 : 0,
        specialRequest: b.special,
        preOrderedFoods: [],
        billId: null,
        checkedInAt: status === "Completed" ? b.at : null,
        completedAt: status === "Completed" ? new Date(b.at.getTime() + 2 * 60 * 60 * 1000) : null,
        cancelledAt: status === "Cancelled" ? b.at : null,
        isActive: true,
        isDeleted: false,
      }
    );
    if (b.setTableReserved) {
      await db.collection("restauranttables").updateOne(
        { _id: b.table._id },
        { $set: { status: "Reserved", isReservable: false }, $inc: { totalBookings: 1 } }
      );
    } else {
      await db.collection("restauranttables").updateOne(
        { _id: b.table._id },
        { $set: { status: "Available", isReservable: true }, $inc: { totalBookings: 1 } }
      );
    }
  }

  // Ensure at least one bookable table remains for Spice Garden
  await db.collection("restauranttables").updateOne(
    { restaurantId: bookableRestaurantId, tableCode: "TBL200002" },
    { $set: { status: "Available", isReservable: true } }
  );
  await db.collection("restauranttables").updateOne(
    { restaurantId: bookableRestaurantId, tableCode: "TBL200005" },
    { $set: { status: "Available", isReservable: true } }
  );

  console.log("Seeding restaurant reviews...");
  const reviewDefs = [
    { code: "REV500001", user: otherCustomer, restaurant: seededRestaurantIds[0], rating: 5, title: "Best biryani in town!", comment: "The chicken biryani was absolutely delicious. Service was fast and the ambience is lovely." },
    { code: "REV500002", user: customer, restaurant: seededRestaurantIds[0], rating: 4, title: "Great weekend dinner", comment: "Loved the paneer tikka and dal makhani. Slightly crowded on weekends but worth it." },
    { code: "REV500003", user: otherCustomer, restaurant: seededRestaurantIds[1], rating: 5, title: "Cozy café with great coffee", comment: "The cappuccino was perfect and the cheesecake is a must-try." },
    { code: "REV500004", user: otherCustomer, restaurant: seededRestaurantIds[2], rating: 4, title: "Fresh catch!", comment: "Grilled prawns were fantastic. Great view of the beach." },
  ];

  const ratingByRestaurant = {};
  for (const rv of reviewDefs) {
    await upsert(
      "restaurantreviews",
      { reviewCode: rv.code },
      {
        reviewCode: rv.code,
        userId: rv.user._id,
        restaurantId: rv.restaurant,
        bookingId: null,
        rating: rv.rating,
        title: rv.title,
        comment: rv.comment,
        images: [],
        status: "Published",
        ownerReply: "",
        isActive: true,
        isDeleted: false,
      }
    );
    ratingByRestaurant[String(rv.restaurant)] = ratingByRestaurant[String(rv.restaurant)] || [];
    ratingByRestaurant[String(rv.restaurant)].push(rv.rating);
  }

  for (const [restId, ratings] of Object.entries(ratingByRestaurant)) {
    const avg = ratings.reduce((s, v) => s + v, 0) / ratings.length;
    await db.collection("restaurants").updateOne(
      { _id: new m.Types.ObjectId(restId) },
      { $set: { averageRating: Math.round(avg * 10) / 10, totalReviews: ratings.length } }
    );
  }

  console.log("Seeding notifications for demo customer...");
  const notificationDefs = [
    { code: "NOT600001", title: "Booking Confirmed", message: "Your table at Cafe Velvet is confirmed. See you soon!", type: "Booking", linkModel: "Booking", daysAgo: 1, isRead: true },
    { code: "NOT600002", title: "New Offer at Spice Garden", message: "Enjoy 20% off on your total bill this weekend at Spice Garden.", type: "Offer", linkModel: "Restaurant", daysAgo: 0, isRead: false },
    { code: "NOT600003", title: "Welcome to TableSpot", message: "Thanks for joining TableSpot. Book your first table and get exclusive offers!", type: "System", linkModel: "", daysAgo: 5, isRead: false },
  ];

  for (const n of notificationDefs) {
    const created = new Date();
    created.setDate(created.getDate() - n.daysAgo);
    await upsert(
      "notifications",
      { notificationCode: n.code },
      {
        notificationCode: n.code,
        userId: customer._id,
        title: n.title,
        message: n.message,
        type: n.type,
        linkId: null,
        linkModel: n.linkModel,
        isRead: n.isRead,
        readAt: n.isRead ? created : null,
        isActive: true,
        isDeleted: false,
        createdAt: created,
        updatedAt: created,
      }
    );
  }

  console.log("Setting favorites for demo customer...");
  await db.collection("users").updateOne(
    { _id: customer._id },
    { $set: { favoriteRestaurantIds: [seededRestaurantIds[0], seededRestaurantIds[1]] } }
  );

  console.log("Seed complete!");
  await m.disconnect();
})().catch((e) => {
  console.error("SEED ERROR:", e);
  process.exit(1);
});
