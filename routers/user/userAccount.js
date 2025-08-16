const express = require("express");
const router = express.Router();
const { userAuth } = require('../../middlewares/auth')
const userAddress = require('../../controllers/user/userAddress')
const userAccount = require('../../controllers/user/userAccount')
const upload = require('../../helpers/multer')



//USER PROFILE
router.get('/profile', userAuth, userAccount.myAccountDetails)

router.get('/profile/update/email', userAuth, userAccount.loadUpdateEmail)

router.patch('/profile/update/email', userAuth, userAccount.updateEmailAddress)

router.patch('/profile/verify/otp', userAuth, userAccount.verifyOtp)

router.get('/profile/update/details', userAuth, userAccount.loadUpdateUserDetails)

router.patch('/profile/update/details', userAuth, upload.single('profileImage'), userAccount.updateUserDetails)

router.get('/change/password', userAuth, userAccount.loadPasswordChange)

router.patch('/change/password', userAuth, userAccount.changePassword)


//USER ADDRESS
router.get('/addresses', userAuth, userAddress.loadAddressDetails)

router.get('/add/addresses', userAuth, userAddress.loadAddAddresses)

router.post('/add/addresses', userAuth, userAddress.UpdateAddresses)

router.get('/edit/addresses/:id', userAuth, userAddress.loadEditAddress)

router.put('/edit/addresses/:id', userAuth, userAddress.editAddress)

router.delete('/delete/addresses/:id', userAuth, userAddress.deleteAddress)

router.patch('/set-default/addresses/:addressId',userAuth,userAddress.setDefaultAddress)


//USER WALLET
router.get('/wallet', userAuth, userAccount.loadMyWallet)


module.exports = router