const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const env = require("dotenv").config();

const PageNotFound = async (req, res) => {
  try {
    res.status(404).render("user/Page-404", {
      title: "404 - Page Not Found",
      message: "Oops! The page you're looking for doesn't exist.",
    });
  } catch (error) {
    console.error("Error rendering 404 page:", error.message);
    res.redirect("/");
  }
};

const loadHomePage = async (req, res) => {
  try {
    return res.render("user/landing-page");
  } catch (error) {
    console.log("Home page not found");
    res.status(500).send("Server Error");
  }
};

const loadSignUp = async (req, res) => {
  try {
    return res.render("user/signUp-page");
  } catch (error) {
    console.log("Sign Up page not found");
    res.status(500).send("Server Error");
  }
};

function generateOtp() {
  return Math.floor(10000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });
    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP : ${otp}</b>`,
    });
    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending email");
    return false;
  }
}

const signUp = async (req, res) => {
  try {
    const { firstName, lastName, phone, email, password, confirmPassword } =
      req.body;
    if (password !== confirmPassword) {
      return res.render("user/signUp-page", {
        message: "Password does not match",
      });
    }
    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("signUp", {
        message: "User with email already exists",
      });
    }

    const otp = generateOtp();
    console.log(otp);
    const emailSender = await sendVerificationEmail(email, otp);
    console.log(emailSender);
    if (!emailSender) return res.json("email-error");
    
    res.render("user/verify-otp");
  } catch (error) {
    console.log(error.message);
    res.render("signUp", { message: "Error sending email" });
  }
};

module.exports = {
  loadHomePage,
  PageNotFound,
  loadSignUp,
  signUp,
};
