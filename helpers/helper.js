require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: 'Verify Your Account – Giftora',
      text: `Your OTP is ${otp}`,
      html: `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb; padding: 30px;">
      <div style="max-width: 600px; margin: auto; background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        
        <!-- Logo -->
        <div style="text-align: center; margin-bottom: 20px;">
           <img src="https://res.cloudinary.com/djomhymvk/image/upload/v1752469640/gifttora_xcumfi.png" alt="Giftora Logo" style="height: 60px;" />
                          
        </div>

        <!-- Title -->
        <h2 style="color: #1f2937; text-align: center;">Account Verification</h2>

        <!-- Message -->
        <p style="color: #4b5563; font-size: 16px;">
          Thank you for registering with <strong>Giftora</strong>.<br>
          To continue, please use the following One-Time Password (OTP) to verify your account:
        </p>

        <!-- OTP Box -->
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 28px; letter-spacing: 4px; color: #111827; font-weight: bold; background-color: #f3f4f6; padding: 12px 20px; border-radius: 6px; display: inline-block;">
            ${otp}
          </span>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          This OTP is valid for the next 5 minutes. Please do not share it with anyone.
        </p>

        <!-- Footer -->
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          Need help? Contact us at <a href="mailto:giftora123@gmail.com" style="color: #3b82f6;">giftora123@gmail.com</a><br>
          &copy; ${new Date().getFullYear()} Giftora. All rights reserved.
        </p>

      </div>
    </div>
  `,
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.error('Error sending email', error);
    return false;
  }
}

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.error('Error hashing password:', error.message);
    throw error;
  }
};

module.exports = {
  generateOtp,
  sendVerificationEmail,
  securePassword,
};
