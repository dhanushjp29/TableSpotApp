export const TABLE_STATUS = {
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  OCCUPIED: "Occupied",
  CLEANING: "Cleaning",
  MAINTENANCE: "Maintenance",
};

export const TABLE_STATUS_VALUES = [
  TABLE_STATUS.AVAILABLE,
  TABLE_STATUS.RESERVED,
  TABLE_STATUS.OCCUPIED,
  TABLE_STATUS.CLEANING,
  TABLE_STATUS.MAINTENANCE,
];

export const TABLE_TYPE_VALUES = [
  "Normal",
  "VIP",
  "Private",
  "Family",
  "Couple",
  "Window",
  "Kids",
  "Other",
];

export const TABLE_LOCATION_VALUES = [
  "Indoor",
  "Outdoor",
  "Ground Floor",
  "1st Floor",
  "2nd Floor",
  "Terrace",
  "Rooftop",
  "Garden",
  "Pool Side",
  "Beach Side",
  "Other",
];

export const TABLE_SHAPE = {
  ROUND: "Round",
  SQUARE: "Square",
  RECTANGLE: "Rectangle",
  OVAL: "Oval",
  BOAT: "Boat",
  SINGLE_ROW: "SingleRow",
};

export const TABLE_SHAPE_VALUES = [
  TABLE_SHAPE.ROUND,
  TABLE_SHAPE.SQUARE,
  TABLE_SHAPE.RECTANGLE,
  TABLE_SHAPE.OVAL,
  TABLE_SHAPE.BOAT,
  TABLE_SHAPE.SINGLE_ROW,
];

export const TABLE_SHAPE_LABELS = {
  [TABLE_SHAPE.ROUND]: "Round",
  [TABLE_SHAPE.SQUARE]: "Square",
  [TABLE_SHAPE.RECTANGLE]: "Rectangle",
  [TABLE_SHAPE.OVAL]: "Oval",
  [TABLE_SHAPE.BOAT]: "Boat",
  [TABLE_SHAPE.SINGLE_ROW]: "Single Row",
};

export const SEAT_SELECTION_MODE = {
  FULL_TABLE: "FullTable",
  INDIVIDUAL_SEATS: "IndividualSeats",
};

export const SEAT_SELECTION_MODE_VALUES = [
  SEAT_SELECTION_MODE.FULL_TABLE,
  SEAT_SELECTION_MODE.INDIVIDUAL_SEATS,
];

export const SEAT_SELECTION_MODE_LABELS = {
  [SEAT_SELECTION_MODE.FULL_TABLE]: "Full Table",
  [SEAT_SELECTION_MODE.INDIVIDUAL_SEATS]: "Individual Seats",
};

export const MAX_SEATS_PER_TABLE = 100;
export const MAX_SEATS_SINGLE_ROW = 24;
