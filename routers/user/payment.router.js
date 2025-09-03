const express = require('express')
const router = express.Router()

const paymentController = require('../../controllers/user/paymentController')

router.post('/create-order', paymentController.createOrder)
router.post('/verify-payment', paymentController.verifyPayment)
router.get('/get-key', paymentController.getApiKey)
router.post('/failure',paymentController.paymentFailureHandler)
router.get('/failure-page/:orderId',paymentController.loadPaymentFailurePage)
module.exports=router