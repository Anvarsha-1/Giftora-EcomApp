const Coupon = require('../../models/couponSchema');
const UserCoupon = require('../../models/Referral-Coupon-Schema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const Wallet = require('../../models/walletSchema')
const logger = require('../../config/logger');

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
    logger.error("Referral application crashed: %s", error.message, {
      error: error,
      stack: error.stack
    });
  }
};

async function applyReferralCode(newUserId, code) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const referrer = await User.findOne({ referralCode: code }).session(session);
    if (!referrer) {
      throw new Error('Invalid referral code.');
    }

    if (referrer._id.toString() === newUserId.toString()) {
      throw new Error('You cannot use your own referral code.');
    }

    const newUser = await User.findById(newUserId).session(session);

    if (!newUser) throw new Error('New user not found.');
    if (newUser.invitedBy) throw new Error('A referral code has already been applied to this account.');

    const bonusAmount = 50;

    // Update wallet for the new user
    await Wallet.updateOne(
      { userId: newUserId },
      {
        $inc: { balance: bonusAmount },
        $push: {
          transactions: {
          type: 'credit',
          amount: bonusAmount,
          description: `Welcome bonus - invited by ${referrer.firstName}`,
          },
        }
      },
      { upsert: true, session }
    );

    const now = new Date();

    // Update the new user's status
    newUser.invitedBy = referrer._id;
    newUser.invitedAt = now;
    newUser.isFirstLogin = false;
    await newUser.save({ session });

    // Award the referrer
    await awardReferralCoupon(referrer._id, session);
    referrer.redeemedUser.push(newUserId);
    await referrer.save({ session });

    await session.commitTransaction();
    return { success: true, message: 'Referral applied! Your reward is in your wallet.' };
  } catch (error) {
    await session.abortTransaction();
    logger.error("Referral application crashed: %s", error.message, {
      error: error,
      stack: error.stack
    });

    throw error;
  } finally {
    session.endSession();
  }
}

module.exports = {
  awardReferralCoupon,
  applyReferralCode
};
