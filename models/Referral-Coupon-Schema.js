const mongoose = require('mongoose');

const userCouponSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    usedAt: {
      type: Date,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
  },
  { timestamps: true },
);

userCouponSchema.index({ userId: 1, couponId: 1 }, { unique: true });

module.exports = mongoose.model('UserCoupon', userCouponSchema);
