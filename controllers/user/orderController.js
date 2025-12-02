const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const BuildPDF = require('../../helpers/pdf-service');
const Wallet = require('../../models/walletSchema.js');
const Product = require('../../models/productSchema.js');
const Coupon = require('../../models/couponSchema.js');
const mongoose = require('mongoose');
const UserCoupon = require('../../models/Referral-Coupon-Schema');

const loadOrderDetails = async (req, res) => {
  try {
    const orderId = req.query.orderId;

    if (!orderId) {
      return res.status(500).render('error', {
        title: '500',
        message: 'invalid request',
      });
    }
    const userId = req.session.user;
    const user = await User.findById(userId);

    const order = await Order.findOne({ orderId }).populate(
      'orderedItems.productId',
    );

    if (!order || order.orderedItems.length < 1) {
      return res.render('error', { title: 404, message: 'not found' });
    }

    const canReturn = order.status === 'Delivered';
    const orderHasReturn = order.orderedItems.some(
      (item) => item.adminApprovalStatus === 'Rejected',
    );

    const subTotal = await Order.aggregate([
      { $match: { orderId: orderId } },
      { $unwind: '$orderedItems' },
      {
        $group: {
          _id: null,
          total: { $sum: '$orderedItems.price' },
        },
      },
    ]);

    const totalAmount = subTotal.length > 0 ? subTotal[0].total : 0;
    const shipping = totalAmount > 1000 ? 0 : 50;

    return res.render('orderDetails', {
      order,
      user,
      canReturn,
      shipping,
      subTotal: totalAmount,
      orderHasReturn: orderHasReturn,
    });
  } catch (error) {
    console.error('error while loading order details page', error.message);
    return res.render('error', {
      title: 'Error',
      message: 'Something went wrong .Please try again',
    });
  }
};

const loadMyOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const totalOrders = await Order.countDocuments({ userId: userId });
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find({ userId: userId })
      .populate('orderedItems.productId')
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit);

    if (!orders || orders.length < 1) {
      return res.render('orderList', {
        orders: [],
        user: user || null,
        currentPage: 1,
        totalPages: 1,
      });
    }

    res.render('orderList', { orders, user, currentPage: page, totalPages });
  } catch (error) {
    console.error('Error happen while loadMyOrder page', error.message);
    return res.status(500).render('error', {
      title: '500',
      message: 'Something went wrong',
    });
  }
};

const cancelProduct = async (req, res) => {
  try {
    const userId = req.session.user;
    const reason = (req.body.reason || '').trim();
    const orderId = req.params.orderId;
    const itemId = req.params.itemId;

    if (!orderId || !itemId) {
      return res.json({ success: false, message: 'Invalid request' });
    }

    if (!reason || reason.length < 6 || reason.length > 50) {
      return res.json({
        success: false,
        message: 'Reason must be 6-50 characters',
      });
    }

 
    const order = await Order.findOne({ orderId }).populate('orderedItems.productId');
    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }

    const item = order.orderedItems.find(i => i._id.toString() === itemId);
    if (!item) {
      return res.json({ success: false, message: 'Ordered product not found in this order' });
    }

    if (item.status === 'Cancelled') {
      return res.json({ success: false, message: 'Item already cancelled' });
    } else if (item.status === 'Delivered') {
      return res.json({ success: false, message: 'Cannot cancel delivered item' });
    }

    
    const unitPrice = Number.isFinite(Number(item.price)) ? Number(item.price) : Number(item.productId?.salesPrice) || 0;
    const quantity = Number(item.quantity) || 0;
    const itemTotal = unitPrice * quantity;

   
    const activeSubtotal = order.orderedItems.reduce((sum, i) => {
      if (i.status === 'Cancelled') return sum;
      const p = Number.isFinite(Number(i.price)) ? Number(i.price) : Number(i.productId?.salesPrice) || 0;
      const q = Number(i.quantity) || 0;
      return sum + p * q;
    }, 0);

    if (!Number.isFinite(itemTotal)) {
      return res.json({ success: false, message: 'Invalid item total for refund' });
    }
    if (!Number.isFinite(activeSubtotal) || activeSubtotal <= 0) {
      return res.json({ success: false, message: 'Invalid order total' });
    }

  
    const totalCouponDiscount = Number(order.couponDiscount || 0);

   
    const couponShare = totalCouponDiscount > 0
      ? Math.round((itemTotal / activeSubtotal) * totalCouponDiscount)
      : 0;

   
    const baseRefund = Math.max(0, itemTotal - couponShare);

    
    const amountPaidRemaining = Number(order.finalAmount) || 0;
    const refundAmount = Math.min(baseRefund, amountPaidRemaining);

    
    const newBalanceSubtotal = activeSubtotal - itemTotal; 
    order.totalPrice = Math.max(0, newBalanceSubtotal);
    order.finalAmount = Math.max(0, amountPaidRemaining - refundAmount);

   
    order.couponDiscount = Math.max(0, totalCouponDiscount - couponShare);
    order.discountPrice = order.couponDiscount;

    
    if (refundAmount > 0 && order.paymentMethod === 'ONLINE' || order.paymentMethod==="WALLET") {
      const walletUpdate = await Wallet.updateOne(
        { userId: new mongoose.Types.ObjectId(userId) },
        {
          $inc: { balance: refundAmount },
          $push: {
            transactions: {
              type: 'credit',
              amount: refundAmount,
              description: `Refund for cancelled item ${itemId} in order ${orderId}`,
              date: new Date(),
            },
          },
        },
        { upsert: true }
      );

      if (!walletUpdate.acknowledged) {
        return res.json({ success: false, message: 'Failed to update wallet' });
      }
    }

   
    item.status = 'Cancelled';
    item.cancellationReason = reason;

   
    if (order.orderedItems.every(i => i.status === 'Cancelled')) {
      order.status = 'Cancelled';
      order.finalAmount = 0;
    }

    await order.save();

    
    if (item.productId) {
      await Product.updateOne({ _id: item.productId._id }, { $inc: { quantity: item.quantity } });
    }

    const successMessage = `Item cancelled. A refund of ₹${refundAmount.toFixed(2)} will be processed. The item's coupon share of ₹${couponShare.toFixed(2)} has been adjusted.`;

    return res.json({
      success: true,
      message: successMessage,
      refundAmount,
      couponShare,
      remainingOrderFinalAmount: order.finalAmount,
      remainingCouponDiscount: order.couponDiscount,
    });
  } catch (error) {
    console.error('Error in cancelProduct:', error);
    return res.json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};


