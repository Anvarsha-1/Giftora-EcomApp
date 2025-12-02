const Cart = require('../../models/cartSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');
const Product = require('../../models/productSchema');
const Order = require('../../models/orderSchema');
const Wallet = require('../../models/walletSchema');
const mongoose = require('mongoose');
const UserCoupon = require('../../models/Referral-Coupon-Schema');
const Coupon = require('../../models/couponSchema');

const loadCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = userId ? await User.findById(userId) : undefined;

    const cart = await Cart.findOne({ userId }).populate('items.productId');

    const addresses = (await Address.find({ userId })) || [];

    const wallet = await Wallet.findOne({ userId });
    let FiveMin = 5 * 60 * 1000;

    let offer = 0;
    let couponCode = null

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.render('user/checkout', {
        user,
        cartItems: [],
        subTotal: 0,
        shipping: 0,
        total: 0,
        addresses,
        wallet,
        offer: offer || 0,
        discount: 0,
        couponCode
      });
    }

    let subTotal = 0;
    const validItems = cart.items.filter((item) => {
      const product = item.productId;
      return (
        product &&
        !product.isBlocked &&
        !product.isDeleted &&
        product.quantity >= 1
      );
    });

    const cartItems = validItems.map((item) => {
      if (item.productId.status === 'Out Of Stock') {
        return res.json({
          success: false,
          message: `${item.productName} Out of stock`,
        });
      }
      const product = item.productId;
      const price = Number(product.salesPrice) || 0;
      const safeQuantity = Math.min(item.quantity, product.quantity || 1);
      const itemTotal = price * safeQuantity;
      offer += (product.regularPrice - product.salesPrice) * item.quantity;

      subTotal += itemTotal;

      return {
        _id: product._id,
        name: product.productName || 'Unnamed Product',
        price: price,
        quantity: safeQuantity,
        image: product.productImage?.[0]?.url || '/images/placeholder.jpg',
        totalPrice: itemTotal,
        offer: Math.abs(offer) || 0,
        discount: 0,
        bestOffer: product.bestOffer || 0,
        couponCode
      };
    });

    const shipping = subTotal >= 1000 ? parseInt(0) : parseInt(50);
    let total = Number(subTotal + shipping);
    
    const couponDiscount = req.session?.applyCoupon?.discount || 0
    
    if (req.session?.applyCoupon?.appliedAt){
      let age = Date.now() - req.session?.applyCoupon?.appliedAt
    if (age < FiveMin) {
      if (req.session.applyCoupon) {
        couponCode = req.session?.applyCoupon?.Code
      }
      
      if (couponDiscount > 0 && couponDiscount < total) {
        total = total - couponDiscount
      }
    }else{
      delete req.session.applyCoupon
    }
  }

    return res.render('user/checkout', {
      user,
      cartItems,
      subTotal,
      addresses,
      shipping,
      total,
      wallet,
      offer: offer || 0,
      discount: couponDiscount,
      couponCode: couponCode || 0,
    });
  } catch (error) {
    console.error('Error loading checkout page:', error.message);
    res.status(500).render('error', {
      title: 'Checkout Error',
      message: 'Something went wrong while loading the checkout page.',
    });
  }
};

const validateCheckout = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate('items.productId');

    if (!cart || !cart.items || cart.items.length < 1) {
      return res.json({
        success: false,
        message: 'invalid request cart not found',
      });
    }
    let outOfStockItems = [];

    for (let item of cart.items) {
      const product = item.productId;

      if (
        !product ||
        product.isBlocked ||
        product.isDeleted ||
        product.quantity < item.quantity
      ) {
        outOfStockItems.push({
          name: product?.productName || 'unknown Product',
          reason: product.isBlocked ? 'Blocked' : `only ${product.quantity} product left!`,
        });
      }
    }

    for (let item of cart.items) {
      if (item.quantity > 10) {
        return res.status(400).json({
          success: false,
          message: 'Max 10 quantity reached',
        });
      }
    }

    if (outOfStockItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some Products are not available',
        item: outOfStockItems,
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.log('Error validate Checkout', error.message);
    return res
      .status(500)
      .json({ success: false, message: 'Something went wrong' });
  }
};

