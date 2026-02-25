const {io} = require("socket.io-client");

const socket= io("http://localhost",{
    path:"/driver",
    transports: ["websocket"] 
});


socket.on("connect",()=>{
    console.log("Connected to driver service");
    setInterval(()=>{
        const locationUpdate={
            driverId: "driver1345544",
            lat: 37.7749 + (Math.random() - 0.5) * 0.01,
            lng: -122.4194 + (Math.random() - 0.5) * 0.01
        };

        socket.emit("locationUpdate", locationUpdate);
        console.log("Sent location update:", locationUpdate);
    },5000);
});

socket.on("disconnect",()=>{
    console.log("Disconnected from driver service");
});

socket.on("connect_error",(err)=>{
    console.error("Connection error:", err);
});