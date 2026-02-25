const express = require("express");
const mongoose = require("mongoose");

const RideRequest = require("./models/RideRequest");

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

app.post("/rider/request-ride", async (req, res) => {
  const { riderId, lat, lng } = req.body;

  const ride = await RideRequest.create({
    riderId,
    pickup: {
      type: "Point",
      coordinates: [lng, lat]
    }
  });

  res.json({ message: "Ride requested", rideId: ride._id });
});

app.listen(3000, () => {
  console.log("Rider service running");
});