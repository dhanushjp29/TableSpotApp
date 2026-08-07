import {
  MAX_SEATS_PER_TABLE,
  MAX_SEATS_SINGLE_ROW,
  TABLE_SHAPE,
} from "./constants.js";

const CENTER = 50;
const RADIUS = 40;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const roundToTwo = (value) => Math.round(value * 100) / 100;

export const normalizeTableLabel = (label = "") => {
  const cleaned = String(label)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 3);

  return cleaned;
};

export const deriveTableLabel = ({ tableLabel = "", tableName = "", tableNumber }) => {
  const fromLabel = normalizeTableLabel(tableLabel);
  if (fromLabel) return fromLabel;

  const fromName = normalizeTableLabel(tableName);
  if (fromName) return fromName;

  if (tableNumber) return normalizeTableLabel(`T${tableNumber}`);

  return "T";
};

export const buildSeatLabel = (prefix, seatIndex) => {
  const cleaned = normalizeTableLabel(prefix);
  return cleaned ? `${cleaned}${seatIndex}` : String(seatIndex);
};

const roundPositions = (count) => {
  const seats = [];

  for (let i = 0; i < count; i += 1) {
    const angle = (-90 + (360 / count) * i) * (Math.PI / 180);
    seats.push({
      seatIndex: i + 1,
      position: {
        x: roundToTwo(CENTER + RADIUS * Math.cos(angle)),
        y: roundToTwo(CENTER + RADIUS * Math.sin(angle)),
      },
    });
  }

  return seats;
};

const squarePositions = (count) => {
  const sides = ["top", "right", "bottom", "left"];
  const perSideBase = Math.floor(count / 4);
  let remainder = count % 4;
  const perSide = sides.map(() => {
    const n = perSideBase + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return n;
  });

  const positionFor = (side, i, sideCount) => {
    const step = 76 / (sideCount + 1);
    const offset = 12 + step * (i + 1);

    switch (side) {
      case "top":
        return [offset, 12];
      case "right":
        return [88, offset];
      case "bottom":
        return [88 - (offset - 12), 88];
      case "left":
        return [12, 88 - (offset - 12)];
      default:
        return [50, 50];
    }
  };

  const pointAt = (x, y) => ({ x: roundToTwo(clamp(x, 0, 100)), y: roundToTwo(clamp(y, 0, 100)) });

  const seats = [];
  let used = 0;

  sides.forEach((side, sideIndex) => {
    for (let i = 0; i < perSide[sideIndex] && used < count; i += 1, used += 1) {
      const [x, y] = positionFor(side, i, perSide[sideIndex]);
      seats.push({ seatIndex: used + 1, position: pointAt(x, y) });
    }
  });

  return seats;
};

const singleRowPositions = (count) => {
  const seats = [];

  if (count === 1) {
    seats.push({ seatIndex: 1, position: { x: 50, y: 88 } });
    return seats;
  }

  const step = 80 / (count - 1);

  for (let i = 0; i < count; i += 1) {
    seats.push({
      seatIndex: i + 1,
      position: { x: roundToTwo(10 + i * step), y: 88 },
    });
  }

  return seats;
};

// Rectangle / Boat: seats walk the perimeter of the table top.
// Body spans x:14-86 (width 72) and y:30-70 (height 40).
const rectanglePositions = (count) => {
  const W = 72;
  const H = 40;
  const LX = 14;
  const TY = 30;
  const perimeter = 2 * (W + H);
  const seats = [];

  for (let i = 0; i < count; i += 1) {
    const d = ((i + 0.5) * perimeter) / count;
    let x;
    let y;

    if (d < W) {
      x = LX + d;
      y = TY - 12;
    } else if (d < W + H) {
      x = LX + W + 12;
      y = TY + (d - W);
    } else if (d < 2 * W + H) {
      x = LX + W - (d - W - H);
      y = TY + H + 12;
    } else {
      x = LX - 12;
      y = TY + H - (d - 2 * W - H);
    }

    seats.push({
      seatIndex: i + 1,
      position: { x: roundToTwo(clamp(x, 0, 100)), y: roundToTwo(clamp(y, 0, 100)) },
    });
  }

  return seats;
};

// Oval: seats placed around an ellipse (rx 40, ry 28) centered at (50, 50).
const ovalPositions = (count) => {
  const seats = [];

  for (let i = 0; i < count; i += 1) {
    const angle = (-90 + (360 / count) * i) * (Math.PI / 180);
    seats.push({
      seatIndex: i + 1,
      position: {
        x: roundToTwo(50 + 40 * Math.cos(angle)),
        y: roundToTwo(50 + 28 * Math.sin(angle)),
      },
    });
  }

  return seats;
};

export const getMaxSeatsForShape = (shape) =>
  shape === TABLE_SHAPE.SINGLE_ROW ? MAX_SEATS_SINGLE_ROW : MAX_SEATS_PER_TABLE;

export const getPositionsForShape = (shape, count) => {
  if (shape === TABLE_SHAPE.ROUND) return roundPositions(count);
  if (shape === TABLE_SHAPE.SINGLE_ROW) return singleRowPositions(count);
  if (shape === TABLE_SHAPE.RECTANGLE || shape === TABLE_SHAPE.BOAT) {
    return rectanglePositions(count);
  }
  if (shape === TABLE_SHAPE.OVAL) return ovalPositions(count);
  return squarePositions(count);
};

/**
 * Generates normalized seat definitions (seatIndex, seatLabel, position).
 * The `count` is the number of active seats requested.
 */
export const generateSeats = ({ label, count, shape = TABLE_SHAPE.SQUARE }) => {
  const normalizedCount = Math.max(1, Math.min(Number(count) || 1, getMaxSeatsForShape(shape)));
  const prefix = normalizeTableLabel(label);

  return getPositionsForShape(shape, normalizedCount).map(({ seatIndex, position }) => ({
    seatIndex,
    seatLabel: buildSeatLabel(prefix, seatIndex),
    position,
    isActive: true,
  }));
};
