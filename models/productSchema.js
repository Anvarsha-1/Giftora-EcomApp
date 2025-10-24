const mongoose = require('mongoose');

const { Schema } = mongoose;

const productSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    regularPrice: {
      type: Number,
      min: 0,
      required: true,
    },
    salesPrice: {
      type: Number,
      min: 0,
      required: true,
    },
    productOffer: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    quantity: {
      type: Number,
      require: true,
      min: 0,
    },
    bestOffer: {
      type: Number,
      default: 0,
    },
    productImage: [
      {
        url: String,
        public_id: String,
      },
    ],
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['Available', 'Out Of Stock', 'Discontinued'],
      required: true,
      default: 'Available',
    },
  },
  { timestamps: true },
);

const Product =
  mongoose.models.Product || mongoose.model('Product', productSchema);

module.exports = Product;
