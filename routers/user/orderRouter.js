const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/user/orderController');
const { userAuth } = require('../../middlewares/auth');

router.get('/', userAuth, orderController.loadMyOrder);

router.get('/details', userAuth, orderController.loadOrderDetails);

router.post(
  '/:orderId/item/:itemId/cancel',
  userAuth,
  orderController.cancelProduct,
);

router.post('/:orderId/cancel', userAuth, orderController.cancelOrder);

router.post('/:orderId/return', userAuth, orderController.returnOrder);

router.patch(
  '/:orderId/item/:itemId/return',
  userAuth,
  orderController.returnItemRequest,
);

router.get('/:orderId/invoice', userAuth, orderController.downloadPdf);

module.exports = router;
