const express = require("express");
const env = require("dotenv").config();
const DB = require("./config/db");
const path = require("path");
const PORT = process.env.PORT || 3000;
const userRouter = require("./routers/user/userRouter");
const adminRouter = require('./routers/admin/adminRouter');
const session = require('express-session');
const app = express();
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
app.use('/', userRouter);
app.use('/admin', adminRouter);




app.listen(PORT, () => {
  console.log(`Server running at port ${PORT}`);
});