const Order = require('../../models/orderSchema')
const User = require('../../models/userSchema')
const Address = require('../../models/addressSchema')


const loadOrderDetails = async (req, res) => {
    try {
        const orderId = req.query.orderId;

        if (!orderId) {
            return res.status(500).render("error", {
                title: "500",
                message: "invalid request"
            })
        }
        const userId = req.session.user;
        const user = await User.findById(userId);

        const order = await Order.findOne({ orderId }).populate('orderedItems.productId');

        if (!order || order.orderedItems.length < 1) {
            return res.render('error', { title: 404, message: "not found" });
        }
        const address = await Address.findById(order.address);

        const canReturn = order.status === "Delivered";

        return res.render('orderDetails', { order, user, address, canReturn });
    } catch (error) {
        console.log("error while loading order details page", error.message);
        return res.render('error', {
            title: "Error",
            message: "Something went wrong .Please try again"
        })
    }
}


const loadMyOrder = async (req, res) => {
    try {
        const userId = req.session.user
        const user = await User.findById(userId)
        const order = await Order.find({ userId: userId }).populate('orderedItems.productId')
        console.log(order)
        if (!order || order.length < 1) {
            return res.render('orderList', { order: null, user: user || null, address: null });
        }
        res.render("orderList", { order, user })

    } catch (error) {
        console.log("Error happen while loadMyOrder page", error.message)
        return res.status(500).render('error', {
            title: "500",
            message: "Something went wrong"
        })
    }
}


const cancelProduct = async (req, res) => {
    try {
        const reason = req.body.reason
        const orderId = req.params.orderId
        const itemId = req.params.itemId

        if (!orderId || !itemId) {
            return res.json({ success: false, message: "Invalid request" })
        }

        if (!reason || reason.trim().length < 6 || reason.trim().length > 50) {
            return res.json({ success: false, message: "Reason is required or reason must be at least 6-50 character" })
        }

        const order = await Order.findOne({ orderId }).populate("orderedItems.productId")

        const item = order.orderedItems.find(item => item._id.toString() === itemId);


        if (!item) {
            return res.json({ success: false, message: "ordered product not found in this order" })
        }

        item.status = "Cancelled";
        item.cancellationReason = reason

        let allCancelled = true
        for (let item of order.orderedItems) {
            if (item.status !== "Cancelled") {
                allCancelled = false
                break
            }
        }
        if (allCancelled) {
            order.status = "Cancelled"
        }

        await order.save()

        return res.json({ success: true })

    } catch (error) {
        console.log("error happened in product cancel page ", error.message)
        return res.json({ success: false, message: "something went wrong. Please try again" })
    }
}


const cancelOrder = async (req, res) => {
    try {
        const reason = req.body.reason
        const orderId = req.params.orderId
        console.log(orderId)
        if (!orderId) {
            return res.json({ success: false, message: "invalid request" })
        }

        if (!reason || reason.trim().length < 6 || reason.trim().length > 50) {
            return res.json({ success: false, message: "Reason is required or reason must be at least 6-50 character" })
        }

        const order = await Order.findOne({ orderId })

        if (!order) {
            return res.json({ success: false, message: "Order not found" })
        }


        order.orderedItems.forEach(item => {
            item.status = "Cancelled",
                item.cancellationReason = reason
        })

        order.status = "Cancelled"
        order.cancellationReason = reason

        await order.save()

        return res.json({ success: true, message: "order has been cancelled" })
    } catch (error) {
        console.log("error in order cancel page", error.message);
        return res.json({ success: false, message: "Something went wrong" })
    }
}





module.exports = {
    loadOrderDetails,
    loadMyOrder,
    cancelProduct,
    cancelOrder
}