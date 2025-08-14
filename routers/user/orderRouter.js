const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/user/orderController');
const { userAuth } = require('../../middlewares/auth')


router.get('/', userAuth, orderController.loadMyOrder)
router.get('/details', userAuth, orderController.loadOrderDetails);
router.post('/:orderId/item/:itemId/cancel', orderController.cancelProduct)
router.post('/:orderId/cancel', orderController.cancelOrder)
router.post('/:orderId/return',orderController.returnOrder)
router.patch('/:orderId/item/:itemId/return',orderController.returnItemRequest)
router.get('/:orderId/invoice',orderController.downloadPdf)

module.exports = router;
