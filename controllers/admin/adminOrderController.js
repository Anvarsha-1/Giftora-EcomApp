const Order = require('../../models/orderSchema')
const Wallet = require('../../models/walletSchema.js')
const User = require('../../models/userSchema')
const Address = require('../../models/addressSchema')

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
        console.log(status)
        if (!orderId || !status) return res.status(400).json({ success: false, message: 'Invalid payload' });
        const order = await Order.findOne({ orderId }).populate('orderedItems.productId')
        console.log(order)
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        order.status = status
        order.orderedItems.forEach((item) => {
            item.status = status
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


const TAX_RATE = 0.05;

const verifyOrderReturn = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;

        const order = await Order.findOne({ orderId })
            .populate('orderedItems.productId');
        if (!order) {
            return res.json({ success: false, message: "Invalid request Order not found" });
        }

        const product = order.orderedItems.find(item =>
            itemId.toString() === item._id.toString()
        );
        if (!product) {
            return res.json({ success: false, message: "Product not found" });
        }

        const userId = order.userId

        let wallet = await Wallet.findOne({ userId });


        const itemTotal = product.price * product.quantity;
        const orderTotal = order.orderedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
        const totalTax = orderTotal * TAX_RATE;
        const itemTaxShare = (itemTotal / orderTotal) * totalTax;
        const refundAmount = itemTotal + itemTaxShare





        if (!wallet) {

            wallet = new Wallet({
                userId,
                balance: refundAmount,
                transactions: [{
                    type: 'credit',
                    amount: refundAmount,
                    description: `Refund for returned item ${product.productId?.productName}`,
                    date: Date.now()
                }]
            });

            await wallet.save();
        } else {

            wallet.balance += refundAmount;
            wallet.transactions.push({
                type: 'credit',
                amount: refundAmount,
                description: `Refund for returned item ${product.productId?.productName}`,
            });
            await wallet.save();
        }




        product.status = "Returned";
        product.adminApprovalStatus = 'Approved';

        const allOrderReturnCheck = order.orderedItems.every(item => item.status === 'Returned');
        const OrderDeliveredStatus = order.orderedItems.some(item => item.status === "Delivered");

        if (allOrderReturnCheck) {
            order.status = 'Returned';
        }
        if (OrderDeliveredStatus) {
            order.status = "Delivered";
        }

        await order.save();

        if (product && product.productId) {
            product.productId.quantity += product.quantity
            await product.productId.save();
        }


        return res.json({ success: true });
    } catch (error) {
        console.log("error while updating verify orderReturn ", error.message);
        return res.json({ success: false, message: "Something went wrong please try again" });
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