const express = require("express");
const router = express.Router();
const {userAuth} = require('../../middlewares/auth')
const authUserController = require("../../controllers/user/authUserController")
const userProductController = require('../../controllers/user/userProductController')
const passport = require('passport');




router.get('/',authUserController.loadPLandingPage);
router.get('/PageNotFound',authUserController.PageNotFound);
router.get("/signup",authUserController.loadSignUp);
router.post("/signup",authUserController.signUp);
router.get("/verify-otp",authUserController.renderVerifyOtp);
router.post("/resent-otp",authUserController.resendOtp)
router.post("/verify-otp",authUserController.verifyOtp)
router.get("/login",authUserController.loadLogin)
router.post('/login',authUserController.login)
router.get('/forgot-password',authUserController.forgotPassword)
router.post('/forgot-password', authUserController.forgotPasswordValidation)
router.get('/otp-forgot-password', authUserController.otpForgotPassword)
router.post('/otp-forgot-password', authUserController.verifyForgotPasswordOtp)
router.get('/reset-password',authUserController.loadResetPassword)
router.post('/reset-password',authUserController.validateResetPassword)
router.get('/logout',authUserController.logout)
router.get("/auth/google",passport.authenticate("google",{scope:['profile','email']}))
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:"/signup"}),(req,res)=>{
    req.session.user = req.user._id
    res.redirect("/home")
})
router.get('/my-account',userAuth,authUserController.myAccountDetails)



router.get('/home',userAuth,authUserController.loadHomePage)
router.get('/viewProducts/',userAuth,userProductController.loadProductListingPage)
router.get('/productsDetails/:id',userAuth,userProductController.viewProductDetails)



module.exports=router;
