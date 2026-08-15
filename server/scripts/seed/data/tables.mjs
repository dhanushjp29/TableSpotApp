import RestaurantTable from "../../../src/models/RestaurantTable.js";
import { CODE_PREFIX } from "../../../src/utils/constants.js";
import { codeFor } from "../lib/codes.mjs";
import { upsertOne, makeSeats } from "../lib/helpers.mjs";

const T = (cap, type = "Normal", loc = "Indoor", mode = "FullTable", shape = null) => ({
  cap,
  type,
  loc,
  mode,
  shape,
});

export const TABLES_SPEC = {
  flagship: [
    T(2, "Couple", "Indoor", "FullTable", "Round"),
    T(2, "Couple", "Indoor", "FullTable", "Round"),
    T(4, "Family", "Indoor"),
    T(4, "Family", "Indoor"),
    T(4, "Normal", "Ground Floor"),
    T(6, "Family", "Indoor", "FullTable", "Rectangle"),
    T(6, "Family", "Rooftop", "FullTable", "Round"),
    T(8, "VIP", "1st Floor", "FullTable", "Oval"),
    T(10, "VIP", "1st Floor", "FullTable", "Round"),
    T(2, "Couple", "Terrace", "FullTable", "Square"),
    T(4, "Normal", "Indoor", "IndividualSeats"),
    T(6, "Private", "1st Floor", "FullTable", "Oval"),
  ],
  chettinad: [
    T(2, "Couple", "Indoor", "FullTable", "Round"),
    T(2, "Couple", "Indoor", "FullTable", "Round"),
    T(4, "Family", "Indoor"),
    T(4, "Normal", "Indoor"),
    T(6, "Family", "Indoor", "FullTable", "Rectangle"),
    T(4, "Normal", "Ground Floor"),
    T(8, "Family", "Indoor", "FullTable", "Rectangle"),
    T(2, "Normal", "Indoor"),
  ],
  coastal: [
    T(2, "Couple", "Beach Side", "FullTable", "Round"),
    T(2, "Couple", "Beach Side", "FullTable", "Round"),
    T(4, "Family", "Outdoor"),
    T(4, "Normal", "Outdoor"),
    T(6, "Family", "Outdoor", "FullTable", "Rectangle"),
    T(4, "Normal", "Garden"),
    T(2, "Window", "Beach Side", "FullTable", "Round"),
    T(6, "Private", "Outdoor", "FullTable", "Oval"),
  ],
  "madras-cafe": [
    T(2, "Couple", "Indoor", "FullTable", "Round"),
    T(2, "Couple", "Indoor", "FullTable", "Round"),
    T(4, "Family", "Indoor"),
    T(4, "Normal", "Indoor"),
    T(6, "Family", "Indoor", "FullTable", "Rectangle"),
    T(2, "Normal", "Indoor"),
    T(4, "Normal", "Indoor", "IndividualSeats"),
  ],
  "biryani-house": [
    T(2, "Couple", "Indoor", "FullTable", "Round"),
    T(2, "Couple", "Indoor", "FullTable", "Round"),
    T(4, "Family", "Indoor"),
    T(4, "Family", "Indoor"),
    T(4, "Normal", "Ground Floor"),
    T(6, "Family", "Indoor", "FullTable", "Rectangle"),
    T(6, "Normal", "Ground Floor", "FullTable", "Rectangle"),
    T(8, "VIP", "1st Floor", "FullTable", "Oval"),
    T(4, "Normal", "Indoor", "IndividualSeats"),
    T(2, "Normal", "Indoor"),
  ],
  "dosa-junction": [
    T(2, "Couple", "Indoor", "FullTable", "Round"),
    T(2, "Couple", "Indoor", "FullTable", "Round"),
    T(4, "Family", "Indoor"),
    T(4, "Normal", "Indoor"),
    T(6, "Family", "Indoor", "FullTable", "Rectangle"),
    T(2, "Normal", "Indoor"),
    T(4, "Normal", "Indoor", "IndividualSeats"),
    T(6, "Family", "Indoor", "FullTable", "Rectangle"),
  ],
  "rooftop-pizzeria": [
    T(2, "Couple", "Rooftop", "FullTable", "Round"),
    T(2, "Couple", "Rooftop", "FullTable", "Round"),
    T(4, "Family", "Rooftop"),
    T(4, "Normal", "Indoor"),
    T(6, "Family", "Rooftop", "FullTable", "Rectangle"),
    T(4, "Window", "Rooftop"),
    T(8, "Private", "Rooftop", "FullTable", "Oval"),
    T(4, "Normal", "Indoor", "IndividualSeats"),
    T(2, "Normal", "Rooftop"),
  ],
  "mumbai-tiffin": [
    T(2, "Couple", "Indoor", "FullTable", "Round"),
    T(4, "Family", "Indoor"),
    T(4, "Normal", "Indoor"),
    T(6, "Family", "Indoor", "FullTable", "Rectangle"),
    T(8, "Family", "Indoor", "FullTable", "Rectangle"),
    T(2, "Normal", "Indoor"),
    T(4, "Normal", "Indoor", "IndividualSeats"),
    T(6, "Family", "Indoor", "FullTable", "Rectangle"),
  ],
  "street-wok": [
    T(2, "Couple", "Indoor", "FullTable", "Round"),
    T(4, "Family", "Indoor"),
    T(4, "Normal", "Indoor"),
    T(6, "Family", "Indoor", "FullTable", "Rectangle"),
    T(2, "Normal", "Indoor"),
    T(4, "Normal", "Indoor", "IndividualSeats"),
    T(6, "Family", "Indoor", "FullTable", "Rectangle"),
    T(4, "Normal", "Outdoor"),
  ],
  "chai-co": [
    T(2, "Couple", "Outdoor", "FullTable", "Round"),
    T(2, "Couple", "Outdoor", "FullTable", "Round"),
    T(4, "Normal", "Indoor"),
    T(4, "Family", "Indoor"),
    T(2, "Couple", "Indoor", "FullTable", "Round"),
    T(4, "Normal", "Outdoor", "IndividualSeats"),
    T(6, "Family", "Indoor", "FullTable", "Rectangle"),
  ],
  "hyderabad-dum": [
    T(2, "Couple", "Indoor", "FullTable", "Round"),
    T(2, "Couple", "Indoor", "FullTable", "Round"),
    T(4, "Family", "Indoor"),
    T(4, "Normal", "Indoor"),
    T(6, "Family", "Indoor", "FullTable", "Rectangle"),
    T(6, "Normal", "Ground Floor", "FullTable", "Rectangle"),
    T(8, "VIP", "Indoor", "FullTable", "Oval"),
    T(4, "Normal", "Indoor", "IndividualSeats"),
    T(2, "Couple", "Indoor", "FullTable", "Round"),
    T(10, "Family", "Indoor", "FullTable", "Rectangle"),
  ],
  "paradise-corner": [
    T(2, "Couple", "Indoor", "FullTable", "Round"),
    T(4, "Family", "Indoor"),
    T(4, "Normal", "Indoor"),
    T(6, "Family", "Indoor", "FullTable", "Rectangle"),
    T(2, "Normal", "Indoor"),
    T(4, "Normal", "Indoor", "IndividualSeats"),
    T(6, "Family", "Indoor", "FullTable", "Rectangle"),
    T(8, "Family", "Indoor", "FullTable", "Rectangle"),
  ],
  "pune-thali": [
    T(2, "Couple", "Indoor", "FullTable", "Round"),
    T(4, "Family", "Indoor"),
    T(4, "Normal", "Indoor"),
    T(6, "Family", "Indoor", "FullTable", "Rectangle"),
    T(8, "Family", "Indoor", "FullTable", "Rectangle"),
    T(4, "Normal", "Indoor", "IndividualSeats"),
    T(2, "Normal", "Indoor"),
    T(6, "Family", "Indoor", "FullTable", "Rectangle"),
  ],
  "bake-brew": [
    T(2, "Couple", "Indoor", "FullTable", "Round"),
    T(2, "Couple", "Outdoor", "FullTable", "Round"),
    T(4, "Normal", "Indoor"),
    T(4, "Family", "Outdoor"),
    T(6, "Family", "Indoor", "FullTable", "Rectangle"),
    T(4, "Normal", "Indoor", "IndividualSeats"),
    T(2, "Normal", "Indoor"),
    T(6, "Family", "Outdoor", "FullTable", "Rectangle"),
    T(4, "Family", "Indoor"),
  ],
  "green-leaf": [
    T(2, "Couple", "Indoor", "FullTable", "Round"),
    T(4, "Family", "Indoor"),
    T(4, "Normal", "Indoor"),
    T(6, "Family", "Indoor", "FullTable", "Rectangle"),
    T(8, "Family", "Indoor", "FullTable", "Rectangle"),
    T(4, "Normal", "Indoor", "IndividualSeats"),
    T(2, "Normal", "Indoor"),
    T(6, "Family", "Indoor", "FullTable", "Rectangle"),
  ],
  "kochi-spice": [
    T(2, "Couple", "Indoor", "FullTable", "Round"),
    T(4, "Family", "Indoor"),
    T(4, "Normal", "Indoor"),
    T(6, "Family", "Indoor", "FullTable", "Rectangle"),
    T(2, "Normal", "Indoor"),
    T(4, "Normal", "Indoor", "IndividualSeats"),
    T(6, "Family", "Indoor", "FullTable", "Rectangle"),
    T(8, "Family", "Indoor", "FullTable", "Rectangle"),
  ],
  "sunset-grill": [
    T(2, "Couple", "Beach Side", "FullTable", "Round"),
    T(2, "Couple", "Beach Side", "FullTable", "Round"),
    T(4, "Family", "Outdoor"),
    T(4, "Normal", "Outdoor"),
    T(6, "Family", "Beach Side", "FullTable", "Rectangle"),
    T(4, "Normal", "Outdoor", "IndividualSeats"),
    T(6, "Private", "Outdoor", "FullTable", "Oval"),
    T(4, "Normal", "Beach Side"),
  ],
};

