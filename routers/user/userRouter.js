const express = require("express");
const router = express.Router();
const {userAuth} = require('../../middlewares/auth')
const authUserController = require("../../controllers/user/authUserController")
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
router.get("/auth/google",passport.authenticate("google",{scope:['profile','email']}))
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:"/signup"}),(req,res)=>{
<<<<<<< HEAD
    req.session.user = req.user._id
    console.log("🔥 req.user after login:", req.user)
    res.redirect("/home")
=======
    res.redirect("/")
>>>>>>> e3d1b9fd589f953e478a2819f45acf715ff2701d
})



router.get('/home',userAuth,authUserController.loadHomePage)
router.get('/viewProducts',userAuth,authUserController.loadProductListingPage)
router.get('/logout',authUserController.logout)


module.exports=router;
