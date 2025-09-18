const Cart = require('../../models/cartSchema')
const User = require('../../models/userSchema')
const Address = require('../../models/addressSchema')
const Product = require('../../models/productSchema')
const Order = require('../../models/orderSchema')
const Wallet = require('../../models/walletSchema')
const Category = require('../../models/categorySchema')
const mongoose = require("mongoose");
const Coupon = require('../../models/couponSchema')

const loadCheckoutPage = async (req, res) => {
  
    try {
        const userId = req.session.user;
        const user = userId ? await User.findById(userId) : undefined;

        const cart = await Cart.findOne({ userId }).populate('items.productId');

        const addresses = await Address.find({ userId }) || [];

        const wallet = await Wallet.findOne({userId})
        
        let offer = 0

        if (!cart || !cart.items || cart.items.length === 0 ) {
            return res.render('user/checkout', {
                user,
                cartItems: [],
                subTotal: 0,
                tax: 0,
                shipping: 0,
                total: 0,
                addresses,
                wallet,
                offer : offer || 0,
                discount:0
            });
        }


        let subTotal = 0;
        const validItems = cart.items.filter(item => {
            const product = item.productId;
            return product && !product.isBlocked && !product.isDeleted && product.quantity >= 1;
        });



        const cartItems = validItems.map(item => {
            if (item.productId.status === 'Out Of Stock') {
                return res.json({ success: false, message: `${item.productName} is out of stock` })
            }
            const product = item.productId;
            const price = Number(product.salesPrice) || 0;
            const safeQuantity = Math.min(item.quantity, product.quantity || 1);
            const itemTotal = price * safeQuantity;
            offer += (product.regularPrice - product.salesPrice) * item.quantity

            subTotal += itemTotal;

            return {
                _id: product._id,
                name: product.productName || 'Unnamed Product',
                price: price,
                quantity: safeQuantity,
                image: product.productImage?.[0]?.url || '/images/placeholder.jpg',
                totalPrice: itemTotal,
                offer: Math.abs(offer) || 0,
                discount:0
            };
        });


        const tax = Math.round(subTotal * 0.05);
        const shipping = subTotal >= 1000 ? parseInt(0) : parseInt(50);
        const total = Number(subTotal + tax + shipping);



        return res.render('user/checkout', {

            user,
            cartItems,
            subTotal,
            tax,
            addresses,
            shipping,
            total,
            wallet,
            offer: offer || 0,
            discount:0
       
        });

    } catch (error) {
        console.error("Error loading checkout page:", error.message);
        res.status(500).render('error', {
            title: "Checkout Error",
            message: "Something went wrong while loading the checkout page."
        });
    }
};


const validateCheckout = async (req, res) => {
    try {
        const userId = req.session.user
        const user = await User.findById(userId)
        const cart = await Cart.findOne({ userId }).populate("items.productId")

        if (!cart || !cart.items || cart.items.length < 1) {
            return res.json({ success: false, message: "invalid request cart not found" })
        }
        let outOfStockItems = []


        for (let item of cart.items) {
            const product = item.productId

            if (!product || product.isBlocked || product.isDeleted || product.quantity < item.quantity) {
                outOfStockItems.push({
                    name: product?.productName || "unknown Product",
                    reason: product.isBlocked ? "Blocked" : "Out of stock"
                })
            }
        }

        if (outOfStockItems.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Some Products are not available",
                item: outOfStockItems
            })
        }

        return res.json({ success: true })

    } catch (error) {
        console.log("Error validate Checkout", error.message)
        return res.status(500).json({ success: false, message: "Something went wrong" })
    }
}

