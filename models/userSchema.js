const mongoose = require("mongoose");
const {Schema} = mongoose;


const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    phone: {
        type: String,
        required: false,
        unique: false,
        sparse:true,
        default:null
    },
    googleId: {
        type: String,
        unique:true
    },
    password: {
        type: String,
        required: false,
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    cart: [{
        type: Schema.Types.ObjectId,
        ref:"Cart",
    }],
    wishlist: [{
        type: Schema.Types.ObjectId,
        ref: "Wishlist"
    }],
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: "Order",
    }],
    referralCode: {
        type: String,
    },
    redeemedUser: [{
        type: Schema.Types.ObjectId,
        ref: "User"
    }],
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
        },
        searchOn :{
            type: Date,
            default: Date.now
        }
    }]
},{
    timestamps: true 
})

const User = mongoose.model("User",userSchema);
 
module.exports= User;