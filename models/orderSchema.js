const mongoose = require("mongoose")
const { Schema } = mongoose
// const {v4:uuidv4}=require("uuid")

const orderSchema = new Schema({
  orderId: {
    type: String,
    // default:()=>uuidv4(),
    unique: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  orderedItems: [{
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    price: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned'],
      default: 'Pending'
    },
    cancellationReason: {
      type: String
    },
    returnReason: {
      type: String
    },
    itemReturnRequestAt :{
      type:Date
    },
    adminApprovalStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending'
    },
    adminRejectionReason: {
      type: String
    }
  }],
  totalPrice: {
    type: Number,
    required: true
  },
  discountPrice: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  address: {
    type: Schema.Types.ObjectId,
    ref: "Address",
    required: true
  },
  invoiceData: {
    type: Date,
  },
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned']
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required: true
  },
  couponApplied: {
    type: Boolean,
    default: false
  },
  couponCode: {
    type: String,
    default: null
  },
  couponDiscount: {
    type: Number,
    default: 0
  },
  originalAmount: {
    type: Number,
    default: 0
  },
  paymentMethod: {
    type: String,
    enum: ['COD', 'ONLINE', 'WALLET'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
    default: 'Pending'
  },
  razorpayOrderId: {
    type: String
  },
  razorpayPaymentId: {
    type: String
  },
  razorpaySignature: {
    type: String
  },
  cancellationReason: {
    type: String
  },
  returnReason: {
    type: String
  },
  returnRejectionReason: {
    type: String
  },
  returnRejectedAt: {
    type: Date
  }
})

const Order = mongoose.model("Order", orderSchema)
module.exports = Order