const User = require("../../models/userSchema");
const {
  sendVerificationEmail,
  generateOtp,
  securePassword,
} = require("../../helpers/helper");
const env = require("dotenv").config();
const validateSignupForm = require("../../helpers/signupValidator");
const bcrypt = require("bcrypt");
const product = require("../../models/productSchema")
const category = require('../../models/categorySchema')
const Wishlist = require('../../models/wishListSchema')
const createUniqueReferralCode = require('../../helpers/generateReferralCode')



const PageNotFound = async (req, res) => {
  try {
    res.status(404).render("user/Page-404", {
      title: "404 - Page Not Found",
      message: "Oops! The page you're looking for doesn't exist.",
    });
  } catch (error) {
    console.error("Error rendering 404 page:", error.message);
    res.redirect("/pageNotFound");
  }
};



const loadPLandingPage = async (req, res) => {
  if (req.session.user) return res.redirect('/home')
  try {
    const categories = await category.find({ isListed: true });
    let productData = await product.find({
      isBlocked: false,
      isDeleted: false,
      category: { $in: categories.map(category => category._id) },
      quantity: { $exists: true, $gt: 0 }
    });


    productData = productData.map(pro => {
      const imageUrl = pro.productImage?.[0]?.url;
      return {
        ...pro._doc,
        productImage: imageUrl || null
      };
    });

    productData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const newProductData = productData.slice(0, 4);
    const bestsellingData = productData.slice(4, 8);
    const flashSalesData = productData.slice(8, 12);



    return res.render("user/Home-page", {
      user: null,
      firstName: null,
      products: productData,
      bestselling: bestsellingData,
      flashSales: flashSalesData,

    });
  } catch (error) {
    console.log("Home page not found");
    res.status(500).redirect('/pageNotFound')
  }
};


const loadSignUp = async (req, res) => {
  if (req.session.user) return res.redirect('/home')
  try {

    const error = req.query.error || null

    return res.render("user/signUp-page", {
      formData: {},
      errors: {},
      message: "",
      error,
    });
  } catch (error) {
    console.log("Sign Up page not found");
    res
      .status(404)
      .render("user/page-404", { message: "Error loading signup page" });
  }
};

const signUp = async (req, res) => {
  if (req.session.user) return res.redirect('/home')
  try {
    const error = req.query.error || null

    const {
      firstName,
      lastName,
      phone,
      email,
      password,
      confirmPassword,
      referralCode,
    } = req.body;
    
    const errors = await validateSignupForm(req.body);

    if (Object.keys(errors).length > 0) {
      console.log("Validation errors:", errors);
      return res.render("user/signUp-page", {
        errors,
        formData: req.body,
        message: "",
        error
      });
    }

    const otp = generateOtp().toString();
    console.log("Generated OTP:", otp);

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      console.log("Email sending failed");
      return res.render("user/signUp-page", {
        message: "Failed to send verification email",
        formData: req.body,
        errors: {},
        error
      });
    }

    const invitedUser = await User.findOne({ referralCode, referralCode })

    if(!invitedUser){
      return res.render("user/signUp-page", {
        errors:error.referralCode="User not found",
        formData: req.body,
        message: "",
        error
      });
    }

    



    req.session.userOtp = otp;
    req.session.userData = {
      firstName,
      lastName,
      phone,
      email,
      password,
      confirmPassword,
      referralCode,
    };

    console.log("Session data saved:", {
      userOtp: req.session.userOtp,
      userData: req.session.userData,
    });



    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.render("user/signUp-page", {
          message: "Failed to save session. Please try again.",
          formData: req.body,
          errors: {},
          error
        });
      }
      res.redirect("/verify-otp");
    });
  } catch (error) {
    console.error("Error in signUp:", error.message);
    res.render("user/signUp-page", {
      message: "An error occurred. Please try again.",
      formData: req.body || {},
      errors: {},
      error
    });
  }
};

