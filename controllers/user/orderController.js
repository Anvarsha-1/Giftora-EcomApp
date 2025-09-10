const Order = require('../../models/orderSchema')
const User = require('../../models/userSchema')
const BuildPDF = require('../../helpers/pdf-service')
const Wallet = require('../../models/walletSchema.js')
const Product = require('../../models/productSchema.js')



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

        const canReturn = order.status === "Delivered";
        const orderHasReturn  = order.orderedItems.some((item)=>item.adminApprovalStatus==='Rejected')

        const subTotal = await Order.aggregate([
            { $match: { orderId: orderId } },    
            { $unwind: '$orderedItems' },         
            {
                $group: {
                    _id: null,                       
                    total: { $sum: '$orderedItems.price' }
                }
            }
        ]);
        
        const totalAmount = subTotal.length > 0 ? subTotal[0].total : 0;
        const tax = Math.floor(totalAmount*0.05)
        const shipping = totalAmount >1000 ? 0 : 50

        return res.render('orderDetails', { order, user, canReturn, tax, shipping, subTotal: totalAmount, orderHasReturn: orderHasReturn });
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
        const userId = req.session.user
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
        
        if(item.status==='Cancelled'){
            return res.json({success:false,message:"Item already cancelled"})
        }else if(item.status==='Delivered'){
            return res.json({success:false,message:"cannot return delivered item"})
        }

        item.status = "Cancelled";
        item.cancellationReason = reason

        const allCancelled = order.orderedItems.every(i => i.status === "Cancelled");
        if (allCancelled) order.status = "Cancelled";



        await order.save()

        if (item?.productId) {
            await Product.updateOne(
                { _id: item.productId._id },
                { $inc: { quantity: item.quantity } }
            );
        }

        const product = order.orderedItems.find(item =>
            itemId.toString() === item._id.toString()
        );

        if (!product) {
            return res.json({ success: false, message: "Product not found" });
        }

        const OnlinePayment = order.paymentMethod === 'ONLINE'


        if (OnlinePayment){
     
        
                const itemTotal = product.price * product.quantity;
                const orderTotal = order.orderedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
                const totalTax = orderTotal * order.tax;
                const itemTaxShare = (itemTotal / orderTotal) * totalTax;
                const refundAmount = itemTotal + itemTaxShare


        
        const wallet = await Wallet.updateOne({ userId },
            {
                $inc: { amount: refundAmount },
                $push: {
                    transactions: {
                        type: 'credit',
                        amount: refundAmount,
                        description: `Refund for cancel order ${orderId}`,
                        date: Date.now()

                    }
                }
            },
            { $upsert: true }
        )
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
        const userId = req.session.user

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
            if (item.status === 'Pending') {
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
        let refundAmount = order.totalPrice

        const wallet  =  await Wallet.updateOne({userId},
            {$inc:{amount:refundAmount},
            $push:{ transactions:{
                type:'credit',
                amount:refundAmount,
                description:`Refund for cancel order ${orderId}`,
                date:Date.now()

            }}},
            {$upsert:true}
        )
        
        
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

       

        if (!order) {
            return res.json({ success: false, message: "order not found" })
        }
        const stream = res.writeHead(200, { "Content-Type": "application/pdf", 'Content-Disposition': `attachment; filename=invoice-${orderId}.pdf` })

        BuildPDF(order,
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
        
        let hasRejectedItem =  order.orderedItems.some((val)=>val.adminApprovalStatus==='Rejected')
       if(hasRejectedItem){
        return res.json({success:false,message:"Product return request rejected. Already returned rejected product"})
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