const express = require('express');
const router = express.Router();
const cartController = require('../../controllers/user/cartController');
const { userAuth } = require('../../middlewares/auth');

router.get('/', userAuth, cartController.loadCart);

router.post('/', userAuth, cartController.addToCart);

router.patch('/', userAuth, cartController.updateCartQuantity);

router.delete('/:id', userAuth, cartController.removeCartItem);

router.get('/count', userAuth, cartController.updateCartCount);

module.exports = router;