const cancelOrder = async (req, res) => {
  try {
    const reason = req.body.reason;
    const orderId = req.params.orderId;
    const userId = req.session.user;

    if (!orderId) {
      return res.json({ success: false, message: 'invalid request' });
    }

    if (!reason || reason.trim().length < 6 || reason.trim().length > 50) {
      return res.json({
        success: false,
        message: 'Reason is required or reason must be at least 6-50 character',
      });
    }

    const order = await Order.findOne({ orderId }).populate(
      'orderedItems.productId',
    );

    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }
    if (order.status === 'Delivered') {
      return res.json({
        message: 'Product is already Delivered. User return option',
        success: false,
      });
    }

    for (let item of order.orderedItems) {
      const wasPendingOrShipped =
        item.status === 'Pending' || item.status === 'Shipped';
      if (item.status === 'Pending') {
        item.status = 'Cancelled';
        item.cancellationReason = reason;
      }

      if (wasPendingOrShipped) {
        item.productId.quantity += item.quantity;
        await item.productId.save();
      }
    }
    let couponApplied = !!order.couponApplied && !!order.couponCode;

    if (couponApplied) {
      const coupon = await Coupon.findOne({ code: order.couponCode });
      if (coupon) {
        await Coupon.updateOne(
          { _id: coupon._id },
          {
            $pull: {
              usedBy: {
                userId: new mongoose.Types.ObjectId(userId),
                orderId: order._id,
              },
            },
          },
        );

        if (coupon.isPersonalized) {
          await UserCoupon.updateOne(
            {
              couponId: coupon._id,
              userId: new mongoose.Types.ObjectId(userId),
            },
            { isUsed: false, usedAt: null, orderId: null },
          );
        }
      }
    }

    order.status = 'Cancelled';
    order.cancellationReason = reason;

    await order.save();
    let refundAmount = order.finalAmount;
    if (order.paymentMethod === 'ONLINE' || order.paymentMethod==="WALLET" ) {
      const wallet = await Wallet.updateOne(
        { userId },
        {
          $inc: { balance: refundAmount },
          $push: {
            transactions: {
              type: 'credit',
              amount: refundAmount,
              description: `Refund for cancel order ${orderId}`,
              date: Date.now(),
            },
          },
        },
        { upsert: true },
      );
      if (!wallet.acknowledged) {
        return res.json({ success: false, message: 'Wallet update failed' });
      }

      if (wallet.modifiedCount === 0 && !wallet.upsertedId) {
        return res.json({ success: false, message: 'No wallet changes made' });
      }
    }

    return res.json({ success: true, message: 'order has been cancelled' });
  } catch (error) {
    console.error('error in order cancel page', error.message);
    return res.json({ success: false, message: 'Something went wrong' });
  }
};

