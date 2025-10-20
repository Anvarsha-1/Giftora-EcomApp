const express = require("express");
const router = express.Router();
const {userAuth} = require('../../middlewares/auth')
const authUserController = require("../../controllers/user/authUserController")
const userProductController = require('../../controllers/user/userProductController')
const userAccount  = require('../../controllers/user/userAccount')
const passport = require('passport');
const upload = require('../../helpers/multer')




//USER AUTHENTICATION
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

router.get("/google/callback", (req, res, next) => {
    passport.authenticate(
        "google",
        { failureRedirect: "/login" },
        async (err, user, info) => {
            if (err) return next(err);
            if (!user) {
                const message = info?.message || "Google authentication failed.";
                return res.redirect(`/login?error=${encodeURIComponent(message)}`);
            }

            req.logIn(user, (err) => {
                if (err) {
                    console.error("Error during req.logIn:", err);
                    return res.redirect("/login");
                }

                req.session.userId = user._id;

                req.session.save(() => res.redirect("/home"));
            });
        }
    )(req, res, next);
});





//USER HOME PAGE 
router.get('/home',authUserController.loadHomePage)

router.get('/viewProducts/',userProductController.loadProductListingPage)

router.get('/productsDetails/:id',userProductController.viewProductDetails)



module.exports=router;
