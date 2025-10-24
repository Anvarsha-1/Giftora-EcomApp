const mongoose = require('mongoose');
const { Schema } = mongoose;

const addressSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    mobileNumber: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    district: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    landmark: {
      type: String,
      default: '',
    },
    pinCode: {
      type: Number,
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    addressType: {
      type: String,
      enum: ['Home', 'Office', 'Other'],
      default: 'Home',
    },
  },
  {
    timestamps: true,
  },
);

const Address = mongoose.model('Address', addressSchema);

module.exports = Address;
