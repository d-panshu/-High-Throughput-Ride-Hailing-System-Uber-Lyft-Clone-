const mongoose = require("mongoose");

const rideRequestSchema = new mongoose.Schema({
  riderId: { type: String, required: true },
  pickup: {
    type: {
      type: String,
      enum: ["Point"],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  status: {
    type: String,
    enum: ["pending", "matched"],
    default: "pending"
  },
  matchedDriverId: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

rideRequestSchema.index({ pickup: "2dsphere" });

module.exports = mongoose.model("RideRequest", rideRequestSchema);