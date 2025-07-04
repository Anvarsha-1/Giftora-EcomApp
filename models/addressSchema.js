const mongoose = require("mongoose");
const {Schema} = mongoose;

const addressSchema =  new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref:"User",
        required: true,
    },
    name: {
       type: String,
       required: true,
    },
    phone: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true,
    },
    city: {
        type: String,
        required: true,
    },
    state: {
        type:String,
        required:true,
    },
    landMark: {
        type: String,
        default:"" 
    },
    pinCode: {
        type:Number,
        required: true,
    },
    altPhone: {
        type: String,
        default:"",
     },
    label: {
        type: String,
        enum: ['Home', 'Office', 'Other'],
        default: 'Home'
  }
},{
    timestamps:true,
})

const Address = mongoose.model("Address",addressSchema);