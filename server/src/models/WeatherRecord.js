import mongoose from "mongoose";

const weatherRecordSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    recordDate: { type: Date, required: true, default: Date.now },
    condition: {
      type: String,
      enum: ["Sunny", "Cloudy", "Rainy", "Stormy", "Windy", "Cold", "Hot", "Foggy"],
      default: "Sunny"
    },
    temperature: { type: Number },
    rainfall: { type: Number, min: 0, default: 0 },
    humidity: { type: Number, min: 0, max: 100 },
    windSpeed: { type: Number, min: 0 },
    impact: { type: String, enum: ["none", "low", "medium", "high"], default: "none" },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

weatherRecordSchema.index({ user: 1, recordDate: -1 });

export default mongoose.model("WeatherRecord", weatherRecordSchema);
