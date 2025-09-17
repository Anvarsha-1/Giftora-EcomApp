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

        
        
    } catch (error) {
          console.log("Error in apply coupon page",error.message)
          return res.json({message:"Internal Server error",success:false})
    }
}

module.exports = {
    loadCoupons,
    showAvailableCoupon,
    applyCoupon
}


