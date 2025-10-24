const addressValidation = async (data) => {
  const {
    fullName,
    mobileNumber,
    city,
    state,
    district,
    pinCode,
    landmark,
    addressType,
    address,
  } = data;

  if (
    !fullName ||
    !mobileNumber ||
    !city ||
    !state ||
    !district ||
    !pinCode ||
    !addressType ||
    !address
  ) {
    return {
      success: false,
      message:
        'All required fields (Full Name, Mobile Number, City, State, District, Pin Code, Address Type) must be provided',
    };
  }

  const nameRegex = /^[a-zA-Z\s'-]{3,50}$/;
  if (!nameRegex.test(fullName.trim())) {
    return {
      success: false,
      message:
        'Full Name must be 3-50 characters long and contain only letters, spaces, hyphens, or apostrophes',
    };
  }
  if (address.trim().length < 5) {
    return {
      success: false,
      message: 'Address must be at least 5 characters long',
    };
  }

  if (address.trim().length > 200) {
    return {
      success: false,
      message: 'Address must not exceed 200 characters',
    };
  }

  const addressRegex = /^[a-zA-Z0-9\s.,#-]+$/;
  if (!addressRegex.test(address.trim())) {
    return {
      success: false,
      message:
        'Address can only contain letters, numbers, spaces, commas, periods, hyphens, or hashtags',
    };
  }

  const mobileRegex = /^[6-9]\d{9}$/;
  if (!mobileRegex.test(mobileNumber.trim())) {
    return {
      success: false,
      message:
        'Mobile Number must be a valid 10-digit number starting with 6, 7, 8, or 9',
    };
  }

  const cityRegex = /^[a-zA-Z\s'-]{2,30}$/;
  if (!cityRegex.test(city.trim())) {
    return {
      success: false,
      message:
        'City must be 2-30 characters long and contain only letters, spaces, hyphens, or apostrophes',
    };
  }

  const stateRegex = /^[a-zA-Z\s'-]{2,30}$/;
  if (!stateRegex.test(state.trim())) {
    return {
      success: false,
      message:
        'State must be 2-30 characters long and contain only letters, spaces, hyphens, or apostrophes',
    };
  }

  if (!cityRegex.test(district.trim())) {
    return {
      success: false,
      message:
        'District must be 2-30 characters long and contain only letters, spaces, hyphens, or apostrophes',
    };
  }

  const pinCodeRegex = /^\d{6}$/;
  if (!pinCodeRegex.test(pinCode.trim())) {
    return {
      success: false,
      message: 'Pin Code must be a valid 6-digit number',
    };
  }

  if (landmark && !/^[a-zA-Z0-9\s',.-]{0,100}$/.test(landmark.trim())) {
    return {
      success: false,
      message:
        'Landmark can be up to 100 characters and contain only letters, numbers, spaces, commas, periods, or hyphens',
    };
  }

  const validAddressTypes = ['home', 'office', 'other'];
  if (!validAddressTypes.includes(addressType.toLowerCase())) {
    return {
      success: false,
      message: "Address Type must be 'home', 'office', or 'other'",
    };
  }

  return { success: true, message: 'Address validation successful' };
};

module.exports = addressValidation;
