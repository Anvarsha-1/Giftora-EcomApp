const Coupon = require('../../models/couponSchema');
const UserCoupon = require('../../models/Referral-Coupon-Schema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const Wallet = require('../../models/walletSchema')

const awardReferralCoupon = async (referrerId) => {
  try {
    const referrer = await User.findById(referrerId);
    if (!referrer) {
      console.error(
        `Referral award failed: Referrer with ID ${referrerId} not found.`,
      );
      return;
    }

    const uniqueCode =
      `REF-${referrerId.toString().slice(-4)}${Math.random().toString(36).substr(2, 5)}`.toUpperCase();

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
      couponType: 'referral',
    });

    const newCoupon = await referralCoupon.save();

    const userCouponLink = new UserCoupon({
      userId: referrerId,
      couponId: newCoupon._id,
    });

    await userCouponLink.save();
  } catch (error) {
    console.error('Error awarding referral coupon:', error);
  }
};

async function  applyReferralCode(newUserId, code) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const referrer = await User.find({ referralCode: code }).session(session)
    if (string(referrer._id) === string(newUserId)) throw new Error('Cannot use your own referral')

    const newUser = await User.find({ userId: newUserId }).session(session)

    if (!newUser) throw new Error('User not found')
    if (newUser.invitedBy) throw new Error('Referral  already applied')
    let bonusAmount = 50



    const wallet = Wallet.updateOne({
      userId: newUserId,
      balance: bonusAmount || 0,
      transactions: [
        {
          type: 'credit',
          amount: bonusAmount,
          description: `Welcome bonus - invited by ${referrer.firstName}`,
        }
      ]
    },
      { upsert: true, new: true, session }
    )

    const now = new Date();

    newUser.invitedBy = referrer.firstName
    newUser.invitedAt = now
    newUser.referralCreatedAt = now
    newUser.isFirstLogin = false


    await newUser.save({ session })

    if (referrer) {
      awardReferralCoupon(referrer._id)
      referrer.redeemedUser.push(newUserId)
      await referrer.save()
    }
    await session.commitTransaction();
    return { referrerId: referrer._Id }

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}




module.exports = {
  awardReferralCoupon,
  applyReferralCode
};
