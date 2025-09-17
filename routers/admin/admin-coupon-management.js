const express =  require('express')
const router = express.Router()
const couponManagement = require('../../controllers/admin/coupon-management-controller')
const {adminAuth} = require('../../middlewares/auth')

router.get('/coupons',adminAuth,couponManagement.getCouponPage)

router.get('/coupons/add', adminAuth, couponManagement.getAddCoupon)

router.post('/coupons/add',adminAuth,couponManagement.addCoupons)

router.get('/coupons/edit/:id',adminAuth,couponManagement.getEditCoupons)

router.put('/coupons/edit/:id',adminAuth,couponManagement.editCoupons)

router.patch('/coupons/delete/:id',adminAuth,couponManagement.deleteCoupon)

module.exports = router

