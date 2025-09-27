const User = require('../models/userSchema'); 

const validateSignupForm = async (formData) => {
  const { firstName, lastName, phone, email, password, confirmPassword ,referralCode} = formData;
  let errors = {};

  const nameRegex = /^[A-Za-z\s'-]+$/;

  if (!firstName || !nameRegex.test(firstName)) {
    errors.firstName = "Name must contain only letters and valid characters.";
  } else if (firstName.trim().length < 3 || firstName.length > 15) {
    errors.firstName = "First name must be at least 3-15 characters";
  }

  

  if (!lastName || lastName.trim().length < 1 || lastName.trim().length > 15 ) {
    errors.lastName = "Last name must be at least 1-15 character";
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

const emailRegex = /^[A-Za-z0-9]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

  if(!emailRegex.test(email)){
     errors.email = "Invalid email format";
  }



  // const existingPhone = await User.findOne({ phone });
  // if (existingPhone) {
  //   errors.phone = "Phone number already registered";
  // }

 

  if (!password || password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  } else if (!/[a-z]/.test(password)) {
    errors.password = "Password must contain at least one lowercase letter";
  } else if (!/[A-Z]/.test(password)) {
    errors.password = "Password must contain at least one uppercase letter";
  } else if (!/[0-9]/.test(password)) {
    errors.password = "Password must contain at least one number";
  } else if (!/[^A-Za-z0-9]/.test(password)) {
    errors.password = "Password must contain at least one special character";
  } else if (password.length > 15) {
    errors.password = "Password must not exceed 15 characters";
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