const defaultShape = (cap, type, shape) => {
  if (shape) return shape;
  if (cap === 2) return "Round";
  if (cap === 4) return "Square";
  return "Rectangle";
};

export const seedTables = async (ctx) => {
  let codeIndex = 0;
  let createdCount = 0;

  for (const restaurantKey of Object.keys(TABLES_SPEC)) {
    const restaurant = ctx.restaurants.get(restaurantKey).doc;
    const tableSpecs = TABLES_SPEC[restaurantKey];

    for (let i = 0; i < tableSpecs.length; i += 1) {
      const spec = tableSpecs[i];
      codeIndex += 1;
      const tableCode = codeFor(CODE_PREFIX.TABLE, codeIndex);
      const tableNumber = i + 1;
      const seats =
        spec.mode === "IndividualSeats"
          ? makeSeats(spec.cap, `S${tableNumber}-`)
          : [];

      const doc = {
        tableCode,
        restaurantId: restaurant._id,
        tableNumber,
        tableName: "",
        tableLabel: `T${tableNumber}`,
        shape: defaultShape(spec.cap, spec.type, spec.shape),
        seatSelectionMode: spec.mode,
        seats,
        capacity: spec.cap,
        minimumCapacity: spec.cap,
        tableType: spec.type,
        tableLocation: spec.loc,
        floor: spec.loc === "1st Floor" ? "1" : "",
        status: "Available",
        isReservable: true,
        statusSource: "manual",
        isActive: true,
        totalBookings: 0,
        displayOrder: i + 1,
        description: `${spec.cap} seater ${spec.type} table (${spec.loc})`,
      };

      const { created, doc: saved } = await upsertOne(
        RestaurantTable,
        { tableCode },
        doc
      );
      if (created) createdCount += 1;

      const key = `${restaurantKey}:${tableNumber}`;
      ctx.tables.set(key, { doc: saved, created });
    }
  }

  return { created: createdCount };
};

export default seedTables;
