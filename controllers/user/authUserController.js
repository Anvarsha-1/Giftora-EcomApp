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
  if(req.session.user) return res.redirect('/home')
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
    const  newProductData = productData.slice(0, 4);
    const  bestsellingData = productData.slice(4,8);
    const  flashSalesData  =productData.slice(8,12);



    return res.render("user/Home-page", {
      user: null,
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
  if(req.session.user) return res.redirect('/home')
  try {
    return res.render("user/signUp-page", {
      formData: {},
      errors: {},
      message: "",
    });
  } catch (error) {
    console.log("Sign Up page not found");
    res
      .status(404)
      .render("user/page-404", { message: "Error loading signup page" });
  }
};

const signUp = async (req, res) => {
  if(req.session.user) return res.redirect('/home')
  try {

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
    });
  }
};

const renderVerifyOtp = async (req, res) => {
  if(req.session.user) return res.redirect('/Home')
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
  if(req.session.user) return res.redirect('/Home')
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

    const newUser = new User({
      firstName,
      lastName,
      phone,
      email,
      password: passwordHash,
      referralCode,
    });
    await newUser.save();

    req.session.userOtp = null;
    req.session.userData = null;
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
    });

    return res.status(200).json({
      success: true,
      redirectUrl: "/login",
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
  if(req.session.user) return res.redirect('/Home')
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
  if(req.session.user) return res.redirect('/home')
  try {  
      res.render("login-page");
  } catch (error) {
    console.log("Error loading login page");
    return res.redirect("/PageNotFound").status(404);
  }
};

const login = async (req, res) => {
  if(req.session.user) return res.redirect('/Home')
  try {
   
    const { email, password } = req.body;
    console.log(email, password);
    const findUser = await User.findOne({ email: email });
    
    if(findUser.isAdmin==='true'){
      return res
      .status(404)
      .json("Access Denied please login through admin side") 
    }

    if (!findUser) {
      return res
        .status(404)
        .json({ success: "false", message: "User not Found" });
    }
    if (findUser.isBlocked) {
      return res
        .status(403)
        .json({ success: "false", message: "User is blocked by admin" });
    }
    const passwordMatch = await bcrypt.compare(password, findUser.password);
   
    if (!passwordMatch) {
      return res
        .status(401)
        .json({ success: "false", message: "Incorrect Password" });
    }
    req.session.user = findUser._id;
    return res.json({
      success: true,
      message: "Login Successful",
      redirectUrl: "/home",
    });
  } catch (error) {
    console.error("login error", error.message);
    res.json({success: false,
      message: "Login failed. Please try again later",})
      
    
  }
};

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
    const  newProductData = productData.slice(0, 4);
    const  bestsellingData = productData.slice(4,8);
    const  flashSalesData  =productData.slice(8,12);

  

    const user = req.session.user;
    
    if (user) {
      const userData = await User.findById(user);
      
      return res.render("user/Home-page", {
        user: userData,
        products: newProductData,
        bestselling: bestsellingData,
        flashSales: flashSalesData
      });
    }

    return res.render("user/Home-page", {
      user: null,
      products: productData,
      bestselling: bestsellingData,
      flashSales: flashSalesData
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


const loadProductListingPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    const clearFilter = req.query.clearFilter==='1'
    const clearSearch  = req.query.clearSearch==='1'
    const search = clearSearch ? "" : req.query?.search || '';
    const selectedCategory = clearFilter ? "" :req.query?.category || '';
    const minPrice = clearFilter ? "" : parseFloat(req.query?.minPrice) || 0;
    const maxPrice = clearFilter ? "" : parseFloat(req.query?.maxPrice) || Number.MAX_VALUE;
    const sortOption = clearFilter ? "" : req.query.sort || 'createdAt-desc';

    const userData = req.session.user;
    const categories = await category.find({ isListed: true, isDeleted: false });

    let query = {
      isBlocked: false,
      isDeleted: false,
      quantity: { $gt: 0 },
      regularPrice: { $gte: minPrice, $lte: maxPrice },
    };

    if (search) {
      query.productName = { $regex: search, $options: 'i' };
    }

    if (selectedCategory) {
      query.category = selectedCategory; 
    }

    // 🔀 Handle sort logic
    let sort = {};
    switch (sortOption) {
      case 'name-asc':
        sort = { productName: 1 };
        break;
      case 'name-desc':
        sort = { productName: -1 };
        break;
      case 'price-asc':
        sort = { regularPrice: 1 };
        break;
      case 'price-desc':
        sort = { regularPrice: -1 };
        break;
      default:
        sort = { createdAt: -1 };
    }

    const total = await product.countDocuments(query);

    let productData = await product.find(query)
      .skip(skip)
      .limit(limit)
      .sort(sort);

    productData = productData.map(pro => ({
      ...pro._doc,
      productImage: pro.productImage?.[0]?.url || null,
    }));

    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.json({
        products: productData,
        page,
        total,
        totalPages: Math.ceil(total / limit)
      });
    }

    res.render('user/productListingPage', {
      user: userData,
      products: productData,
      cat: categories,
      currentPage: page,
      totalPage: Math.ceil(total / limit),
      totalProduct: total,
      search,
      categoryFilter: selectedCategory,
      minPrice: req.query.minPrice || '',
      maxPrice: req.query.maxPrice || '',
      sort: sortOption
    });

  } catch (error) {
    console.error("Error in loadProductListingPage:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};








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
  loadHomePage,
  loadProductListingPage,
};