const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { totalPrice, discountPrice, finalPrice, address, paymentMethod } = req.body;

        if (!address) {
            return res.json({ success: false, message: "Please select a address to continue" });
        }
        if (!paymentMethod) {
            return res.json({ success: false, message: "Please select a payment method" });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart || !cart.items || cart.items.length < 1) {
            return res.json({ success: false, message: "Cart items not found" });
        }

        const userAddress = await Address.findById(address);
        if (!userAddress) {
            return res.json({ success: false, message: "Invalid address" });
        }

        function generateOrderId() {
            const timestamp = Date.now().toString().slice(-5);
            const random = Math.floor(Math.random() * 90000 + 10000);
            return "ORD" + timestamp + random;
        }

        const orderId = generateOrderId();
        const orderedItems = [];

        for (let item of req.body.orderedItems) {
            const product = await Product.findById(item.productId);

            if (!product || item.quantity > product.quantity) {
                return res.json({ success: false, message: `Insufficient stock for ${product?.productName}` });
            }
            if (item.quantity > 10) {
                return res.json({ success: false, message: "Only 10 quantity approved" });
            }

            product.quantity -= item.quantity;
            await product.save();

            orderedItems.push({
                productId: product._id,
                quantity: item.quantity,
                price: product.salesPrice,
                status: paymentMethod === "COD" ? "Pending" : "Processing"
            });
        }

      
        const subTotalAgg = await Cart.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $unwind: "$items" },
            { $group: { _id: null, total: { $sum: "$items.totalPrice" } } }
        ]);

        const originalAmount = subTotalAgg[0]?.total || 0;
        const tax = Math.round(originalAmount * 0.05);
        const shipping = finalPrice >= 1000 ? 0 : 50;

        const status = paymentMethod === "COD" ? "Pending" : "pending";
        const paymentStatus = paymentMethod === "COD" ? "Pending" : "pending";

      
        let couponApplied = false;
        let couponCode = null;
        let couponDiscount = 0;

        if (req.session.applyCoupon) {
            const { newTotal, discount, Code } = req.session.applyCoupon;
            couponApplied = true;
            couponCode = Code;
            couponDiscount = discount;
        }
        console.log("coupon applied",req.session.applyCoupon)

      
        const newOrder = new Order({
            userId,
            orderId,
            orderedItems,
            totalPrice: originalAmount,     
            discountPrice: couponDiscount,   
            finalAmount: finalPrice,         
            originalAmount: originalAmount,  
            couponApplied,
            couponCode,
            couponDiscount,
            address,
            tax,
            shippingCharge: shipping,
            status,
            paymentStatus,
            createdOn: Date.now(),
            paymentMethod,
            fullName: userAddress?.fullName,
            mobileNumber: userAddress?.mobileNumber,
            address: userAddress?.address,
            city: userAddress?.city,
            district: userAddress?.district,
            state: userAddress?.state,
            landmark: userAddress?.landmark,
            pinCode: userAddress?.pinCode,
            addressType: userAddress?.addressType
        });

        await newOrder.save();

        if(req.session.applyCoupon){
            const updatedCoupon = await Coupon.findOneAndUpdate(
                { code: couponCode },
                {
                    $inc: { usedCount: 1 },
                    $push: {
                        usedBy: {
                            userId: new mongoose.Types.ObjectId(req.session.user),
                            orderId: newOrder._id,
                            usedAt: new Date()
                        }
                    }
                },
                { new: true } 
            );

            

        
    }

       
        await Cart.updateOne(
            { userId },
            { $pull: { items: { productId: { $in: orderedItems.map(i => i.productId) } } } }
        );

        return res.json({
            success: true,
            message: "Order placed successfully",
            orderId: newOrder.orderId,
            orderDetails: newOrder
        });
    } catch (error) {
        console.log("Error while placing Order", error.message);
        return res.json({ success: false, message: "Something went wrong. Please try again" });
    }
};


const loadOrderSuccess = async (req, res) => {
    try {
       

        const orderId = req.query.orderId

        const order = await Order.findOne({ orderId })
        console.log("order in success page",order)
        if (!order) {
            return res.redirect('/cart')
        }
        
        res.render('orderSuccessPage', { order })
    } catch (error) {
        console.log("Error while loading success Page", error.message)
        return res.json({ success: false, message: "something went wrong Please try again" })
    }
}




module.exports = {
    loadCheckoutPage,
    validateCheckout,
    placeOrder,
    loadOrderSuccess
}


