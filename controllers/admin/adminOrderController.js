const Order = require('../../models/orderSchema');
const Wallet = require('../../models/walletSchema.js');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema.js')
const mongoose = require('mongoose');

const loadOrderPage = async (req, res) => {
  try {
    let { page = 1, status, sort = 'latest', search } = req.query;
    page = parseInt(page) || 1;
    const defaultPageSize = 10;

    let filter = {};

    if (status && status !== 'All') {
      filter.status = status;
    }

    if (search) {
      const matchingUsers = await User.find({
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ],
      }).select('_id');

      const matchingUserIds = matchingUsers.map((u) => u._id);

      filter.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { userId: { $in: matchingUserIds } },
      ];
    }

    const sortBy = sort === 'oldest' ? 1 : -1;

    const skip = (page - 1) * defaultPageSize;
    const orders = await Order.find(filter)
      .populate('userId', 'firstName lastName email')
      .sort({ createdOn: sortBy })
      .skip(skip)
      .limit(defaultPageSize)
      .lean();

    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / defaultPageSize);

    const params = { ...req.query };
    delete params.page;
    const paramsStr =
      Object.keys(params).length > 0
        ? '&' +
          Object.entries(params)
            .map(
              ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
            )
            .join('&')
        : '';

    res.render('admin/orderManagement', {
      orders,
      currentPage: page,
      totalPages,
      query: req.query,
      searchParamsExceptPage: paramsStr,
    });
  } catch (error) {
    console.log('Error while loading order page', error.message);
    res.status(500).render('user/error', {
      title: 500,
      message: 'Server error',
    });
  }
};

const VALID_ORDER_STATUSES = [
  'Pending',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
  'Return Request',
  'Returned',
];


const DISALLOWED_TARGETS = ['Return Request', 'Returned'];


const EDITABLE_ITEM_STATUSES = ['Pending', 'Processing', 'Shipped'];


const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    if (!VALID_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }


    if (DISALLOWED_TARGETS.includes(status)) {
      return res.status(403).json({
        success: false,
        message: `Admin cannot set order status to "${status}". Use the proper return flow instead.`,
      });
    }

    const order = await Order.findOne({ orderId }).populate('orderedItems.productId');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }


    if (order.status === 'Delivered' && status !== 'Delivered') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change status: order is already Delivered.',
      });
    }

    const changedItems = [];
    const skippedItems = [];

    
    for (const item of order.orderedItems) {
      const current = item.status;

     
      if (['Cancelled', 'Return Request', 'Returned', 'Delivered'].includes(current)) {
        skippedItems.push({
          itemId: item._id,
          productId: item.productId?._id,
          from: current,
          reason: `not editable (final state)`,
        });
        continue;
      }


      if (!EDITABLE_ITEM_STATUSES.includes(current)) {
        skippedItems.push({
          itemId: item._id,
          productId: item.productId?._id,
          from: current,
          reason: `current status "${current}" not allowed to be changed via this endpoint`,
        });
        continue;
      }

      if (status === 'Delivered' && current !== 'Shipped') {
        skippedItems.push({
          itemId: item._id,
          productId: item.productId?._id,
          from: current,
          reason: 'item must be Shipped before marking as Delivered',
        });
        continue;
      }

      if (status === 'Cancelled' && current === 'Delivered') {
        skippedItems.push({
          itemId: item._id,
          productId: item.productId?._id,
          from: current,
          reason: 'cannot cancel a delivered item',
        });
        continue;
      }


      if (current !== status) {
        item.status = status;
        changedItems.push({
          itemId: item._id,
          productId: item.productId?._id,
          from: current,
          to: status,
        });
      } else {
        skippedItems.push({
          itemId: item._id,
          productId: item.productId?._id,
          from: current,
          reason: 'already in requested status',
        });
      }
    }

  
    if (changedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          'No eligible items to update. Possible reasons: all items are Cancelled, Delivered, or in a return flow. Status not changed.',
        skippedItems,
      });
    }


    const nonCancelledItems = order.orderedItems.filter(i => i.status !== 'Cancelled');
    const allSame = nonCancelledItems.length > 0 && nonCancelledItems.every(i => i.status === status);

    if (allSame) {
      order.status = status;
    }
   
    if (status === 'Delivered') {
      order.paymentStatus = 'Completed';
    }

    await order.save();

    return res.json({
      success: true,
      message: 'Order item statuses updated',
      orderStatus: order.status,
      changedItems,
      skippedItems,
    });
  } catch (error) {
    console.error('error while updating order status', error);
    return res.status(500).json({ success: false, message: 'Update failed' });
  }
};

