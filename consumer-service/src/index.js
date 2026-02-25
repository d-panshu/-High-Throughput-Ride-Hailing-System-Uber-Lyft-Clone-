const {Kafka} = require("kafkajs");
const mongoose = require("mongoose");
const DriverLocation = require("./models/DriverLocation");
const Ride = require("./models/RideRequest");
const RideRequest = require("./models/RideRequest");


const kafka = new Kafka({
    clientId:"consumer-service",
    brokers:[process.env.KAFKA_BROKERS],
    retry:{
        initialRetryTime:300,
        retries:10
    }
});


const consumer = kafka.consumer({
  groupId: "location-processor-cg"
});

async function tryMatchDriver(driverData) {

  const nearestRide = await RideRequest.findOne({
    status: "pending",
    pickup: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [driverData.lng, driverData.lat]
        },
        $maxDistance: 5000 
      }
    }
  });
  console.log("Trying to match driver:", driverData.driverId);


  if (!nearestRide) {
    console.log(`No pending rides near Driver ${driverData.driverId}`);
    return;
  }


  const updatedRide = await RideRequest.findOneAndUpdate(
    { 
      _id: nearestRide._id, 
      status: "pending" 
    },
    { 
      $set: { 
        status: "matched", 
        matchedDriverId: driverData.driverId 
      } 
    },
    { new: true }
  );

  if (!updatedRide) {
    console.log(`Conflict: Ride ${nearestRide._id} already claimed.`);
    return;
  }

  await DriverLocation.findOneAndUpdate(
    { driverId: driverData.driverId },
    { $set: { isAvailable: false } }
  );

  console.log(
    `Successfully Matched: Rider ${updatedRide.riderId} with Driver ${driverData.driverId}`
  );
  const producer = kafka.producer();
  await producer.connect();
  await producer.send({
  topic: "ride-matched",
  messages: [
    {
      key: updatedRide.riderId,
      value: JSON.stringify({
        riderId: updatedRide.riderId,
        driverId: driverData.driverId
      })
    }
  ]
});
}

async function start() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Mongo connected");

  await consumer.connect();
  await consumer.subscribe({
    topic: "location-updates",
    fromBeginning: false
  });

  console.log("Kafka consumer connected");

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const data = JSON.parse(message.value.toString());

        await DriverLocation.findOneAndUpdate(
          { driverId: data.driverId },
          {
            location: {
              type: "Point",
              coordinates: [data.lng, data.lat]
            },
            updatedAt: new Date()
          },
          { upsert: true }
        );
        await tryMatchDriver(data);

        console.log("Location stored:", data.driverId);
      } catch (err) {
        console.error("Consumer error:", err);
      }
    }
  });
}

start();