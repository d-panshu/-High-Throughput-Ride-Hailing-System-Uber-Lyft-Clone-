const express = require("express");
const app = express();

app.get("/health", (req, res) => {
  res.json({ status: "rider-service OK" });
});

app.listen(3000, () => {
  console.log("Rider service running on port 3000");
});