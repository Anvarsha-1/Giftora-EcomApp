const Order = require('../../models/orderSchema')
const Wallet = require('../../models/walletSchema.js')
const User = require('../../models/userSchema')
const Address = require('../../models/addressSchema')
const Coupon = require('../../models/couponSchema.js')
const mongoose = require('mongoose')

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
                    { email: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');

            const matchingUserIds = matchingUsers.map(u => u._id);


            filter.$or = [
                { orderId: { $regex: search, $options: 'i' } },
                { userId: { $in: matchingUserIds } }
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
                    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
                    .join('&')
                : '';

        res.render('admin/orderManagement', {
            orders,
            currentPage: page,
            totalPages,
            query: req.query,
            searchParamsExceptPage: paramsStr
        });
    } catch (error) {
        console.log('Error while loading order page', error.message);
        res.status(500).render('user/error', {
            title: 500,
            message: "Server error"
        });
    }
};





const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;

        const { status } = req.body;
       
        if (!orderId || !status) return res.status(400).json({ success: false, message: 'Invalid payload' });
        const order = await Order.findOne({ orderId }).populate('orderedItems.productId')
        console.log(order)
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        order.status = status
        order.orderedItems.forEach((item) => {
            if (item.status !== 'Cancelled' && item.status !== 'Delivered' && item.status !== 'Return Request' && item.status !== 'Returned'){
            item.status = status
            }
        })
        if (status === 'Delivered') {
            order.paymentStatus = "Completed"

        }
        await order.save()
        return res.json({ success: true, status: order.status });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Update failed' });
    }
}

const getPendingReturnsCount = async (req, res) => {
    try {
        const [result] = await Order.aggregate([
            { $unwind: "$orderedItems" },
            { $match: { "orderedItems.status": "Return Request" } },
            { $count: "totalReturnRequests" }
        ]);

        const totalReturnRequests = result ? result.totalReturnRequests : 0;

      
       
        return res.json({ count: totalReturnRequests  });
    } catch {
        return res.json({ count: 0 });
    }
};



const getReturnedOrder = async (req, res) => {
    try {

        const orders = await Order.find({ "orderedItems.status": "Return Request" }).populate('orderedItems.productId').populate('userId')

        const user = await User.findById(req.session.user)

        if (!orders || orders.length < 1) {
            return res.render('verifyOrderReturn', { orders: [], user })
        }


        return res.render("verifyOrderReturn", { orders, user })
    } catch (error) {
        console.log("error while return order verify page ", error.message)
    }
}