const renderVerifyOtp = async (req, res) => {
  if (req.session.user) return res.redirect('/Home')
  try {
    const email = req.session.userData?.email;

    if (!email) {
      console.warn(
        "[VERIFY ] No email found in session. Redirecting to /signup."
      );
      return res.redirect("/signup");
    }

    console.info("[VERIFY OTP] Rendering page with email:", email);
    return res.render("verify-otp", { email });
  } catch (error) {
    console.error(
      "[VERIFY OTP] Failed to render verify-otp page:",
      error.message
    );
    return res.status(500).render("error", {
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};

const verifyOtp = async (req, res) => {
  if (req.session.user) return res.redirect('/Home')
  try {
    const { otp } = req.body;
    console.log("Received OTP:", otp, typeof otp);
    console.log("Stored OTP:", req.session.userOtp, typeof req.session.userOtp);

    if (!req.session.userOtp || !req.session.userData) {
      return res.status(400).json({
        success: false,
        message: "Session expired. Please try signing up again.",
      });
    }

    if (otp.trim() !== req.session.userOtp.toString().trim()) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please try again.",
      });
    }

    const { firstName, lastName, phone, email, password, referralCode } =
      req.session.userData;
    const passwordHash = await securePassword(password);
 

    const invitedPersonDetails = await User.findOne({ referralCode: referralCode })

    

    const newUser = new User({
      firstName,
      lastName,
      phone,
      email,
      password: passwordHash,
      referralCode: await createUniqueReferralCode(),
      invitedBy: invitedPersonDetails ? invitedPersonDetails._id : null,
      invitedAt: invitedPersonDetails ? Date.now() : null
    });
    await newUser.save();

    invitedPersonDetails.redeemedUser = newUser._id
    invitedPersonDetails.referralRewardType = "Coupon"
    invitedPersonDetails.referralCreatedAt = Date.now()

   

    req.session.userOtp = null;
    req.session.userData = null;
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
    });

    req.session.user = newUser._id

    return res.status(200).json({
      success: true,
      redirectUrl: "/home",
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("Error in verifyOtp:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred. Please try again.",
    });
  }
};

const resendOtp = async (req, res) => {
  if (req.session.user) return res.redirect('/Home')
  try {
    const { email } = req.session.userData || {};
    if (!email) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Email not found in session .Please Sign in again",
        });
    }

    const otp = generateOtp().toString();
    console.log(otp);
    req.session.userOtp = otp;
    req.session.lastOtpSent = Date.now();
    const emailSent = await sendVerificationEmail(email, otp);

    if (emailSent) {
      console.log("resend OTP: ", emailSent);
      return res
        .status(200)
        .json({ success: true, message: "OTP Resend Successfully" });
    } else {
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to resend OTP. Please try again",
        });
    }
  } catch (error) {
    console.error("Error occured :", error.message);
    return res
      .status(500)
      .json({
        success: false,
        message: "Internal Server Error. Please try again",
      });
  }
};

const loadLogin = async (req, res) => {
  if (req.session.user) return res.redirect('/home')
  try {
    const error = req.flash('error')
    res.render("login-page", { success: null, message: "", error: error || [] });
  } catch (error) {
    console.log("Error loading login page");
    return res.redirect("/PageNotFound").status(404);
  }
};

const login = async (req, res) => {
  if (req.session.user) return res.redirect('/Home')
  try {

    const { email, password } = req.body;
    console.log(email, password);
    const findUser = await User.findOne({ email: email });


    if (!findUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not Found" });
    }

    if (findUser.googleId) {
      return res
        .json({ success: false, message: "Please login thought google authentication" })
    }


    if (findUser.isAdmin) {
      return res
        .status(404)
        .json({ success: false, message: "Access Denied please login through admin side" })
    }

    if (findUser.isBlocked) {
      return res
        .status(403)
        .json({ success: false, message: "User is blocked by admin" });
    }
    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Incorrect Password" });
    }
    req.session.user = findUser._id;
    return res.json({
      success: true,
      message: "Login Successful",
      redirectUrl: "/home",
    });
  } catch (error) {
    console.error("login error", error.message);
    res.json({
      success: false,
      message: "Login failed. Please try again later",
    })


  }
};


const forgotPassword = async (req, res) => {
  if (req.session.email) return res.redirect('/otp-forgot-password')
  if (req.session.user) return res.redirect('/home')
  try {
    return res.render('user/forgotPassword', { error: req.flash('error'), success: req.flash('success') })
  } catch (error) {
    console.log("error while loading forgot password:", error.message)
    return res.status(500).render('user/error-page')
  }
}


const forgotPasswordValidation = async (req, res) => {
  try {
    const email = req.body.email
    if (!email) {
      req.flash("error", "email required")
      return res.redirect('/forgot-password')
    }


    function isValidEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    }
    if (!isValidEmail(email)) {
      req.flash('error', 'Please enter a valid email address.')
      return redirect('/forgot-password')
    }

    const findUser = await User.findOne({ email: email })

    if (!findUser) {
      req.flash('error', "User not found")
      return res.redirect('/forgot-password')
    }

    const otp = generateOtp()
    console.log("generated OTP", otp)
    sendVerificationEmail(email, otp);

    req.session.otp = otp;
    req.session.otpCreatedAt = Date.now()
    req.session.email = email

    req.flash('success', "redirecting to reset password page")

    return res.redirect('/otp-forgot-password')
  } catch (error) {
    console.log("Error while forgot password validation", error.message)
    return res.status(500).render('user/error-page')
  }
}


