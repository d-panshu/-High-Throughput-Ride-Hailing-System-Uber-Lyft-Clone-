const express = require("express");
const app = express();

app.get("/health", (req, res) => {
  res.json({ status: "consumer-service OK" });
});

app.listen(3000, () => {
  console.log("Consumer service running on port 3000");
});