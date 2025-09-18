const Coupon = require('../../models/couponSchema')
const Cart = require('../../models/cartSchema')
const mongoose = require('mongoose')
const loadCoupons = async (req, res) => {
    try {

        const page = parseInt(req.query.page) || 1
        const searchQuery = req.query.clear === '1' ? "" : (req.query.search) || ""
        const limit = 4
        const show = req.query.show
        const sortOptions = req.query.sort


        let filter = {
            $or: [{ code: { $regex: searchQuery, $options: "i" } },
            { description: { $regex: searchQuery, $options: "i" } }
            ], isDeleted: false
        }

        if (show === 'active') {
            filter.isActive = true
            filter.expiry = { $gt: new Date() }
        } else if (show === 'expired') {
            filter.expiry = { $lt: new Date() }
        } else if (show === "flat") {
            filter.discountType = 'flat'
        } else if (show === 'percentage') {
            filter.discountType = 'percentage'
        }

        let sort = {}

        switch (sortOptions) {
            case "oldest":
                sort = { createdAt: 1 };
                break;
            case "expiry-soon":
                sort = { expiry: 1 };
                break;
            case "most-used":
                sort = { usedCount: -1 };
                break;
            case "newest":
            default:
                sort = { createdAt: -1 };
                break;
        }

        const coupon = await Coupon.find(filter).sort(sort).skip((page - 1) * limit).limit(limit)
        const expiredCount = await Coupon.countDocuments({ expiry: { $lt: new Date() } })
        const couponIsActive = await Coupon.countDocuments({ $and: [{ isActive: true }, { expiry: { $gt: Date.now() } }] })
        const TotalCouponCount = await Coupon.countDocuments(filter)
        const totalPages = Math.ceil(TotalCouponCount / limit);
        const couponUserCount = await Coupon.aggregate([{ $group: { _id: null, usedCount: { $sum: "$userCount" } } }])
        const totalUsedCount = couponUserCount.length > 0 ? couponUserCount[0].usedCount : 0;

        return res.render('coupon-listing-page', {
            coupon,
            couponIsActive,
            TotalCouponCount,
            totalPages,
            searchQuery,
            couponUserCount,
            totalUsedCount,
            page,
            show,
            sort: sortOptions,
            expiredCount,
            limit
        })
    } catch (error) {
        console.log("Error while load LoadCoupon", error.message)
    }
}


const showAvailableCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.find({ isDeleted: false, isActive: true, expiry: { $gt: Date.now() } })
        if (!coupon) {
            return res.json({ success: false, message: "no coupon available" })
        }
     
        return res.json({ data: coupon })
    } catch (error) {
        console.log("Show available coupon", error.message)
        return res.json({ message: "Internal server error", success: false })
    }
}

const applyCoupon = async (req, res) => {
    try {
        const { couponCode, cartItems, total } = req.body
       
        
        if(!couponCode || !cartItems || !total){
            return res.status(400).json({success:false,message:"Cart items or coupon not found"})
        }

        const coupon = await Coupon.findOne({code:couponCode})
        if(!coupon){
            return res.status(404).json({success:false,message:"Coupon not found.Use different coupon"})
        }

        const cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(req.session.user)}).populate('items.productId')
        if(!cart){
            return res.status(404).json({success:false,message:"Cart item not found please try again or reload this page"})
        }    

        console.log("minPurchase", coupon.minPurchase,total)
        const TaxAmount = Math.ceil(total * 0.05) 

        if (coupon.expiry < new Date()) {
            return res.status(400).json({ success: false, message: 'Coupon has been expired .Please use another one' })
        } else if (coupon.minPurchase > total) {
            return res.status(400).json({success:false, message: `Minimum order value must be ${coupon.minPurchase}` })
        } else if (coupon.usageLimit <= coupon.usedCount) {
            return res.status(400).json({ success: false, message: `coupon usage limit reached` })
        }else if(!coupon.isActive || coupon.isDeleted){
              return res.status(400).json({success:false,message:"Coupon is currently unavailable"})
        }
        
        let newTotal = 0
        let discount = 0
        if(coupon.discountType==='percentage'){
            if(coupon.discount>50){
                return res.json.status(400).json({message:"Invalid request .maximum discount is 50%"})
            }else if(isNaN(coupon.discount)){
                return res.status(400).json({message:'Invalid request',success:false})
            }
            discount = Math.ceil((coupon.discount/100) * total)
            newTotal = total - discount
            if (coupon.maxDiscount < discount){
                discount = coupon.maxDiscount
                newTotal = total - coupon.maxDiscount
            }
            
        }else if(coupon.discountType==='flat'){
            console.log("Discount",coupon.discount)
            discount = coupon.discount; 
            newTotal = total >= 1000 ? (total - discount)  : (total - discount)  + 50 ;

        }else{
            return res.status(400).json({message:'Invalid request',success:false})
        }
        console.log("new total", typeof(newTotal)) 
    
        
        req.session.applyCoupon = {
            total,
            newTotal,
            discount,
            Code:coupon.code,
        }
  
        console.log("new total",newTotal)  
        return res.status(200).json({
            success: true,
            message: "Coupon applied successfully",
            discount,
            newTotal
        });      
        
    }catch(error) {
          console.log("Error in apply coupon page",error.message)
          return res.status(500).json({message:"Internal Server error",success:false})
    }
}

module.exports = {
    loadCoupons,
    showAvailableCoupon,
    applyCoupon
}


