const mongoose = require("mongoose");
const {Schema} = mongoose;


const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        minlength:4,
        maxlength:20,
    },
    lastName: {
        type: String,
        required: true,
        minlength:1,
        maxlength:20,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    phone: {
        type: String,
        required: false,
        sparse:true,
        default:null,
    },
    profileImage: {
        public_id: { type: String, required: false, default: null },
        url: { type: String, required: false, default: null }
    },
    googleId: {
        type: String,
        unique:true,
        sparse: true
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
    invitedAt: {
        type :Date,
        default: Date.now
    },
    invitedBy: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    referralCode: {
        type: String,
    },
    redeemedUser: [{
        type: Schema.Types.ObjectId,
        ref: "User"
    }],
    referralRewardType: {
        type: String,
        default: null
    },

    referralStatus: {
        type: String,
        enum: ["Pending", "Claimed"],
        default: 'Pending'
    },

    referralCreatedAt: {
        type: Date,
        default: Date.now
    },
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