const placeOrder = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const userId = req.session.user;
    const { finalPrice, address, paymentMethod } = req.body;

    if (!address) {
      return res.json({
        success: false,
        message: 'Please select an address to continue',
      });
    }
    if (!paymentMethod) {
      return res.json({
        success: false,
        message: 'Please select a payment method',
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart || !cart.items || cart.items.length < 1) {
      throw new Error('Cart items not found');
    }

    const userAddress = await Address.findById(address);
    if (!userAddress) {
      throw new Error('Invalid address');
    }

    function generateOrderId() {
      const timestamp = Date.now().toString().slice(-5);
      const random = Math.floor(Math.random() * 90000 + 10000);
      return 'ORD' + timestamp + random;
    }

    const orderId = generateOrderId();
    const orderedItems = [];

    // Wallet check before stock reduction
    if (paymentMethod === 'WALLET') {
      const wallet = await Wallet.findOne({ userId });
      if (!wallet || wallet.balance < finalPrice) {
        await session.abortTransaction();
        throw new Error(
          'Insufficient wallet balance. Please choose another payment method.',
        );
      }
    }
    const MAX_QTY = 10;

    for (let item of cart.items) {
      if (item.quantity > MAX_QTY) {
        await session.abortTransaction();
        throw new Error(
          `Cannot order more than ${MAX_QTY} units of ${item.productName}`,
        );
      }

      const product = await Product.findOneAndUpdate(
        { _id: item.productId, quantity: { $gte: item.quantity } },
        { $inc: { quantity: -item.quantity } },
        { new: true, session },
      );
      if (!product) {
        await session.abortTransaction();
        throw new Error(
          `Insufficient stock for ${product ? product.productName : 'productId: ' + item.productId}`,
        );
      }
      orderedItems.push({
        productId: product._id,
        quantity: item.quantity,
        price: product.salesPrice,
        status: paymentMethod === 'COD' ? 'Pending' : 'Processing',
      });
    }

    // Deduct from wallet if method is WALLET
    if (paymentMethod === 'WALLET') {
      await Wallet.updateOne(
        { userId },
        {
          $inc: { balance: -finalPrice },
          $push: {
            transactions: {
              type: 'debit',
              amount: finalPrice,
              description: `Payment for order ${orderId}`,
              date: new Date(),
            },
          },
        },
        { session },
      );
    }

    const subTotalAgg = await Cart.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: '$items' },
      { $group: { _id: null, total: { $sum: '$items.totalPrice' } } },
    ]).session(session);

    const originalAmount = subTotalAgg[0]?.total || 0;
    const shipping = originalAmount >= 1000 ? 0 : 50;

    const status = paymentMethod === 'COD' ? 'Pending' : 'Processing';

    const paymentStatus = paymentMethod === 'COD' ? 'Pending' : 'Completed';

    let couponApplied = false;
    let couponCode = null;
    let couponDiscount = 0;

    if (req.session.applyCoupon) {
      const { discount, Code } = req.session.applyCoupon;
      couponApplied = true;
      couponCode = Code;
      couponDiscount = discount;
    }

    const newOrder = new Order({
      userId,
      orderId,
      orderedItems,
      totalPrice: originalAmount,
      discountPrice: 0, // This seems to be a legacy field, couponDiscount is used below
      finalAmount: finalPrice,
      originalAmount: originalAmount,
      couponApplied,
      couponCode,
      couponDiscount,
      address,
      shippingCharge: shipping,
      status,
      paymentStatus,
      createdOn: Date.now(),
      paymentMethod,
      fullName: userAddress?.fullName,
      mobileNumber: userAddress?.mobileNumber,
      userAddress: userAddress?.address,
      city: userAddress?.city,
      district: userAddress?.district,
      state: userAddress?.state,
      landmark: userAddress?.landmark,
      pinCode: userAddress?.pinCode,
      addressType: userAddress?.addressType,
    });

    await newOrder.save({ session });

    if (couponApplied) {
      const coupon = await Coupon.findOne({ code: couponCode }).session(
        session,
      );
      if (coupon) {
        coupon.usedCount += 1;
        coupon.usedBy.push({
          userId: new mongoose.Types.ObjectId(req.session.user),
          orderId: newOrder._id,
          usedAt: new Date(),
        });
        await coupon.save({ session });

        if (coupon.isPersonalized) {
          await UserCoupon.updateOne(
            { couponId: coupon._id, userId: req.session.user },
            { isUsed: true, usedAt: new Date(), orderId: newOrder._id },
            { session },
          );
        }
      }
    }

    delete req.session.applyCoupon;

    await Cart.updateOne({ userId }, { $set: { items: [] } }, { session });

    await session.commitTransaction();

    return res.json({
      success: true,
      message: 'Order placed successfully',
      orderId: newOrder.orderId,
    });
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    if (
      error.hasErrorLabel &&
      error.hasErrorLabel('TransientTransactionError')
    ) {
      console.log('Write conflict, please retry:', error.message);
      return res.json({
        success: false,
        message: 'Someone else just bought the item. Please try again.',
      });
    }

    console.log('Error while placing Order', error.message);
    return res.json({
      success: false,
      message: error.message || 'Something went wrong. Please try again',
    });
  } finally {
    session.endSession();
  }
};

const loadOrderSuccess = async (req, res, next) => {
  try {
    const orderId = req.query.orderId;
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.redirect('/cart');
    }

    res.render('orderSuccessPage', { order });
  } catch (error) {
    console.log('Error while loading success Page', error.message);
    next(error);
  }
};

module.exports = {
  loadCheckoutPage,
  validateCheckout,
  placeOrder,
  loadOrderSuccess,
};
