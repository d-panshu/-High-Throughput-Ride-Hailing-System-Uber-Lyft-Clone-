const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Kafka } = require("kafkajs");

const app = express();

const server = http.createServer(app);
const io = new Server(server, {
  path:"/driver",
  cors:{origin:"*"}
});

const kafka = new Kafka({
  clientId: "driver-service",
  brokers: [process.env.KAFKA_BROKERS],
  retry:{
    initialRetryTime:300,
    retries:10
  }
});

const producer = kafka.producer();

async function initKafka() {
    try{
         await producer.connect();
  console.log("Kafka producer connected");
    }catch(err){
        console.error("Failed to connect, retrying in 5 seconds...", err);
        setTimeout(initKafka,5000);
    }
 
}

initKafka();

app.get("/health", (req, res) => {
  res.json({ status: "driver-service OK" });
});


io.on("connection", (socket)=>{
    console.log("New driver connected: " + socket.id);

    socket.on("locationUpdate", async (payload)=>{
       try{
        await producer.send({
            topic:"location-updates",
            messages:[
                {key: payload.driverId,
                value: JSON.stringify({
                    driverId: payload.driverId,
                    lat: payload.lat,
                    lng: payload.lng,
                    timestamp: Date.now()
                })}
            ]
        });

        console.log("location published:",payload.driverId);
       }catch(err){
        console.error("Error publishing location update:", err);
       }

       });
    
        socket.on("disconnect", () => {
        console.log("Driver disconnected:", socket.id);
    });



});
server.listen(3000, () => {
  console.log("Driver service running on port 3000");
});