
const User = require('../../models/userSchema')
const { generateOtp } = require('../../helpers/helper')
const { sendVerificationEmail, securePassword } = require('../../helpers/helper')
const extractImageData = require('../../helpers/imageprocess')
const Wishlist = require('../../models/wishListSchema')
const cloudinary = require('../../helpers/cloudinary')
const bcrypt = require("bcrypt")
const Wallet = require('../../models/walletSchema')
const mongoose = require('mongoose')
const Order = require('../../models/orderSchema.js')
const Product = require('../../models/productSchema.js')



const myAccountDetails = async (req, res) => {
    try {
        const id = req.session.user
        console.log(id)
        const result = await Wishlist.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(id) } },
            { $project: { userId: 1, WishlistCount: { $size: "$products" } } }
        ]);

        const wishlistCount = result[0]?.WishlistCount || 0;

        const OrderResult = await Order.aggregate([
            { $group: { _id: "$id", Count: { $sum: 1 } } }
        ]);

        const total = await Order.aggregate([{ $match: { userId: new mongoose.Types.ObjectId(id), status: 'Delivered' } }, { $group: { _id: '$id', amount: { $sum: '$totalPrice' } } }])

        const totalAmount = total[0]?.amount

        const orderCount = OrderResult[0]?.Count || 0

        if (!id) return res.render('error-page', { showSwal: true, message: "User not found" })

        const userData = await User.findById(id);

        return res.render('myAccount', { user: userData, wishlistCount, orderCount, totalAmount })

    }
    catch (error) {
        console.log('error in myAccount page', error.message)
        return res.status(500).render("error-page", { showSwal: true, message: "Something went wrong while loading myAccount" })
    }
}


const loadUpdateEmail = async (req, res) => {
    try {
        const userData = req.session.user ? await User.findById(req.session.user) : undefined

        res.render('user/changeemail', { user: userData })
        
    } catch (error) {
        console.log("Error while loading update email", error.message)
        res.status(500).render('error-page', { showSwal: true, message: "something went wrong .Please try again" })
    }
}

const updateEmailAddress = async (req, res) => {
    try {
        const { email } = req.body

        console.log(email)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email) {
            return res.json({ success: false, message: "Email is required" })
        }

        if (!emailRegex.test(email)) {
            return res.json({ success: false, message: "Enter a valid email" })
        }

        const exist = await User.findOne({ email })

        if (exist) {
            return res.json({ success: false, message: "Email already exist" })
        }

        const otp = generateOtp()
        req.session.otp = otp;
        req.session.email = email;
        console.log("OTP ", req.session.otp)
        console.log("Email", req.session.email)
        sendVerificationEmail(email, otp)
        return res.json({ success: true, message: "Otp successfully send to new email." })

    } catch (error) {
        console.error('error while update email ', error.message)
        return res.json({ success: false, message: "Something went wrong please try again" })
    }
}

const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body

        console.log(otp)

        const OTP = otp.trim()

        if (!OTP) {
            res.json({ success: false, message: "OTP required" })
        }

        if (OTP.length < 6) {
            res.json({ success: false, message: "Invalid otp" })
        }
        if (OTP !== req.session.otp) {
            res.json({ success: false, message: "Invalid otp" })
        }
        if (OTP === req.session.otp) {
            const user = await User.findById(req.session.user)

            if (!user) {
                return res.json({ success: false, message: "User not found" })
            }

            user.email = req.session.email

            await user.save()

            return res.json({ success: true, message: 'Email update successfully' })
        }

    } catch (error) {

        console.log("Error while email change verify otp ", error.message)

        return res.json({ success: false, message: "Something went wrong while updating email. Please try again" })

    }
}


const loadUpdateUserDetails = async (req, res) => {
    try {
        const userData = req.session.user ? await User.findById(req.session.user) : undefined

        res.render('changedetails', { user: userData })

    } catch (error) {

        res.status(500).render("error-page")
    }
}

