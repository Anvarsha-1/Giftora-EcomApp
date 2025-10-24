const Address = require('../../models/addressSchema');
const addressValidation = require('../../helpers/addressValidaion');
const User = require('../../models/userSchema');

const loadAddressDetails = async (req, res) => {
  try {
    const userData = req.session.user
      ? await User.findById(req.session.user)
      : undefined;

    const userId = req.session.user;

    const addresses = await Address.find({ userId });

    res.render('address', { user: userData, addresses: addresses });
  } catch (error) {
    console.error('Failed to load address page:', error);
    res.status(500).render('error', {
      title: 'Something went wrong',
      message: 'We couldn’t load your address details. Please try again later.',
    });
  }
};

const loadAddAddresses = async (req, res, next) => {
  try {
    const userData = req.session.user
      ? await User.findById(req.session.user)
      : undefined;
    return res.render('addAddress', { user: userData });
  } catch (error) {
    console.error('Error while loading add address', error.message);
    next(error);
  }
};

const UpdateAddresses = async (req, res) => {
  try {
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
    } = req.body;
    const userId = req.session.user;

    const validation = await addressValidation(req.body);
    if (!validation.success) {
      return res.json(validation);
    }

    const existingAddress = await Address.findOne({
      userId,
      fullName: { $regex: `^${fullName}$`, $options: 'i' },
      mobileNumber,
      address: { $regex: `^${address}$`, $options: 'i' },
      city: { $regex: `^${city}$`, $options: 'i' },
      district: { $regex: `^${district}$`, $options: 'i' },
      state: { $regex: `^${state}$`, $options: 'i' },
      pinCode,
      addressType,
    });

    if (existingAddress) {
      if (existingAddress.fullName.toLowerCase() !== fullName.toLowerCase()) {
        return res.json({
          success: false,
          message: 'This address already exists with a different name',
        });
      }

      return res.json({
        success: false,
        message: 'This address already exists',
      });
    }

    const newAddress = new Address({
      userId,
      fullName,
      mobileNumber,
      city,
      state,
      address,
      district,
      pinCode,
      landmark,
      addressType,
    });

    await newAddress.save();
    return res.json({ success: true, message: 'Address saved successfully' });
  } catch (error) {
    console.error('Error while add address ', error.message);
    return res.status(500).json({
      success: false,
      message: 'Something Went wrong .Please try again',
    });
  }
};

const loadEditAddress = async (req, res) => {
  try {
    const userData = req.session.user
      ? await User.findById(req.session.user)
      : undefined;

    const address = await Address.findById(req.params.id);

    if (!address) {
      return res.redirect('/account/addresses');
    }
    res.render('editAddresses', { user: userData, address });
  } catch (error) {
    console.error('Error while loading edit page', error.message);
    res.render('error', {
      title: 'Something went wrong',
      message:
        'We couldn’t load your edit address page. Please try again later.',
    });
  }
};

const editAddress = async (req, res) => {
  try {
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
    } = req.body;

    const userId = req.session.user;
    const addressId = req.params.id;

    const editAddress = await Address.findOne({ _id: addressId, userId });

    const validation = await addressValidation(req.body);
    if (!validation.success) {
      return res.json(validation);
    }

    const existingAddress = await Address.findOne({
      userId,
      fullName: { $regex: `^${fullName}$`, $options: 'i' },
      mobileNumber,
      address: { $regex: `^${address}$`, $options: 'i' },
      city: { $regex: `^${city}$`, $options: 'i' },
      district: { $regex: `^${district}$`, $options: 'i' },
      state: { $regex: `^${state}$`, $options: 'i' },
      pinCode,
      addressType,
    });

    if (existingAddress) {
      if (existingAddress.fullName.toLowerCase() !== fullName.toLowerCase()) {
        return res.json({
          success: false,
          message: 'This address already exists with a different name',
        });
      }

      return res.json({
        success: false,
        message: 'This address already exists',
      });
    }

    editAddress.fullName = fullName.trim();
    editAddress.mobileNumber = mobileNumber.trim();
    editAddress.address = address.trim();
    editAddress.city = city.trim();
    editAddress.district = district.trim();
    editAddress.state = state.trim();
    editAddress.landmark = landmark?.trim() || '';
    editAddress.pinCode = pinCode.trim();

    await editAddress.save();
    return res.json({ success: true, message: 'address update successfully' });
  } catch (error) {
    return res.status(500).render('error', {
      title: 'something went wrong',
      message: 'An error occured while updating address. Please try again',
    });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const id = req.params.id;
    const address = await Address.findOneAndDelete({ _id: id, userId });
    if (!address) {
      return res
        .status(404)
        .json({ success: false, message: 'Address not found on database' });
    }
    return res.json({ success: true, message: 'Address deleted successfully' });
  } catch (error) {
    return res.status(500).render('error', {
      title: 'Something went wrong',
      message: 'Error occured while delete address. Please try again',
    });
  }
};

const setDefaultAddress = async (req, res) => {
  try {
    const addressId = req.params.addressId;
    const userId = req.session.user;
    await Address.updateOne(
      { userId: userId, isDefault: true },
      { $set: { isDefault: false } },
    );
    await Address.updateOne({ _id: addressId }, { $set: { isDefault: true } });
    return res.json({ success: true });
  } catch (error) {
    console.error('Error while setting address to default', error.message);
    return res.json({
      success: false,
      message: 'Something went wrong. Please try again',
    });
  }
};

module.exports = {
  loadAddressDetails,
  loadAddAddresses,
  UpdateAddresses,
  loadEditAddress,
  editAddress,
  deleteAddress,
  setDefaultAddress,
};
