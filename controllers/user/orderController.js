const Order = require('../../models/orderSchema')
const User = require('../../models/userSchema')
const Address = require('../../models/addressSchema')
const BuildPDF = require('../../helpers/pdf-service')



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
        const order = await Order.find({ userId: userId }).populate('orderedItems.productId').populate('address')

        if (!order || order.length < 1) {
            return res.render('orderList', { order: null, user: user || null });
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

        if(item && item.productId){
            item.productId.quantity+=item.quantity
            await item.productId.save()
        }

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

        if (!orderId) {
            return res.json({ success: false, message: "invalid request" })
        }

        if (!reason || reason.trim().length < 6 || reason.trim().length > 50) {
            return res.json({ success: false, message: "Reason is required or reason must be at least 6-50 character" })
        }

        const order = await Order.findOne({ orderId }).populate('orderedItems.productId')

        if (!order) {
            return res.json({ success: false, message: "Order not found" })
        }

        
        for (let item of order.orderedItems) {
            const wasPendingOrShipped = (item.status === 'Pending' || item.status === 'Shipped');
            if(item.status==='Pending'){
            item.status = "Cancelled";
            item.cancellationReason = reason;
            }

            if (wasPendingOrShipped) {
                item.productId.quantity += item.quantity;
                await item.productId.save();
            }
        }
       

        order.status = "Cancelled"
        order.cancellationReason = reason

        await order.save()   

        return res.json({ success: true, message: "order has been cancelled" })
    } catch (error) {
        console.log("error in order cancel page", error.message);
        return res.json({ success: false, message: "Something went wrong" })
    }
}


const downloadPdf = async (req, res) => {
    try {
        const orderId = req.params.orderId
        const order = await Order.findOne({ orderId }).populate("orderedItems.productId").lean()

        const addressId = order.address
        const address = await Address.findById(addressId)

        if (!order) {
            return res.json({ success: false, message: "order not found" })
        }
        const stream = res.writeHead(200, { "Content-Type": "application/pdf", 'Content-Disposition': `attachment; filename=invoice-${orderId}.pdf` })

        BuildPDF(order, address,
            (chunk) => stream.write(chunk),
            () => stream.end()
        )


    } catch (error) {

        console.log("Error in invoice page", error.message)
    }
}

const returnOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId
        console.log(orderId)
        const { reason } = req.body
        if (!orderId) {
            return res.json({ success: false, message: "Invalid request" })
        }
        if (!reason || reason.length < 3 || reason.length > 50) {
            return res.json({ success: false, message: "reason required or reason  must be 3-50 characters" })
        }

        const order = await Order.findOne({ orderId }).populate('orderedItems.productId')

        if (!order) {
            return res({ success: false, message: "Order not Found" })
        }

        order.status = 'Return Request'
        order.returnReason = reason
        order.returnedAt = Date.now()
        order.orderedItems.forEach((item) => {
            item.status = 'Return Request',
                item.returnReason = reason,
                item.itemReturnRequestAt = Date.now()
        })
        await order.save()
        return res.json({ success: true })
    } catch (error) {
        console.log("error while return order", error.message)
        return res.json({ message: false, message: "Something went wrong" })
    }
}

const returnItemRequest = async (req, res) => {
    try {
        const { orderId, itemId } = req.params

        const { reason } = req.body
        if (!orderId || !itemId) {
            return res.json({ success: false, message: "Invalid request " })
        }

        const order = await Order.findOne({ orderId }).populate('orderedItems.productId')
        if (!order) {
            return res.json({ success: false, message: "Order not found" })
        }
        const product = order.orderedItems.find((item) => item._id.toString() === itemId.toString())
        if (!product) {
            return res.json({ success: false, message: "Product not found" })
        }

        if (product.status === 'Delivered') {
            product.status = 'Return Request',
                product.returnReason = reason
            product.itemReturnRequestAt = Date.now()
        }

        await order.save()
        return res.json({ success: true })

    } catch (error) {
        console.log("Error while order Item Request", error.message)
        return res.json({ success: false, message: "Something went wrong" })
    }
}







module.exports = {
    loadOrderDetails,
    loadMyOrder,
    cancelProduct,
    cancelOrder,
    returnOrder,
    returnItemRequest,
    downloadPdf
}