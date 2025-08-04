const Cart = require('../../models/cartSchema')
const User = require('../../models/userSchema')
const Address = require('../../models/addressSchema')
const Product = require('../../models/productSchema')
const Order = require('../../models/orderSchema')

const loadCheckoutPage = async (req, res) => {
    if (!req.session.allowCheckout){
        return res.redirect("/cart")
    }
    try {
        const userId = req.session.user;
        const user = userId ? await User.findById(userId) : undefined;

        const cart = await Cart.findOne({ userId }).populate('items.productId');

        const addresses = await Address.find({ userId }) || [];

        if (!cart || !cart.items || cart.items.length === 0) {
            return res.render('user/checkout', {
                user,
                cartItems: [],
                subTotal: 0,
                tax: 0,
                shipping: 0,
                total: 0,
                addresses,
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
            const price = Number(product.regularPrice) || 0;
            const safeQuantity = Math.min(item.quantity, product.quantity || 1);
            const itemTotal = price * safeQuantity;

            subTotal += itemTotal;

            return {
                _id: product._id,
                name: product.productName || 'Unnamed Product',
                price: price,
                quantity: safeQuantity,
                image: product.productImage?.[0]?.url || '/images/placeholder.jpg',
                totalPrice: itemTotal,
            };
        });


        const tax = Math.round(subTotal * 0.05);
        const shipping = subTotal >= 1000 ? 0 : 50;
        const total = subTotal + tax + shipping;
       


        return res.render('user/checkout', {
            
            user,
            cartItems,
            subTotal,
            tax,
            addresses ,
            shipping,
            total
        });

    } catch (error) {
        console.error("Error loading checkout page:", error.message);
        res.status(500).render('error', {
            title: "Checkout Error",
            message: "Something went wrong while loading the checkout page."
        });
    }
};

const placeOrder = async(req,res)=>{
    try{
        const userId =  req.session.user
       
        const { totalPrice, discountPrice, finalPrice, address, paymentMethod } = req.body

        if(!address){
            return res.json({success:false,message:"Please select a address to continue"})
        }
        if(!paymentMethod){
            return res.json({success:false,message:"Please select a payment method"})
        }
        
        const userAddress = await Address.findById(address)

        if(!userAddress){
            return res.json({success:false,message:"Invalid address"})
        }

        function generateOrderId() {
            const timestamp = Date.now().toString().slice(-5); 
            const random = Math.floor(Math.random() * 90000 + 10000);
            return timestamp + random; 
        }

       const orderId ="ORD" + generateOrderId()

       const orderedItems = []

        for(let item of req.body.orderedItems){

            const product = await Product.findById(item.productId)  
            
            if(!product || item.quantity>product.quantity){
                return res.json({success:false,message:`Insufficient stock for ${product?.productName} `})
            }
             product.quantity -= item.quantity
             await product.save()

            orderedItems.push({
                productId:product._id,
                quantity:item.quantity,
                price:product.regularPrice,
            })
        }
        
        

      
       const status = paymentMethod === "COD" ? "Pending" : 'Processing' 
       const newOrder = new Order({
        userId:userId,
        orderId,
        orderedItems,
        totalPrice,
        discountPrice,
        finalAmount:finalPrice,
        address,
        status,
        createdOn : Date.now(),
        paymentMethod

       })

        await newOrder.save() 
        req.session.allowSuccessPage = true
        await Cart.updateOne(
            { userId },
            { $pull: { items: { productId: { $in: orderedItems.map(i => i.productId) } } } }
           
        ); console.log(newOrder.orderId)
        return res.json({
            success: true,
            message: "Order placed successfully",
            orderId: newOrder.orderId,
            orderDetails: newOrder
        }); 
  
    }catch(error){
       console.log("Error while placing Order",error.message)
       return res.json({success:false,message:"Something went wrong. Please try again"})
    }
}

const loadOrderSuccess = async(req,res)=>{
    try{
       if(!req.session.allowSuccessPage){
        return res.redirect('/cart')
       }
       
       
       const orderId = req.query.orderId
       
       const order = await Order.findOne({orderId})
       if(!order){
         return res.redirect('/cart')
       }
       req.session.allowSuccessPage
        res.render('orderSuccessPage', { order })
    }catch(error){
        console.log("Error while loading success Page",error.message)
        return res.json({success:false,message:"something went wrong Please try again"})
    }
}

module.exports={
    loadCheckoutPage,
    placeOrder,
    loadOrderSuccess
}