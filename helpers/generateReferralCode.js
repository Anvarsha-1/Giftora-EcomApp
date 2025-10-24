const User = require('../models/userSchema');

function generateReferralCode() {
  const prefix = 'GIFT';
  const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
  return `${prefix}${randomNum}`;
}

async function createUniqueReferralCode() {
  let code;
  let exists = true;

  while (exists) {
    code = generateReferralCode();
    exists = await User.findOne({ referralCode: code });
  }
  return code;
}

module.exports = createUniqueReferralCode;
