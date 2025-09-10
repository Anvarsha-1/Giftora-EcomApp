const express = require('express')
const router = express.Router()
const adminOrderController = require('../../controllers/admin/adminOrderController')
const {adminAuth} = require('../../middlewares/auth')


router.get('/orders', adminAuth, adminOrderController.loadOrderPage); 


router.patch('/orders/:orderId/status', adminAuth, adminOrderController.updateOrderStatus); 


router.get('/returns/count', adminAuth, adminOrderController.getPendingReturnsCount);


router.get('/returns', adminAuth,adminOrderController.getReturnedOrder)


router.post('/return/verify/:orderId/:itemId',adminAuth,adminOrderController.verifyOrderReturn)


router.patch('/return/cancel/:orderId/:itemId',adminAuth,adminOrderController.cancelReturnRequest)


router.get('/view/orders/:orderId',adminAuth,adminOrderController.viewOrderDetails)

module.exports = router