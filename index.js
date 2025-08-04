const express = require("express");
const env = require("dotenv").config();
const DB = require("./config/db");
const path = require("path");
const PORT = process.env.PORT || 3000;
const userRouter = require("./routers/user/userRouter");
const adminRouter = require('./routers/admin/adminRouter');
const userAccount =  require('./routers/user/userAccount')
const userCart  = require('./routers/user/userCart')
const userWishlist = require('./routers/user/userWishlist')
const userCheckout = require('./routers/user/userCheckout')
const userOrders = require('./routers/user/orderRouter')
const session = require('express-session');
const app = express();

const flash = require('express-flash');
const passport = require("./config/passport");

DB();

if (!process.env.SECRET_KEY) {
  console.error('SECRET_KEY environment variable is required');
  process.exit(1);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));



app.use(
  session({
    secret: process.env.SECRET_KEY,
    resave: false,        
    saveUninitialized: false,
    cookie: { 
      secure: false, 
      httpOnly: true, 
      maxAge: 24 * 60 * 60 * 1000 
    }, 
  })
);

app.use(flash());

app.use(passport.initialize());
app.use(passport.session());


app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});


app.use(express.static(path.join(__dirname, "public")))




app.set("view engine", "ejs");
app.set('views', [
  path.join(__dirname, 'views'),
  path.join(__dirname, 'views/user'),
  path.join(__dirname, 'views/admin'),
  path.join(__dirname, 'views/partials')
]);





// Routes

app.use('/admin', adminRouter);
app.use('/account',userAccount)
app.use('/cart', userCart)
app.use('/wishlist', userWishlist)
app.use('/checkout', userCheckout)
app.use('/orders', userOrders)
app.use('/', userRouter);



app.listen(PORT, () => {
  console.log(`Server running at port ${PORT}`);
});