const verifyOrderReturn = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;

        const order = await Order.findOne({ orderId })
            .populate('orderedItems.productId');
        if (!order) {
            return res.json({ success: false, message: 'Invalid request Order not found' });
        }

        const item = order.orderedItems.find(i => itemId.toString() === i._id.toString());
        if (!item) {
            return res.json({ success: false, message: 'Product not found' });
        }
        if (item.status !== 'Return Request' && item.status !== 'Delivered') {
            return res.json({ success: false, message: 'Invalid return state for this item' });
        }

        const userId = order.userId;

        // Compute item total
        const unitPrice = Number.isFinite(Number(item.price)) ? Number(item.price) : Number(item.productId?.price) || 0;
        const quantity = Number(item.quantity) || 0;
        const itemTotal = unitPrice * quantity;

        // Subtotal of all active (non-cancelled and non-returned) items before this approval
        const activeSubtotal = order.orderedItems.reduce((sum, i) => {
            if (i._id.toString() === item._id.toString()) {
                // include current item
            } else if (i.status === 'Cancelled' || i.status === 'Returned') {
                return sum;
            }
            const p = Number.isFinite(Number(i.price)) ? Number(i.price) : Number(i.productId?.price) || 0;
            const q = Number(i.quantity) || 0;
            return sum + (p * q);
        }, 0);

        if (!Number.isFinite(itemTotal) || itemTotal <= 0) {
            return res.json({ success: false, message: 'Invalid item total for refund' });
        }
        if (!Number.isFinite(activeSubtotal) || activeSubtotal <= 0) {
            return res.json({ success: false, message: 'Invalid order total' });
        }

        const newBalanceSubtotal = activeSubtotal - itemTotal;

        // Start from full item price, then adjust for coupon rules
        let baseRefund = itemTotal;
        const amountPaidRemaining = Number(order.finalAmount) || 0; // includes shipping already paid
        const hadCouponApplied = !!order.couponApplied && !!order.couponCode;

        let couponDoc = null;
        if (hadCouponApplied) {
            couponDoc = await Coupon.findOne({ code: order.couponCode }).lean();
        }

        let couponRevoked = false;
        let newCouponDiscount = Number(order.couponDiscount || 0);

        if (hadCouponApplied && couponDoc) {
            if (newBalanceSubtotal < Number(couponDoc.minPurchase || 0)) {
                // Lose eligibility: the first return approval absorbs the full remaining coupon discount
                baseRefund = Math.max(0, itemTotal - Number(order.couponDiscount || 0));
                couponRevoked = true;
                newCouponDiscount = 0;
            } else {
                // Still eligible: prorate discount on this item
                if (couponDoc.discountType === 'flat') {
                    const flat = Number(couponDoc.discount) || 0;
                    const couponShare = Math.ceil((itemTotal / activeSubtotal) * flat);
                    baseRefund = Math.max(0, itemTotal - couponShare);
                    newCouponDiscount = Math.max(0, Number(order.couponDiscount || 0) - couponShare);
                } else {
                    const pct = Number(couponDoc.discount) || 0;
                    const couponShare = Math.ceil((pct / 100) * itemTotal);
                    baseRefund = Math.max(0, itemTotal - couponShare);
                    newCouponDiscount = Math.max(0, Number(order.couponDiscount || 0) - couponShare);
                }
            }
        }

        // Cap refund so cumulative refunds never exceed amount paid
        const refundAmount = Math.min(baseRefund, amountPaidRemaining);

        // Update order monetary fields: keep shipping charge unchanged; lower payable by refund
        order.totalPrice = Math.max(0, newBalanceSubtotal);
        order.finalAmount = Math.max(0, amountPaidRemaining - refundAmount);
        order.couponDiscount = newCouponDiscount;
        order.discountPrice = newCouponDiscount;

        if (couponRevoked) {
            const prevCode = order.couponCode;
            order.couponApplied = false;
            order.couponDiscount = 0;
            order.discountPrice = 0;
            order.couponCode = null;
            if (prevCode) {
                await Coupon.updateOne(
                    { code: prevCode },
                    {
                        $pull: {
                            usedBy: {
                                userId: new mongoose.Types.ObjectId(userId),
                                orderId: order._id
                            }
                        }
                    }
                );
            }
        }

        // Always credit refund to wallet for returns, regardless of payment method
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
                            date: new Date()
                        }
                    }
                },
                { upsert: true }
            );
            if (!walletUpdate.acknowledged) {
                return res.json({ success: false, message: 'Failed to update wallet' });
            }
        }

        // Mark item returned
        item.status = 'Returned';
        item.adminApprovalStatus = 'Approved';

        // Update order status rollup
        const allOrderReturnCheck = order.orderedItems.every(i => i.status === 'Returned');
        const OrderDeliveredStatus = order.orderedItems.some(i => i.status === 'Delivered');

        if (allOrderReturnCheck) {
            order.status = 'Returned';
            if (order.finalAmount === 0) {
                order.paymentStatus = 'Refunded';
            }
        } else if (OrderDeliveredStatus) {
            order.status = 'Delivered';
        }

        await order.save();

        // Restore stock
        if (item && item.productId) {
            item.productId.quantity += item.quantity;
            await item.productId.save();
        }

        return res.json({ success: true });
    } catch (error) {
        console.log('error while updating verify orderReturn ', error.message);
        return res.json({ success: false, message: 'Something went wrong please try again' });
    }
};



const cancelReturnRequest = async (req, res) => {
    try {
        const { orderId, itemId } = req.params

        const { reason } = req.body

        if (!reason || reason.length < 3 || reason.length > 50) {
            return res.json({ success: false, message: "reason required or reason length must be 3-50 characters" })
        }

        const order = await Order.findOne({ orderId }).populate('orderedItems.productId')

        if (!order) {
            return res.json({ success: false, message: "order not found" })
        }

        const item = order.orderedItems.find((item) => item._id.toString() === itemId.toString())

        if (!item || item.status !== 'Return Request') {
            return res.json({ success: false, message: "Item not found or Item return request is invalid" })
        }

        item.adminRejectionReason = reason
        item.adminApprovalStatus = 'Rejected'
        item.status = "Delivered"

        await order.save()

        const allOrderReturnCheck = order.orderedItems.every(item => item.status === 'Returned');
        const OrderDeliveredStatus = order.orderedItems.some(item => item.status === "Delivered");

        if (allOrderReturnCheck) {
            order.status = 'Returned';
        }
        if (OrderDeliveredStatus) {
            order.status = "Delivered";
        }

        res.json({ success: true })
    } catch (error) {
        console.log("error while cancel return request ", error.message)
        return res.json({ success: false, message: "Something went wrong please try again" })
    }
}

const viewOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;

        if (!orderId || typeof orderId !== "string") {
            return res.render('admin/viewOrderDetails', { order: null, user: null});
        }

        const order = await Order.findOne({ orderId })
            .populate('orderedItems.productId')

        if (!order) {
            return res.render('admin/viewOrderDetails', { order: null, user: null });
        }

        const userId = order.userId;
        if (!userId) {
            return res.render('admin/viewOrderDetails', { order, user: null});
        }

        const user = await User.findById(userId).lean();
        if (!user) {
            return res.render('admin/viewOrderDetails', { order, user: null});
        }

       
        return res.render('admin/viewOrderDetails', {
            order,
            user,
        });

    } catch (error) {
        console.error("Error in viewOrderDetails:", error);
        return res.render('admin/viewOrderDetails', { order: null, user: null, address: null });
    }
};


module.exports = {
    loadOrderPage,
    updateOrderStatus,
    getPendingReturnsCount,
    getReturnedOrder,
    verifyOrderReturn,
    cancelReturnRequest,
    viewOrderDetails
}