const downloadPdf = async (req, res, next) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findOne({ orderId })
      .populate('orderedItems.productId')
      .lean();

    if (!order) {
      return res.json({ success: false, message: 'order not found' });
    }
    const stream = res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=invoice-${orderId}.pdf`,
    });

    BuildPDF(
      order,
      (chunk) => stream.write(chunk),
      () => stream.end(),
    );
  } catch (error) {
    console.error('Error in invoice page', error.message);
    next(error);
  }
};

const returnOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const reason = (req.body.reason || '').trim();

    if (!orderId) {
      return res.json({
        success: false,
        message: 'Invalid request. Cannot return delivered item.',
      });
    }

    if (!reason || reason.length < 3 || reason.length > 50) {
      return res.json({
        success: false,
        message: 'Reason required and must be 3-50 characters.',
      });
    }

    const order = await Order.findOne({ orderId }).populate('orderedItems.productId');

    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }

   
    const hasRejectedItem = order.orderedItems.some(
      (val) => val.adminApprovalStatus === 'Rejected'
    );
    if (hasRejectedItem) {
      return res.json({
        success: false,
        message: 'Product return request already rejected for one or more items.',
      });
    }

 
    const eligibleItems = order.orderedItems.filter((it) => it.status === 'Delivered');

    if (eligibleItems.length === 0) {
      return res.json({
        success: false,
        message: 'No delivered items available to request a return for.',
      });
    }

   
    const now = new Date();

    const changed = [];
    eligibleItems.forEach((it) => {
      it.status = 'Return Request';
      it.returnReason = reason;
      it.itemReturnRequestAt = now; 
      it.adminApprovalStatus = 'Pending';
      changed.push({ itemId: it._id.toString(), productId: it.productId?._id });
    });

    
    order.status = 'Return Request';
    order.returnReason = reason;
    order.returnedAt = now;

    await order.save();

    return res.json({
      success: true,
      message: 'Return request submitted for delivered items',
      requestedFor: changed,
    });
  } catch (error) {
    console.error('error while return order', error);
    return res.json({ success: false, message: 'Something went wrong' });
  }
};

const returnItemRequest = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;

    if (!orderId || !itemId) {
      return res.json({ success: false, message: 'Invalid request' });
    }

    const order = await Order.findOne({ orderId }).populate(
      'orderedItems.productId',
    );
    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }

    const itemToReturn = order.orderedItems.find(
      (item) => item._id.toString() === itemId.toString(),
    );
    if (!itemToReturn) {
      return res.json({
        success: false,
        message: 'Product not found in this order',
      });
    }

    if (itemToReturn.status !== 'Delivered') {
      return res.json({
        success: false,
        message: 'Only delivered items can be returned.',
      });
    }

  
    const hadCouponApplied = !!order.couponApplied && !!order.couponCode;
    if (hadCouponApplied) {
      const couponDoc = await Coupon.findOne({ code: order.couponCode }).lean();
      if (couponDoc) {
        const itemTotal =
          (Number(itemToReturn.price) || 0) *
          (Number(itemToReturn.quantity) || 0);

        const activeSubtotal = order.orderedItems.reduce((sum, i) => {
          if (i.status === 'Cancelled' || i.status === 'Returned') return sum;
          return sum + (Number(i.price) || 0) * (Number(i.quantity) || 0);
        }, 0);

        const newBalanceSubtotal = activeSubtotal - itemTotal;

        if (newBalanceSubtotal < Number(couponDoc.minPurchase || 0)) {
         
          return res.json({
            success: false,
            message:
              'Cannot return this item as it would invalidate the applied coupon. Please return the entire order instead.',
          });
        }
      }
    }
  

    itemToReturn.status = 'Return Request';
    itemToReturn.returnReason = reason;
    itemToReturn.itemReturnRequestAt = Date.now();

    await order.save();
    return res.json({ success: true });
  } catch (error) {
    console.error('Error while order Item Request', error.message);
    return res.json({ success: false, message: 'Something went wrong' });
  }
};

module.exports = {
  loadOrderDetails,
  loadMyOrder,
  cancelProduct,
  cancelOrder,
  returnOrder,
  returnItemRequest,
  downloadPdf,
};
