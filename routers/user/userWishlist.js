const express = require('express');
const router = express.Router();
const { userAuth } = require('../../middlewares/auth');
const wishlistController = require('../../controllers/user/wishlistController');

router.get('/', userAuth, wishlistController.loadWishlist);

router.post('/add', userAuth, wishlistController.addTOWishlist);

router.delete('/remove/:id', userAuth, wishlistController.removeWishlistItem);

module.exports = router;
