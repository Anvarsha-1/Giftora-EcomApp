const express = require('express');
const router = express.Router();
const authUserController = require('../../controllers/user/authUserController');
const userProductController = require('../../controllers/user/userProductController');
const passport = require('passport');

//USER AUTHENTICATION
router.get('/', authUserController.loadPLandingPage);

router.get('/PageNotFound', authUserController.PageNotFound);

router.get('/signup', authUserController.loadSignUp);

router.post('/signup', authUserController.signUp);

router.get('/verify-otp', authUserController.renderVerifyOtp);

router.post('/resent-otp', authUserController.resendOtp);

router.post('/verify-otp', authUserController.verifyOtp);

router.get('/login', authUserController.loadLogin);

router.post('/login', authUserController.login);

router.get('/forgot-password', authUserController.forgotPassword);

router.post('/forgot-password', authUserController.forgotPasswordValidation);

router.get('/otp-forgot-password', authUserController.otpForgotPassword);

router.post('/otp-forgot-password', authUserController.verifyForgotPasswordOtp);

router.get('/reset-password', authUserController.loadResetPassword);

router.post('/reset-password', authUserController.validateResetPassword);

router.get('/logout', authUserController.logout);

// 1️⃣ Trigger Google login
router.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }),
);

// 2️⃣ Callback route (must match Google Cloud console)
router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    console.log('Google user logged in:', req.user);

    // Optional: your custom session
    req.session.user = req.user._id;

    req.session.save(() => res.redirect('/home'));
  },
);

//USER HOME PAGE
router.get('/home', authUserController.loadHomePage);

router.get('/viewProducts/', userProductController.loadProductListingPage);

router.get('/productsDetails/:id', userProductController.viewProductDetails);

module.exports = router;
