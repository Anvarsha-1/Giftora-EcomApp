const User = require('../models/userSchema');
const bcrypt = require('bcrypt');

const validateLogin = async (loginData) => {
    const { email, password } = loginData;
    let errors = {};

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Email validation
    if (!email || !emailPattern.test(email)) {
        errors.email = 'Invalid Email format';
    } else {
        const findEmail = await User.findOne({ email });
        if (!findEmail) {
            errors.email = 'Email is not registered';
        } else if (!findEmail.isAdmin) {
            errors.email = 'Not an admin account';
        }
    }

    // Password validation
    if (!password || password.length < 6) {
        errors.password = 'Password must be at least 6 characters';
    } else {
        const admin = await User.findOne({ email, isAdmin: true });
        if (admin) {
            console.log("admin",admin)
            if(!admin.password){
                errors.password = 'This account uses Google sign-in. Please use Signin account'
            }
            const isMatch = await bcrypt.compare(password, admin.password);
            if (!isMatch) {
                errors.password = 'Invalid Password';
            }
        }
    }

    return errors;
};

module.exports = validateLogin;