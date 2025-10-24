const User = require('../../models/userSchema');

const loadUserList = async (req, res) => {
  try {
    const isClear = req.query.clear === '1';
    const search = isClear ? '' : req.query.search?.trim() || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 4;

    function escapeRegex(string) {
      return string.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    }

    const query = { isAdmin: false };
    if (search) {
      const escapedSearch = escapeRegex(search);
      query.$or = [
        { firstName: { $regex: new RegExp(escapedSearch, 'i') } },
        { lastName: { $regex: new RegExp(escapedSearch, 'i') } },
        { email: { $regex: new RegExp(escapedSearch, 'i') } },
        { phone: { $regex: new RegExp(escapedSearch, 'i') } },
      ];
    }

    const userdata = await User.find(query)
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const count = await User.countDocuments(query);

    const responseData = {
      users: userdata,
      totalUsers: count,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      search,
    };

    // If it's an AJAX request, send JSON. Otherwise, render the full page.
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.json(responseData);
    }

    res.render('userListing', responseData);
  } catch (error) {
    console.error('Error loading user list:', error);
    return res.status(500).render('admin/internalServer-error');
  }
};

const blockUser = async (req, res) => {
  try {
    const id = req.query.id;
    if (!id) return res.status(400).json({ message: 'User ID is required' });
    const user = await User.findById(id);
    user.isBlocked = !user.isBlocked;
    await user.save();
    const status = user.isBlocked ? 'block' : 'unblock';
    res.json({ message: `Use ${status} Successfully` });
  } catch (error) {
    console.log('Error happen while  blocking user', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = {
  loadUserList,
  blockUser,
};
