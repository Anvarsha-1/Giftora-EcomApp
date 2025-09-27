const createRazorpayInstance = require('../../config/paymentConfig')
const Order = require('../../models/orderSchema')
require('dotenv').config()
const crypto = require('crypto')
const mongoose = require("mongoose");
const Cart = require('../../models/cartSchema.js')
const User = require('../../models/userSchema.js')
const Address = require('../../models/addressSchema')
const Product = require('../../models/productSchema.js')
const Coupon = require('../../models/couponSchema.js')
const UserCoupon = require('../../models/Referral-Coupon-Schema.js')

const razorPayInstance = createRazorpayInstance()

const createOrder = async (req, res) => {
    try {
        const { addressId } = req.body;
        const userId = req.session.user;

        
        if (!addressId || !mongoose.Types.ObjectId.isValid(addressId)) {
            return res.status(400).json({ success: false, message: "Invalid address selected. Please choose a valid address." });
        }

        const user = await User.findById(userId);
        const userAddress = await Address.findById(addressId);
        const cart = await Cart.findOne({ userId }).populate("items.productId");

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        // --- Stock and Quantity Validation ---
        const MAX_QTY_PER_ITEM = 10;
        let outOfStockItems = [];

        for (const item of cart.items) {
            const product = item.productId;
            if (!product || product.isBlocked || product.isDeleted) {
                outOfStockItems.push({
                    name: product?.productName || "Unknown Product",
                    reason: "This product is no longer available."
                });
            } else if (product.quantity < item.quantity) {
                // This is the specific check for product quantity vs. cart quantity
                outOfStockItems.push({
                    name: product.productName,
                    reason: `Only ${product.quantity} left in stock, but you have ${item.quantity} in your cart.`
                });
            }
            if (item.quantity > MAX_QTY_PER_ITEM) {
                return res.status(400).json({ success: false, message: `Cannot order more than ${MAX_QTY_PER_ITEM} units of ${product.productName}.` });
            }
        }

        if (outOfStockItems.length > 0) {
            return res.status(400).json({ success: false, message: "Some products are not available.", item: outOfStockItems });
        }

        const orderItems = cart.items.map((item) => ({
            productId: item.productId._id,
            quantity: item.quantity,
            price: item.price,
            status: "Pending",
        }));



        function generateOrderId() {
            const timestamp = Date.now().toString().slice(-5);
            const random = Math.floor(Math.random() * 90000 + 10000);
            return "ORD" + timestamp + random;
        }


        const result = await Cart.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $unwind: "$items" },
            { $group: { _id: null, total: { $sum: "$items.totalPrice" } } }
        ]);

        const subtotal = result.length > 0 ? result[0].total : 0;
        const shippingFee = subtotal >= 1000 ? 0 : 50;
        let amount = subtotal + shippingFee ;

        let couponCode = null
        let couponApplied = false
        let couponDiscount = 0

        if(req.session.applyCoupon){
            const { newTotal, discount, Code } = req.session.applyCoupon;
            couponCode = Code
            couponApplied = true
            couponDiscount = discount
            amount = newTotal
        }
        console.log(amount)


        const options = {
            amount: Math.round(amount * 100),
            currency: "INR",
            receipt: "receipt_" + Date.now(),
        };
        const razorpayOrder = await razorPayInstance.orders.create(options);

        // Create the order with a 'Pending' payment status BEFORE sending to Razorpay
        const newOrder = await Order.create({
            userId,
            couponCode,
            couponApplied,
            couponDiscount,
            shippingCharge: shippingFee,
            orderId: generateOrderId(),
            orderedItems: orderItems,
            totalPrice: subtotal,
            finalAmount: amount,
            originalAmount: amount,
            fullName: userAddress.fullName,
            mobileNumber: userAddress.mobileNumber,
            address: userAddress.address,
            city: userAddress.city,
            state: userAddress.state,
            district: userAddress.district,
            pinCode: userAddress.pinCode,
            landmark: userAddress.landmark,
            status: "Pending", // Initial status
            paymentStatus: "Pending", // Initial payment status
            paymentMethod: "ONLINE",
            razorpayOrderId: razorpayOrder.id
        });


        return res.json({
            success: true,
            razorpayOrder,
            user,
            userAddress,
            orderId: newOrder.orderId, // Pass the custom orderId to the frontend
        });

    } catch (error) {
        console.error("Error on create order:", error);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};



const getApiKey = async (req, res) => {
    try {
        res.status(200).json({
            key: process.env.RAZORPAY_KEY_ID
        })
    } catch (error) {

    }
}

