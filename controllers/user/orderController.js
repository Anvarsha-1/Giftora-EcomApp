const Order = require('../../models/orderSchema')
const User = require('../../models/userSchema')


const loadOrderDetails = async(req,res)=>{
    try{
        const orderId =  req.query.orderId
        const userId = req.session.user
        const user = await User.findById(userId) 
       
        const orders = await Order.find({ orderId }).sort({ createdOn: -1 }).populate('orderedItems.productId')
        console.log(orders)

        if (!orders || orders.length === 0) {
            return res.render('orderList', { orders: [] ,user});
        }

         return res.render('orderList',{orders,user})

    }catch(error){
          console.log("error while loading order details page",error.message);
          return res.render('error',{
            title:"Error",
            message:"Something went wrong .Please try again"
          })
    }
}



module.exports={
    loadOrderDetails
}