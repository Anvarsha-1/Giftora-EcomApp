const express  = require('express');
const router =  express.Router();
const cartController = require('../../controllers/user/cartController');
const {userAuth} =  require('../../middlewares/auth')




router.get('/', userAuth, cartController.loadCart);
router.post('/addToCart',cartController.addToCart);
router.post('/update',userAuth,cartController.updateCartQuantity);
router.delete('/remove/:id',cartController.removeCartItem)
router.get('/count',cartController.updateCartCount)

module.exports = router