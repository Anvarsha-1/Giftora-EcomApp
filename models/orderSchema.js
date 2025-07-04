const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const orderSchema = new Schema({
  orderId: {
    type: String,
    default: () => uuidv4(),
    unique: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ["COD", "Online", "Wallet"], // customize based on your app
  },
  orderDate: {
    type: Date,
    default: Date.now,
    required: true,
  },
  status: {
    type: String,
    required: true,
    enum: [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Return Request",
      "Returned",
    ],
    default: "Pending",
  },
  address: {
    type: Schema.Types.ObjectId,
    ref: "Address", // correct ref here
    required: true,
  },
  transactionId: {
    type: String,
    default: null,
  },
  couponId: {
    type: Schema.Types.ObjectId,
    ref: "Coupon",
    default: null,
  },
  couponApplied: {
    type: Boolean,
    default: false,
  },
  total: {
    type: Number,
    required: true,
  },
  discountPrice: {
    type: Number,
    default: 0,
  },
  finalPrice: {
    type: Number,
    required: true,
  },
  orderItems: [
    {
      productId: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      status: {
        type: String,
        enum: ["Pending", "Shipped", "Delivered", "Cancelled", "Returned"],
        default: "Pending",
      },
    },
  ],
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
