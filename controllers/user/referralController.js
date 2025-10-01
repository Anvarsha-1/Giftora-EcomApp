const Coupon = require('../../models/couponSchema');
const UserCoupon = require('../../models/Referral-Coupon-Schema');
const User = require('../../models/userSchema');


const awardReferralCoupon = async (referrerId) => {
    try {
        const referrer = await User.findById(referrerId);
        if (!referrer) {
            console.error(`Referral award failed: Referrer with ID ${referrerId} not found.`);
            return;
        }

      
        const uniqueCode = `REF-${referrerId.toString().slice(-4)}${Math.random().toString(36).substr(2, 5)}`.toUpperCase();

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30); 

      
        const referralCoupon = new Coupon({
            code: uniqueCode,
            description: '₹100 off as a thank you for referring a new user!',
            isPersonalized: true, 
            discountType: 'flat',
            discount: 100,
            minPurchase: 500, 
            maxDiscount: 100, 
            startDate: new Date(),
            expiry: expiryDate,
            usageLimit: 1, 
            userUsageLimit: 1, 
            isActive: true,
            couponType:'referral'
        });

        const newCoupon = await referralCoupon.save();

       
        const userCouponLink = new UserCoupon({
            userId: referrerId,
            couponId: newCoupon._id,
        });

        await userCouponLink.save();

        console.log(`Referral coupon ${uniqueCode} created and awarded to user ${referrer.email}`);

       
    } catch (error) {
        console.error('Error awarding referral coupon:', error);
    }
};




module.exports = { awardReferralCoupon};