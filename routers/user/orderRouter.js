const express = require('express')
const router = express.Router()
const {userAuth} = require('../../middlewares/auth')
const orderController = require('../../controllers/user/orderController')


router.get('/details', userAuth,orderController.loadOrderDetails)
router.get('/',userAuth,orderController.loadMyOrder)



module.exports=router