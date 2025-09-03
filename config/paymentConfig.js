const RazorPay = require('razorpay')
require('dotenv').config()



const createRazorpayInstance = () => {
    return new RazorPay({
        key_id: process.env.Razorpay_key_id,
        key_secret: process.env.Razorpay_key_secret,
    });
}

module.exports=createRazorpayInstance
