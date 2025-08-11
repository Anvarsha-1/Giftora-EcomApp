const express = require('express')
const router =  express.Router()
const checkoutController = require('../../controllers/user/checkoutController')
const { userAuth } =require('../../middlewares/auth')


router.get('/', userAuth,checkoutController.loadCheckoutPage)
router.post('/', userAuth, checkoutController.validateCheckout)
router.post('/place-order', userAuth,checkoutController.placeOrder)
router.get('/order-success',userAuth,checkoutController.loadOrderSuccess)

module.exports=router