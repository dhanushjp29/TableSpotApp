const UNSPLASH_BASE = "https://images.unsplash.com";
const IMAGE_QUERY = "?auto=format&fit=crop&w=900&q=80";

const unsplash = (id) => `${UNSPLASH_BASE}/${id}${IMAGE_QUERY}`;

const VERIFIED = {
  biryani: ["photo-1589302168068-964664d93dc0", "photo-1631515243349-e0cb75fb8d3a"],
  pizza: ["photo-1565299624946-b28f40a0ae38"],
  burger: ["photo-1568901346375-23c9450c58cd", "photo-1571091718767-18b5b1457add"],
  pasta: ["photo-1621996346565-e3dbc646d9a9", "photo-1473093295043-cdd812d0e601"],
  sandwich: ["photo-1528735602780-2552fd46c7af"],
  chinese: ["photo-1585032226651-759b368d7246"],
  southIndian: ["photo-1630383249896-424e482df921", "photo-1567188040759-fb8a883dc6d8"],
  northIndian: [
    "photo-1631452180519-c014fe946bc7",
    "photo-1603133872878-684f208fb84b",
    "photo-1601050690597-df0568f70950",
  ],
  starter: [
    "photo-1565557623262-b51c2513a641",
    "photo-1555939594-58d7cb561ad1",
    "photo-1547592180-85f173990554",
    "photo-1587668178277-295251f900ce",
    "photo-1585937421612-70a008356fbe",
  ],
  mainCourse: [
    "photo-1603894584373-5ac82b2ae398",
    "photo-1563379926898-05f4575a45d8",
    "photo-1540189549336-e6e99c3679fe",
    "photo-1476718406336-bb5a9690ee2a",
    "photo-1504674900247-0877df9cc836",
    "photo-1512621776951-a57141f2eefd",
    "photo-1546069901-ba9599a7e63c",
  ],
  dessert: [
    "photo-1587314168485-3236d6710814",
    "photo-1551024506-0bccd828d307",
    "photo-1555126634-323283e090fa",
    "photo-1550583724-b2692b85b150",
    "photo-1565958011703-44f9829ba187",
  ],
  iceCream: ["photo-1563805042-7684c019e1cb"],
  beverage: [
    "photo-1509042239860-f550ce710b93",
    "photo-1544787219-7f47ccb76574",
    "photo-1559847844-5315695dadae",
    "photo-1532980400857-e8d9d275d858",
  ],
  juice: ["photo-1600271886742-f049cd451bba"],
  combo: ["photo-1467003909585-2f8a72700288"],
  kids: ["photo-1546793665-c74683f339c1"],
};

const byCategory = {
  Starters: VERIFIED.starter,
  "Main Course": VERIFIED.mainCourse,
  Biryani: VERIFIED.biryani,
  Pizza: VERIFIED.pizza,
  Burger: VERIFIED.burger,
  Pasta: VERIFIED.pasta,
  Sandwich: VERIFIED.sandwich,
  Chinese: VERIFIED.chinese,
  "South Indian": VERIFIED.southIndian,
  "North Indian": VERIFIED.northIndian,
  Desserts: VERIFIED.dessert,
  Beverages: VERIFIED.beverage,
  Juices: VERIFIED.juice,
  "Ice Cream": VERIFIED.iceCream,
  Combo: VERIFIED.combo,
  "Kids Menu": VERIFIED.kids,
  Other: VERIFIED.mainCourse,
};

const foodImages = (category, seed = 0) => {
  const pool = byCategory[category] || VERIFIED.mainCourse;
  return unsplash(pool[Math.abs(seed) % pool.length]);
};

const COVERS = [
  "photo-1517248135467-4c7edcad34c4",
  "photo-1555396273-367ea4eb4db5",
  "photo-1589301760014-d929f3979dbc",
  "photo-1540189549336-e6e99c3679fe",
  "photo-1589302168068-964664d93dc0",
  "photo-1630383249896-424e482df921",
  "photo-1565299624946-b28f40a0ae38",
  "photo-1601050690597-df0568f70950",
  "photo-1585032226651-759b368d7246",
  "photo-1559847844-5315695dadae",
  "photo-1631515243349-e0cb75fb8d3a",
  "photo-1567188040759-fb8a883dc6d8",
  "photo-1476718406336-bb5a9690ee2a",
  "photo-1551024506-0bccd828d307",
  "photo-1512621776951-a57141f2eefd",
  "photo-1563379926898-05f4575a45d8",
  "photo-1544025162-d76694265947",
].map(unsplash);

const GALLERY_POOL = [
  "photo-1414235077428-338989a2e8c0",
  "photo-1552566626-52f8b828add9",
  "photo-1514933651103-005eec06c04b",
  "photo-1533777857889-4be7c70b33f7",
  "photo-1559314809-0d155014e29e",
  "photo-1482049016688-2d3e1b311543",
  "photo-1490645935967-10de6ba17061",
  "photo-1567620832903-9fc6debc209f",
  "photo-1567620905732-2d1ec7ab7445",
  "photo-1504674900247-0877df9cc836",
].map(unsplash);

const coverFor = (index) => COVERS[Math.abs(index) % COVERS.length];

const galleryFor = (seed = 0, count = 3) => {
  const start = Math.abs(seed) % GALLERY_POOL.length;
  const result = [];
  for (let i = 0; i < count; i += 1) {
    result.push(GALLERY_POOL[(start + i) % GALLERY_POOL.length]);
  }
  return result;
};

export { unsplash, foodImages, coverFor, galleryFor };