const getPendingReturnsCount = async (req, res) => {
  try {
    const [result] = await Order.aggregate([
      { $unwind: '$orderedItems' },
      { $match: { 'orderedItems.status': 'Return Request' } },
      { $count: 'totalReturnRequests' },
    ]);

    const totalReturnRequests = result ? result.totalReturnRequests : 0;

    return res.json({ count: totalReturnRequests });
  } catch {
    return res.json({ count: 0 });
  }
};

const getReturnedOrder = async (req, res) => {
  try {
    const orders = await Order.find({ 'orderedItems.status': 'Return Request' })
      .populate('orderedItems.productId')
      .populate('userId');

    const user = await User.findById(req.session.user);

    if (!orders || orders.length < 1) {
      return res.render('verifyOrderReturn', { orders: [], user });
    }

    return res.render('verifyOrderReturn', { orders, user });
  } catch (error) {
    console.log('error while return order verify page ', error.message);
  }
};

const verifyOrderReturn = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;

    const order = await Order.findOne({ orderId }).populate('orderedItems.productId');
    if (!order) {
      return res.json({ success: false, message: 'Invalid request: Order not found' });
    }

    const item = order.orderedItems.find(i => i._id.toString() === itemId);
    if (!item) {
      return res.json({ success: false, message: 'Product not found in order' });
    }

 
    if (item.status !== 'Return Request' && item.status !== 'Delivered') {
      return res.json({ success: false, message: 'Invalid return state for this item' });
    }

    const userId = order.userId;

    
    const unitPrice = Number.isFinite(Number(item.price))
      ? Number(item.price)
      : Number(item.productId?.price) || 0;
    const quantity = Number(item.quantity) || 0;
    const itemTotal = unitPrice * quantity;


    const activeSubtotal = order.orderedItems.reduce((sum, i) => {
      if (i.status === 'Cancelled' || i.status === 'Returned') return sum;
      const p = Number.isFinite(Number(i.price)) ? Number(i.price) : Number(i.productId?.price) || 0;
      const q = Number(i.quantity) || 0;
      return sum + p * q;
    }, 0);

    if (!Number.isFinite(itemTotal) || itemTotal <= 0) {
      return res.json({ success: false, message: 'Invalid item total for refund' });
    }
    if (!Number.isFinite(activeSubtotal) || activeSubtotal <= 0) {
      return res.json({ success: false, message: 'Invalid order total' });
    }

    const newBalanceSubtotal = activeSubtotal - itemTotal;

  
    let baseRefund = itemTotal;
    const amountPaidRemaining = Number(order.finalAmount) || 0;
    const totalCouponDiscount = Number(order.couponDiscount || 0);


    const couponShare = totalCouponDiscount > 0
      ? Math.round((itemTotal / activeSubtotal) * totalCouponDiscount)
      : 0;

    const appliedCouponShare = Math.min(couponShare, itemTotal);


    baseRefund = Math.max(0, itemTotal - appliedCouponShare);

    
    const refundAmount = Math.min(baseRefund, amountPaidRemaining);

   
    order.totalPrice = Math.max(0, newBalanceSubtotal);
    order.finalAmount = Math.max(0, amountPaidRemaining - refundAmount);

 
    order.couponDiscount = Math.max(0, totalCouponDiscount - appliedCouponShare);
    order.discountPrice = order.couponDiscount;

  
    if (refundAmount > 0) {
      const walletUpdate = await Wallet.updateOne(
        { userId: new mongoose.Types.ObjectId(userId) },
        {
          $inc: { balance: refundAmount },
          $push: {
            transactions: {
              type: 'credit',
              amount: refundAmount,
              description: `Refund for returned item ${item._id} in order ${orderId}`,
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

   
    item.status = 'Returned';
    item.adminApprovalStatus = 'Approved';
    item.returnedAt = new Date();


    const allOrderReturned = order.orderedItems.every(i => i.status === 'Returned');
    const anyDeliveredLeft = order.orderedItems.some(i => i.status === 'Delivered');

    if (allOrderReturned) {
      order.status = 'Returned';
      if (order.finalAmount === 0) order.paymentStatus = 'Refunded';
    } else if (anyDeliveredLeft) {
      order.status = 'Delivered';
    } 

    await order.save(); 
  
    if (item && item.productId) {
      await Product.updateOne(
        { _id: item.productId._id },
        { $inc: { quantity: item.quantity } }
      );
    }

    return res.json({
      success: true,
      message: 'Return approved and refund processed',
      refundAmount,
      couponShare: appliedCouponShare,
      remainingOrderFinalAmount: order.finalAmount,
      remainingCouponDiscount: order.couponDiscount,
    });
  } catch (error) {
    console.error('error while updating verify orderReturn ', error);
    return res.json({
      success: false,
      message: 'Something went wrong please try again',
    });
  }
};


const cancelReturnRequest = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;

    const { reason } = req.body;

    if (!reason || reason.length < 3 || reason.length > 50) {
      return res.json({
        success: false,
        message: 'reason required or reason length must be 3-50 characters',
      });
    }

    const order = await Order.findOne({ orderId }).populate(
      'orderedItems.productId',
    );

    if (!order) {
      return res.json({ success: false, message: 'order not found' });
    }

    const item = order.orderedItems.find(
      (item) => item._id.toString() === itemId.toString(),
    );

    if (!item || item.status !== 'Return Request') {
      return res.json({
        success: false,
        message: 'Item not found or Item return request is invalid',
      });
    }

    item.adminRejectionReason = reason;
    item.adminApprovalStatus = 'Rejected';
    item.status = 'Delivered';

    await order.save();

    const allOrderReturnCheck = order.orderedItems.every(
      (item) => item.status === 'Returned',
    );
    const OrderDeliveredStatus = order.orderedItems.some(
      (item) => item.status === 'Delivered',
    );

    if (allOrderReturnCheck) {
      order.status = 'Returned';
    }
    if (OrderDeliveredStatus) {
      order.status = 'Delivered';
    }

    res.json({ success: true });
  } catch (error) {
    console.log('error while cancel return request ', error.message);
    return res.json({
      success: false,
      message: 'Something went wrong please try again',
    });
  }
};

const viewOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    if (!orderId || typeof orderId !== 'string') {
      return res.render('admin/viewOrderDetails', { order: null, user: null });
    }

    const order = await Order.findOne({ orderId }).populate(
      'orderedItems.productId',
    );

    if (!order) {
      return res.render('admin/viewOrderDetails', { order: null, user: null });
    }

    const userId = order.userId;
    if (!userId) {
      return res.render('admin/viewOrderDetails', { order, user: null });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.render('admin/viewOrderDetails', { order, user: null });
    }

    return res.render('admin/viewOrderDetails', {
      order,
      user,
    });
  } catch (error) {
    console.error('Error in viewOrderDetails:', error);
    return res.render('admin/viewOrderDetails', {
      order: null,
      user: null,
      address: null,
    });
  }
};

module.exports = {
  loadOrderPage,
  updateOrderStatus,
  getPendingReturnsCount,
  getReturnedOrder,
  verifyOrderReturn,
  cancelReturnRequest,
  viewOrderDetails,
};
