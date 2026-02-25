const mongoose = require("mongoose");

const driverLocationSchema = new mongoose.Schema({
    driverId: { type: String, required: true , index:true},
    location:{
        type:{
            type:String,
            enum:["Point"],
            required:true
        },
        coordinates:{
            type:[Number],
            required:true
        }
     },
     updateAt:{
        type:Date,
        default:Date.now
     }
     
});

driverLocationSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("DriverLocation", driverLocationSchema);

