const User = require('../models/userSchema'); 

const validateSignupForm = async (formData) => {
  const { firstName, lastName, phone, email, password, confirmPassword ,referralCode} = formData;
  let errors = {};

  const nameRegex = /^[A-Za-z\s'-]+$/;

  if (!firstName || !nameRegex.test(firstName)) {
    errors.firstName = "Name must contain only letters and valid characters.";
  } else if (firstName.trim().length < 4) {
    errors.firstName = "First name must be at least 4 characters";
  }

  if (!lastName || lastName.trim().length < 1) {
    errors.lastName = "Last name must be at least 1 character";
  } else if (!nameRegex.test(lastName)) {
    errors.lastName = "Name must contain only letters and valid characters.";
  }

  const phonePattern = /^[6-9]\d{9}$/;
  if (!phone || !phonePattern.test(phone)) {
    errors.phone = "Enter a valid Indian phone number";
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailPattern.test(email)) {
    errors.email = "Invalid email format";
  } else {
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      errors.email = "Email is already registered";
    }
  }


  // const existingPhone = await User.findOne({ phone });
  // if (existingPhone) {
  //   errors.phone = "Phone number already registered";
  // }

  if (!password || password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  }

  if (confirmPassword !== password) {
    errors.confirmPassword = "Passwords do not match";
  } 
  if (referralCode){
    const inviter = await User.findOne({ referralCode: referralCode })
     if(!inviter){
       errors.referralCode = "Invalid code"
     }
  }

  return errors;
};

module.exports = validateSignupForm;
