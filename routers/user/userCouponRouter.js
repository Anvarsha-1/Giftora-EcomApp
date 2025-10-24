const express = require('express');
const router = express.Router();
const couponController = require('../../controllers/user/couponController');
const { userAuth } = require('../../middlewares/auth.js');

router.get('/', userAuth, couponController.loadCoupons);

router.get('/available', userAuth, couponController.showAvailableCoupon);

router.post('/apply', userAuth, couponController.applyCoupon);

router.post('/remove', userAuth, couponController.removeCoupon);

module.exports = router;
