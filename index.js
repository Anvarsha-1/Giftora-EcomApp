require('dotenv').config();
const express = require('express');
const DB = require('./config/db');
const path = require('path');
const PORT = process.env.PORT || 3000;
require('events').EventEmitter.defaultMaxListeners = 20;
const userRouter = require('./routers/user/userRouter');
const adminRouter = require('./routers/admin/adminRouter');
const userAccount = require('./routers/user/userAccount');
const userCart = require('./routers/user/userCart');
const userWishlist = require('./routers/user/userWishlist');
const userCheckout = require('./routers/user/userCheckout');
const userOrders = require('./routers/user/orderRouter');
const adminOrders = require('./routers/admin/adminOrderRouter');
const payment = require('./routers/user/payment.router');
const session = require('express-session');
const app = express();
const AdminCoupon = require('./routers/admin/admin-coupon-management');
const userCoupon = require('./routers/user/userCouponRouter');
const adminSales = require('./routers/admin/adminSalesReportRouter');
const errorHandler = require('./helpers/error-handler-middleware');
const { searchVisibility }= require('./middlewares/showSearchbar')


const isProduction = process.env.NODE_ENV === 'production';

DB();

app.use(
  session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction, // Use secure cookies in production
      httpOnly: true,
      sameSite: isProduction ? 'none' : 'lax', // 'lax' is a safe default for development
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

const passport = require('./config/passport');

app.use(passport.initialize());
app.use(passport.session());

const flash = require('express-flash');

app.disable('x-powered-by');

if (!process.env.SECRET_KEY) {
  console.error('SECRET_KEY environment variable is required');
  process.exit(1);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(flash());

app.use((req, res, next) => {
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate',
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', [
  path.join(__dirname, 'views'),
  path.join(__dirname, 'views/user'),
  path.join(__dirname, 'views/admin'),
  path.join(__dirname, 'views/partials'),
]);

app.use(searchVisibility)

// Routes
//User
app.use('/account', userAccount);
app.use('/cart', userCart);
app.use('/wishlist', userWishlist);
app.use('/checkout', userCheckout);
app.use('/orders', userOrders);
app.use('/', userRouter);
app.use('/coupons', userCoupon);

//Admin
app.use('/admin', adminRouter);
app.use('/admin', adminOrders);
app.use('/payment', payment);
app.use('/admin', AdminCoupon);
app.use('/sales', adminSales);



app.use((req, res, next) => {
  const err = new Error('Page not found');
  err.status = 404;
  next(err);
});

//error handling middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running at port ${PORT}`);
});
