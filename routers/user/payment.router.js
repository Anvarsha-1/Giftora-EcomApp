const express = require('express');
const router = express.Router();
const { userAuth } = require('../../middlewares/auth');

const paymentController = require('../../controllers/user/paymentController');

router.post('/create-order', userAuth, paymentController.createOrder);

router.post('/verify-payment', userAuth, paymentController.verifyPayment);

router.get('/get-key', userAuth, paymentController.getApiKey);

router.patch('/failure', userAuth, paymentController.paymentFailureHandler);

router.get(
  '/failure-page/:orderId',
  userAuth,
  paymentController.loadPaymentFailurePage,
);

router.get(
  '/retry-payment/:orderId',
  userAuth,
  paymentController.loadRetryPayment,
);

router.patch('/retry-order', userAuth, paymentController.retryPayment);

module.exports = router;