const updateUserDetails = async (req, res) => {
    try {
        const { firstName, lastName, phone, removeProfileImage } = req.body;
        const id = req.session.user;

        console.log(firstName, lastName, phone, removeProfileImage);

        const validName = /^[A-Za-z\s]+$/;
        const phoneRegex = /^[6-9]\d{9}$/;


        if (!firstName || !lastName || !phone) {
            return res.json({ success: false, message: "All fields required" });
        }
        if (!validName.test(firstName) || !validName.test(lastName)) {
            return res.json({ success: false, message: "Name should only contain alphabets" });
        }
        if (firstName.length < 4) {
            return res.json({ success: false, message: "First Name should be at least 4 letters" });
        }
        if (!phoneRegex.test(phone)) {
            return res.json({ success: false, message: "Please enter a valid phone number" });
        }




        // const existingPhone = await User.findOne({ phone, _id: { $ne: id } });
        // if (existingPhone) {
        //     return res.json({ success: false, message: "Number is already existing" });
        // }


        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }


        const uploadedImage = req.file;
        const wantsToRemoveImage = removeProfileImage === 'true';
        const hasCloudinaryImage = user.profileImage?.public_id;
        const hasGoogleImage = user.profileImage?.url?.includes('googleusercontent')


        if ((wantsToRemoveImage || uploadedImage) && (hasCloudinaryImage || hasGoogleImage)) {

            if (hasCloudinaryImage) {
                await cloudinary.uploader.destroy(user.profileImage.public_id);
            }


            user.profileImage = null;
        }


        let image = null

        if (req.file) {
            image = extractImageData([req.file])[0];
            if (image) {
                user.profileImage = image;
            }
        }

        user.firstName = firstName;
        user.lastName = lastName;
        user.phone = phone;

        await user.save();

        return res.json({ success: true, message: "Profile updated successfully" });

    } catch (error) {
        console.error('Error in updateUserDetails:', error.message);
        return res.status(500).json({ success: false, message: "Something went wrong while updating profile. Please try again" });
    }
};


const loadPasswordChange = async (req, res) => {
    try {
        const userData = req.session.user ? await User.findById(req.session.user) : undefined
        return res.render('changePassword', { user: userData })
    } catch (error) {
        console.log("Error while loading change password", error.message)
        return res.status(500).render('error-page')
    }

}


const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body
        console.log(currentPassword, newPassword, confirmPassword)
        const user = await User.findById(req.session.user)

        if (!currentPassword || !confirmPassword || !newPassword) {
            return res.json({ success: false, message: "All field is required" })
        }

        if (!user) {
            return res.json({ success: false, message: "User not found .Please try again" })
        }

        const match = await bcrypt.compare(currentPassword, user?.password)

        if (!match) {
            return res.json({ success: false, message: "Incorrect current password" })
        }

        if (newPassword.length < 6) {
            return res.json({ success: false, message: "new password length must be at least 6 characters" })
        }
        if (newPassword !== confirmPassword) {
            return res.json({ success: false, message: "new Password and confirm password  does not match" })
        }

        const hashedPassword = await securePassword(newPassword)

        if (!hashedPassword) {
            return res.json({ success: false, message: "An error occured while hashing password. Please try again" })
        }

        console.log(hashedPassword)

        user.password = hashedPassword

        await user.save()

        return res.json({ success: true, message: "Password Update Successfully" })

    } catch (error) {

        console.error("Error during password update:", error.message);

        return res.status(500).json({
            success: false,
            message: "Something went wrong while updating the password. Please try again later.",
        });
    }
}


const loadMyWallet = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId)
        const wallet = await Wallet.findOne({ userId });

        if (!wallet) {
            return res.render('user/myWallet', {
                wallet: { balance: 0, transactions: [] }, user
            });
        }

        res.render('user/myWallet', { wallet, user });
    } catch (error) {
        console.error("Error loading wallet:", error.message);
        res.render('user/myWallet', {
            wallet: { balance: 0, transactions: [] }
        });
    }
};





module.exports = {
    myAccountDetails,
    loadUpdateEmail,
    updateEmailAddress,
    verifyOtp,
    loadUpdateUserDetails,
    updateUserDetails,
    loadPasswordChange,
    changePassword,
    loadMyWallet

}