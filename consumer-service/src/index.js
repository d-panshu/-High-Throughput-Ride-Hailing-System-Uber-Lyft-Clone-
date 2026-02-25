const {Kafka} = require("kafkajs");
const mongoose = require("mongoose");
const DriverLocation = require("./models/DriverLocation");


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

        console.log("Location stored:", data.driverId);
      } catch (err) {
        console.error("Consumer error:", err);
      }
    }
  });
}

start();