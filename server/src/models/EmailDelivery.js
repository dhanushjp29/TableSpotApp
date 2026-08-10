import mongoose from "mongoose";

const emailDeliverySchema = new mongoose.Schema(
  {
    eventKey: { type: String, required: true, unique: true, index: true },
    recipient: { type: String, required: true },
    template: { type: String, required: true },
    status: { type: String, enum: ["PENDING", "SENT", "FAILED"], default: "PENDING" },
    sentAt: Date,
    error: String,
  },
  { timestamps: true }
);

export default mongoose.model("EmailDelivery", emailDeliverySchema);
