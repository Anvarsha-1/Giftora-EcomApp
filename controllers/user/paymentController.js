const createRazorpayInstance = require('../../config/paymentConfig')
const Order = require('../../models/orderSchema')
require('dotenv').config()
const crypto = require('crypto')
const mongoose = require("mongoose");
const Cart = require('../../models/cartSchema.js')
const User  =  require('../../models/userSchema.js')
const Address = require('../../models/addressSchema')
const Product = require('../../models/productSchema.js')

const razorPayInstance = createRazorpayInstance()

const createOrder = async (req, res) => {
    try {
        const {addressId} = req.body;
        const userId = req.session.user;

        const user = await User.findById(userId);
        const userAddress = await Address.findById(addressId)   

        const cart = await Cart.findOne({ userId })
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }
       

        const result = await Cart.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $unwind: "$items" },
            { $group: { _id: null, total: { $sum: "$items.totalPrice" } } }
        ]);

        const subtotal = result.length > 0 ? result[0].total : 0;
        const shippingFee = subtotal >= 1000 ? 0 : 50;
        const tax = subtotal * 0.05
        const amount = subtotal + shippingFee + tax ;

   
        const options = {
            amount: Number(amount * 100), 
            currency: "INR",
            receipt: "receipt_" + Date.now(),
        };

        const razorpayOrder = await razorPayInstance.orders.create(options);
       
       
        return res.json({
            success: true,
            razorpayOrder,
            user,
            userAddress,
        });
    } catch (error) {
        console.error("Error on create order:", error.message);
        return res.status(500).json({ success: false, message: "Something went wrong" });
    }
};

 
const getApiKey = async(req,res)=>{
    try{
      res.status(200).json({
          key: process.env.RAZORPAY_KEY_ID
      })
    }catch(error){

    }
}


const verifyPayment = async (req, res) => {
    try {
      
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, addressId } = req.body;

        const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
        const generatedSignature = hmac.digest("hex");

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: "Payment not verified" });
        }

      
        const userId = req.session.user;
      
        const user = await User.findById(userId);
        const userAddress = await Address.findById(addressId);
        const cart = await Cart.findOne({ userId }).populate("items.productId");
      

        const orderItems = cart.items.map((item) => ({
            productId: item.productId._id,
            quantity: item.quantity,
            price: item.price,
            status: "Pending",
        }));

        function generateOrderId() {
            const timestamp = Date.now().toString().slice(-5);
            const random = Math.floor(Math.random() * 90000 + 10000);
            return timestamp + random;
        }

        const orderId = "ORD" + generateOrderId()
        

        const result = await Cart.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $unwind: "$items" },
            { $group: { _id: null, total: { $sum: "$items.totalPrice" } } }
        ]);

        const subtotal = result.length > 0 ? result[0].total : 0;
        const shippingFee = subtotal >= 1000 ? 0 : 50;
        const tax = subtotal * 0.05
        const amount = subtotal + shippingFee + tax;


        const newOrder = await Order.create({
            userId,
            orderId: orderId,
            orderedItems: orderItems,
            totalPrice: amount,
            finalAmount: amount,
            fullName: userAddress.fullName,
            mobileNumber: userAddress.mobileNumber,
            address: userAddress.address,
            city: userAddress.city,
            state: userAddress.state,
            district: userAddress.district,
            pinCode: userAddress.pinCode,
            landmark: userAddress.landmark,
            status: "Processing",
            paymentStatus: "Completed",
            paymentMethod: "ONLINE",
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
        });

       

      
        await Cart.findOneAndUpdate(
            { userId },
            { $set: { items: [] } },
            { new: true }   
        );
       


        for (let item of newOrder.orderedItems) {
            await Product.findByIdAndUpdate(
                item.productId,
                { $inc: { quantity: -item.quantity } }
            );
        }
        console.log(newOrder)

        res.json({ success: true, order: newOrder });
    } catch (error) {
        console.error("Verify payment error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};



const paymentFailureHandler = async(req,res)=>{
    try{
      const orderId  = req.body.orderId

      const order = await Order.findById(orderId);

      if(!order){
        return res.status(400).json({success:false,message:'Order not found'})
      }
        order.paymentStatus = 'Failed'
        order.status = 'Cancelled'
        await order.save();

        for (let item of order.orderedItems) {
            if (item.productId) {
                await Product.updateOne({ _id: item.productId }, { $inc: { quantity: item.quantity } });
            }
        }

        return res.json({success:true,message:'Order marked as failed'})
    }catch(error){
        console.log("Error happened in payment failure page",error.message)
         return res.json({success:false,message:"Something went wrong please try again"})
    }
}

const loadPaymentFailurePage = async(req,res)=>{
    try{
       const orderId= req.params.orderId
       console.log('order failure',orderId)
        
     return res.render('user/paymentFailure',{orderId})
    }catch(error){

    }
}
module.exports={
    createOrder,
    verifyPayment,
    getApiKey,
    paymentFailureHandler,
    loadPaymentFailurePage
}