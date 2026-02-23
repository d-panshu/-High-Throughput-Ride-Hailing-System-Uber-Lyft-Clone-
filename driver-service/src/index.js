const express = require("express");
const app = express();

app.get("/health", (req, res) => {
  res.json({ status: "driver-service OK" });
});

app.listen(3000, () => {
  console.log("Driver service running on port 3000");
});