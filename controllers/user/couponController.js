const Coupon = require('../../models/couponSchema')
const Cart = require('../../models/cartSchema')
const mongoose = require('mongoose')
const User = require('../../models/userSchema')
const UserCoupon= require('../../models/Referral-Coupon-Schema')
const Order = require('../../models/orderSchema')


const loadCoupons = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const searchQuery = req.query.clear === "1" ? "" : (req.query.search || "");
        const limit = 4;
        const show = req.query.show;
        const sortOptions = req.query.sort;

        const user = await User.findById(req.session.user);

    
        let baseFilter = {
            $or: [
                { code: { $regex: searchQuery, $options: "i" } },
                { description: { $regex: searchQuery, $options: "i" } },
            ],
            isDeleted: false,
            couponType: "common",
        };

    
        if (show === "active") {
            baseFilter.isActive = true;
            baseFilter.expiry = { $gt: new Date() };
        } else if (show === "expired") {
            baseFilter.expiry = { $lt: new Date() };
        } else if (show === "flat") {
            baseFilter.discountType = "flat";
        } else if (show === "percentage") {
            baseFilter.discountType = "percentage";
        }

    
        let sort = {};
        switch (sortOptions) {
            case "oldest": sort = { createdAt: 1 }; break;
            case "expiry-soon": sort = { expiry: 1 }; break;
            case "most-used": sort = { usedCount: -1 }; break;
            default: sort = { createdAt: -1 };
        }

    
        const commonCoupons = await Coupon.find(baseFilter)
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit);
        
        let allCoupons = [...commonCoupons];

     
        if (user.redeemedUser && user.redeemedUser.length > 0) {
            console.log("Referral user:", user.firstName, user.redeemedUser);

            const userCoupons = await UserCoupon.find({ userId: user._id }).populate('couponId');
            console.log("Referral coupons found:", userCoupons);

            for (const uc of userCoupons) {
                const referralCoupon = uc.couponId;
                if (referralCoupon && !allCoupons.some(c => c._id.equals(referralCoupon._id))) {
                    // Apply search filter to referral coupons as well
                    const searchRegex = new RegExp(searchQuery, 'i');
                    if (searchQuery === "" || searchRegex.test(referralCoupon.code) || searchRegex.test(referralCoupon.description)) {
                    allCoupons.push(referralCoupon);
                    console.log("Added referral coupon:", referralCoupon.code);
                    }
                }
            }
        }


       
        const expiredCount = await Coupon.countDocuments({ expiry: { $lt: new Date() } });
        const couponIsActive = await Coupon.countDocuments({
            isActive: true,
            expiry: { $gt: Date.now() },
        });
        const TotalCouponCount = allCoupons.length;
        console.log(TotalCouponCount)
        const totalPages = Math.ceil(TotalCouponCount / limit);

        if (req.xhr) {
            return res.json({
                coupons: allCoupons,
                pagination: {
                    currentPage: page,
                    totalPages: totalPages,
                    limit: limit,
                    totalItems: TotalCouponCount
                }
            });
        }

        return res.render("coupon-listing-page", {
            coupon: allCoupons,
            couponIsActive,
            TotalCouponCount,
            totalPages,
            searchQuery,
            page,
            show,
            sort: sortOptions,
            expiredCount,
            limit,
            user,
        });
    } catch (error) {
        console.log("Error while loadCoupons", error.message);
    }
};




const showAvailableCoupon = async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.session.user);

        // 1. Get all active, non-expired "common" coupons
        const commonCoupons = await Coupon.find({
            isDeleted: false,
            isActive: true,
            expiry: { $gt: new Date() },
            couponType: 'common'
        });

        // 2. Get all personalized coupons (like referral) assigned to this user
        const userCouponLinks = await UserCoupon.find({ userId: userId, isUsed: false })
            .populate({
                path: 'couponId',
                match: {
                    isDeleted: false,
                    isActive: true,
                    expiry: { $gt: new Date() }
                }
            });

        const userSpecificCoupons = userCouponLinks
            .filter(link => link.couponId) // Filter out any links where the coupon itself might be expired/deleted
            .map(link => link.couponId);

        // 3. Combine and deduplicate
        const allCoupons = [...commonCoupons];
        userSpecificCoupons.forEach(coupon => {
            if (!allCoupons.some(c => c._id.equals(coupon._id))) {
                allCoupons.push(coupon);
            }
        });

        if (!allCoupons.length) {
            return res.json({ success: false, message: "No coupons available" });
        }

        const couponsWithFlag = allCoupons.map(coupon => {
            const alreadyUsed = coupon.usedBy.some(
                u => u.userId.toString() === req.session.user.toString()
            )
            return {
                code: coupon.code,
                description: coupon.description,
                discount: coupon.discount,
                discountType: coupon.discountType,
                minPurchase: coupon.minPurchase,
                maxDiscount: coupon.maxDiscount,
                expiry: coupon.expiry,
                alreadyUsed
            }
        });

        return res.json({ success: true, data: couponsWithFlag });
    } catch (err) {
        console.error(err)
        return res.status(500).json({ success: false, message: "Server error" })
    }
}