const otpForgotPassword = async (req, res) => {
  if (!req.session.email) return res.redirect('/forgot-password')
  try {
    return res.render('user/otpForgotPassword', { error: req.flash('error'), success: req.flash('success') })
  } catch (error) {
    console.log('error while loading otpForgotPassword', error.message);
    return res.render('user/error-page')
  }
}


const verifyForgotPasswordOtp = async (req, res) => {
  if (!req.session.email) return res.redirect('/forgot-password');

  try {

    const Expiration = Date.now() - req.session.otpCreatedAt > 5 * 60 * 1000

    if (Expiration) {
      req.session.otp = null;
      req.session.otpCreatedAt = null;
      req.flash('error', 'OTP expired. Request a new one.');
      return res.redirect('/otp-forgot-password')
    }

    const otp = (req.body.otp || []).join('').trim();
    console.log("otp", otp)
    if (!otp || otp.length !== 6) {
      req.flash('error', 'Please enter a valid 6-digit OTP');
      return res.redirect('/otp-forgot-password');
    }

    if (otp !== req.session.otp) {
      req.flash('error', 'Incorrect OTP');
      return res.redirect('/otp-forgot-password');
    }



    req.session.otpVerified = true
    req.flash('success', 'OTP verified successfully!');
    return res.redirect('/reset-password');
  } catch (error) {
    console.log('Error verifying OTP:', error.message);
    return res.render('user/error-page');
  }
};


const loadResetPassword = async (req, res) => {
  if (!req.session.email || !req.session.otpVerified) return res.redirect('/forgot-password')
  try {
    return res.render('resetPassword', {
      error: req.flash('error'),
      success: req.flash('success'),
    })
  } catch (error) {

  }
}


const validateResetPassword = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body
    console.log("new password", newPassword)
    if (!newPassword || !confirmPassword) {
      req.flash('error', 'All fields required..!')
      return res.render('user/resetPassword', { error: req.flash('error') })
    }

    if (newPassword.length < 6) {
      req.flash('error', 'Password must be at least 6 character long');
      return res.render('user/resetPassword', { error: req.flash('error') });
    }

    if (newPassword !== confirmPassword) {
      req.flash('error', "Password does not match");
      return res.render('resetPassword', { error: req.flash('error') });
    }

    const hashPassword = await securePassword(newPassword)

    const user = await User.findOne({ email: req.session.email })

    if (!user) {
      req.flash('error', 'User not found.');
      return res.redirect('/reset-password');
    }


    user.password = hashPassword

    await user.save()



    req.flash('success', 'Password updated successfully.');
    delete req.session.email
    delete req.session.otpVerified

    res.redirect('/login');

  } catch (error) {

    console.log('error while reset password', error.message)
    return res.status(500).render('user/error-page')
  }
}

const loadHomePage = async (req, res) => {
  try {
    const categories = await category.find({ isListed: true });

    let productData = await product.find({
      isBlocked: false,
      isDeleted: false,
      category: { $in: categories.map(category => category._id) },
      quantity: { $exists: true, $gt: 0 }
    });


    productData = productData.map(pro => {
      const imageUrl = pro.productImage?.[0]?.url;
      return {
        ...pro._doc,
        productImage: imageUrl || null
      };
    });

    productData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const newProductData = productData.slice(0, 4);
    const bestsellingData = productData.slice(4, 8);
    const flashSalesData = productData.slice(8, 12);



    const userId = req.session.user;
    const wishlist = await Wishlist.findOne({ userId })
    const wishlistId = wishlist ? wishlist.products.map(item => item.productId.toString()) : []


    if (userId) {
      const userData = await User.findById(userId);

      return res.render("user/Home-page", {
        user: userData,
        firstName: userData.firstName,
        products: newProductData,
        bestselling: bestsellingData,
        flashSales: flashSalesData,
        wishlistId
      });
    }

    return res.render("user/Home-page", {
      user: null,
      products: productData,
      bestselling: bestsellingData,
      flashSales: flashSalesData,
      wishlistId:[]
    });

  } catch (error) {
    console.log("error loading home page", error.message);
  }
};




const logout = async (req, res) => {
  try {
    delete req.session.user;
    res.clearCookie('connect.sid');
    res.redirect('/login');
  } catch (error) {
    console.log("server error while logout", error.message);
    res.render('user/error-page');
  }
}



module.exports = {
  loadSignUp,
  signUp,
  renderVerifyOtp,
  verifyOtp,
  resendOtp,
  loadLogin,
  login,
  logout,
  PageNotFound,
  loadPLandingPage,
  forgotPassword,
  forgotPasswordValidation,
  otpForgotPassword,
  verifyForgotPasswordOtp,
  loadResetPassword,
  validateResetPassword,
  loadHomePage,

};



