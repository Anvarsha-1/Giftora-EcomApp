const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/user/orderController');
const {userAuth} = require('../../middlewares/auth')



router.get('/details', userAuth, orderController.loadOrderDetails);


module.exports = router;