const applyCoupon = async (req, res) => {
    try {
        const {couponCode} = req.body

        const userId = req.session.user

        if (!couponCode) {
            return res.status(400).json({ success: false, message: "Cart items or coupon not found" })
        }
        let bodyCouponCode = couponCode

        const CouponAlreadyUsedChecking = await Coupon.aggregate([{$unwind:'$usedBy'},{ $match: {'usedBy.userId':new mongoose.Types.ObjectId(userId)}}])
        console.log('couponAlreadyUsed',CouponAlreadyUsedChecking)
        if (CouponAlreadyUsedChecking.length>0){
           return res.status(400).json({success:false,message:'Coupon is already used .Please select another coupon'})
        }

        const coupon = await Coupon.findOne({ code: couponCode })
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Coupon not found.Use different coupon" })
        }
        
        const cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(req.session.user) }).populate('items.productId')
        if (!cart) {
            return res.status(404).json({ success: false, message: "Cart item not found please try again or reload this page" })
        }
        const couponUsed = coupon.usedBy.some(
            u => u.userId.toString() === req.session.user.toString()
        )

        if (couponUsed.length > 0) {
            return res.status(400).json({ success: false, message: "Coupon is already used" })
        }


        console.log("minPurchase", coupon.minPurchase, )

        const totalPrice = await Cart.aggregate([{ $match: { userId: new mongoose.Types.ObjectId(req.session.user) } },{$unwind:'$items'},{$group:{_id:null,total:{$sum:{$multiply:['$items.quantity','$items.price']}}}}])
        const total = totalPrice[0]?.total

        console.log(total)
        if (coupon.expiry < new Date()) {
            return res.status(400).json({ success: false, message: 'Coupon has been expired .Please use another one' })
        } else if (coupon.minPurchase > total) {
            return res.status(400).json({ success: false, message: `Minimum order value must be ${coupon.minPurchase}` })
        } else if (coupon.usageLimit <= coupon.usedCount) {
            return res.status(400).json({ success: false, message: `coupon usage limit reached` })
        } else if (!coupon.isActive || coupon.isDeleted) {
            return res.status(400).json({ success: false, message: "Coupon is currently unavailable" })
        }

       

        let newTotal = 0
        let discount = 0
        if (coupon.discountType === 'percentage') {
            if (coupon.discount > 50) {
                return res.status(400).json({ message: "Invalid request .maximum discount is 50%" })
            } else if (isNaN(coupon.discount)) {
                return res.status(400).json({ message: 'Invalid request', success: false })
            }
            discount = Math.ceil((coupon.discount / 100) * total)
            newTotal = total - discount
            if (coupon.maxDiscount < discount) {
                discount = coupon.maxDiscount
                newTotal = total - coupon.maxDiscount
            }

        } else if (coupon.discountType === 'flat') {
            console.log("Discount", coupon.discount)
            discount = coupon.discount;
            newTotal = total >= 1000 ? (total - discount) : (total - discount) + 50;

        } else {
            return res.status(400).json({ message: 'Invalid request', success: false })
        }
        console.log("new total", typeof (newTotal))

        console.log(newTotal,discount)

        if (req.session.applyCoupon){
            return res.status(400).json({
                success:false,
                message:"Coupon already applied",
                discount,
                newTotal,
                Code: coupon.code,
            })
        }
        req.session.applyCoupon = {
            total,
            newTotal,
            discount,
            Code: coupon.code,
        }

        console.log("new total", newTotal)
        return res.status(200).json({
            success: true,
            message: `Coupon ${couponCode} applied successfully! You saved ₹${discount}`,
            discount,
            newTotal
        });

    } catch (error) {
        console.log("Error in apply coupon page", error.message)
        return res.status(500).json({ message: "Internal Server error", success: false })
    }
}


const removeCoupon = async (req, res) => {
    try {
        if (req.session.applyCoupon) {
            delete req.session.applyCoupon;
        }

        const cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(req.session.user) }).populate('items.productId');

        if (!cart) {
            return res.status(400).json({ success: false, message: "Cart not found" });
        }

        const totalResult = await Cart.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(req.session.user) } },
            { $unwind: '$items' },
            {
                $group: {
                    _id: null,
                    subtotal: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
                }
            }
        ]);

        const subtotal = totalResult[0]?.subtotal || 0;

     
        const shipping = subtotal > 1000 ? 0 : 100; 
     
        const total = subtotal  + shipping;

        console.log("Remove",total)

        return res.json({
            success: true,
            message: "Coupon removed",
            summary: {
                discount: 0,
                total
            }
        });

    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


module.exports = {
    loadCoupons,
    showAvailableCoupon,
    applyCoupon,
    removeCoupon
}