const verifyPayment = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
        const userId = req.session.user;


        const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
        const generatedSignature = hmac.digest("hex");

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: "Payment not verified" });
        }

        // --- Start Transaction: Find the existing order and update it ---
        session.startTransaction();

        const order = await Order.findOne({ orderId }).session(session);
        if (!order) {
            throw new Error("Order not found during verification.");
        }

        order.paymentStatus = "Completed";
        order.status = "Processing";
        order.razorpayPaymentId = razorpay_payment_id;
        order.razorpaySignature = razorpay_signature;
        await order.save({ session });

       
        if (order.couponApplied && order.couponCode) {
            const coupon = await Coupon.findOne({ code: order.couponCode }).session(session);
            if (coupon) {
                coupon.usedCount += 1;
                coupon.usedBy.push({
                    userId: order.userId,
                    orderId: order._id,
                    usedAt: new Date()
                });
                await coupon.save({ session });

               
                if (coupon.isPersonalized) {
                    await UserCoupon.updateOne(
                        { couponId: coupon._id, userId: order.userId },
                        { isUsed: true, usedAt: new Date(), orderId: order._id },
                        { session }
                    );
                }
            }
        }

      
        delete req.session.applyCoupon;


        await Cart.findOneAndUpdate(
            { userId: order.userId },
            { $set: { items: [] } },
            { new: true, session }
        );


        for (let item of order.orderedItems) {
            const product = await Product.findOneAndUpdate(
                { _id: item.productId, quantity: { $gte: item.quantity } },
                { $inc: { quantity: -item.quantity } },
                { new: true, session }
            );
            if (!product) {
                throw new Error(`Insufficient stock for product ID: ${item.productId}`);
            }
        }

        await session.commitTransaction();

        return res.json({
            success: true,
            order: {
                orderId: order._id,
                customOrderId: order.orderId,
                paymentStatus: order.paymentStatus
            }
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        if (error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError')) {
            console.log("Write conflict during payment verification:", error.message);
            return res.status(409).json({
                success: false,
                message: "Someone else just bought the last item. Your payment was not processed. Please try again."
            });
        }
        if (error.message.startsWith('Insufficient stock')) {
            console.error("Stock conflict during payment verification:", error.message);
            return res.status(409).json({
                success: false,
                message: "Unfortunately, an item in your order just went out of stock. Your payment was not processed."
            });
        }
        console.error("Verify payment error:", error);
        res.status(500).json({ success: false, message: error.message || "Server error during payment verification." });
    } finally {
        session.endSession();
    }
};




const paymentFailureHandler = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const orderId = req.body.orderId
        // Find by the custom orderId, not the MongoDB _id
        const order = await Order.findOne({ orderId });

        if (!order) {
            return res.status(400).json({ success: false, message: 'Order not found' })
        }
        order.paymentStatus = 'Failed'
        await order.save({ session });

        for (let item of order.orderedItems) {
            if (item.productId) {
                await Product.updateOne({ _id: item.productId }, { $inc: { quantity: item.quantity } }, { session });
            }
        }

        await session.commitTransaction();

        return res.json({ success: true, message: 'Order marked as failed' })
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.log("Error happened in payment failure page", error.message)
        return res.json({ success: false, message: "Something went wrong please try again" })
    } finally {
        session.endSession();
    }
}


const loadPaymentFailurePage = async (req, res) => {
    try {
        const orderId = req.params.orderId
        if(!orderId){
            return res.json({success:false,message:"Order id not found"})
        }
        return res.render('user/paymentFailure', { orderId })
    } catch (error) {

    }
}

const loadRetryPayment = async(req,res)=>{
    try{
        const orderId = req.params.orderId
        const order = await Order.findOne({ orderId }).populate('orderedItems.productId')
        console.log(order)
        if (!order) {
            return res.status(404).render('user/error', { title: 404, message: "Order not found." });
        }
        return res.render('user/retryPaymentPage', {success:true, order})           
    }catch(error){
        console.error('retry Payment error',error.message)
        return res.json({success:false,message:"Something went wrong"})
    }
}

const retryPayment = async(req,res)=>{
    try{
      const {orderId}  = req.body
        const existingOrder = await Order.findOne({ orderId });

        if (!existingOrder) {
            return res.json({ success: false, message: "Order not found" });
        }
          
    
        const options = {
            amount: existingOrder.finalAmount * 100,
            currency: "INR",
            receipt: `retry_${orderId}_${Date.now()}`
        };

        const razorpayOrder = await razorPayInstance.orders.create(options);

       
        existingOrder.razorpayOrderId = razorpayOrder.id;
        await existingOrder.save();

        res.json({
            success: true,
            order: razorpayOrder,
            user: await User.findById(existingOrder.userId),
            existingOrder,
        });
    }catch(error){
       console.log("Error while retry payment ",error.message)
       return res.json({success:false,message:"Something went wrong"})
    }
}

module.exports = {
    createOrder,
    verifyPayment,
    getApiKey,
    paymentFailureHandler,
    loadPaymentFailurePage,
    loadRetryPayment,
    retryPayment
}