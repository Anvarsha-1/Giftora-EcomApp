const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');

const categoryManagement = async (req, res) => {
  try {
    const isClear = req.query.clear === '1';
    const search = isClear ? '' : req.query.search?.trim() || '';

    function escapeRegex(string) {
      return string.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    }
    const escapedSearch = escapeRegex(search);

    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;
    const searchFilter = escapedSearch
      ? {
          $or: [
            { name: { $regex: escapedSearch, $options: 'i' } },
            { description: { $regex: escapedSearch, $options: 'i' } },
          ],
        }
      : {};

    const categoryData = await Category.find({
      ...searchFilter,
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategory = await Category.countDocuments(
      { isDeleted: { $ne: true } },
      searchFilter,
    );
    const totalPages = Math.ceil(totalCategory / limit);
    return res.render('category-page', {
      cat: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategory: totalCategory,
      search,
    });
  } catch (error) {
    console.error('Error in categoryManagement:', error);
    return res.status(500).render('internalServer', {
      message: 'An error occurred while fetching categories.',
    });
  }
};

const addCategory = async (req, res) => {
  try {
    const { name, description, offerPercentage } = req.body;
    const trimmedName = name ? name.trim() : '';
    const trimmedDescription = description ? description.trim() : '';

    // --- Validation ---
    const validCharRegex = /^[a-zA-Z\s]+$/;
    if (!trimmedName || trimmedName.length < 3 || trimmedName.length > 25) {
      return res
        .status(400)
        .json({ error: 'Name must be between 3 and 25 characters.' });
    }
    if (!validCharRegex.test(trimmedName)) {
      return res
        .status(400)
        .json({ error: 'Name can only contain letters and spaces.' });
    }
    if (
      !trimmedDescription ||
      trimmedDescription.length < 10 ||
      trimmedDescription.length > 100
    ) {
      return res
        .status(400)
        .json({ error: 'Description must be between 10 and 100 characters.' });
    }
    if (!validCharRegex.test(trimmedDescription)) {
      return res
        .status(400)
        .json({ error: 'Description can only contain letters and spaces.' });
    }
    const offer = parseFloat(offerPercentage);
    if (isNaN(offer) || offer < 0 || offer > 100) {
      return res.status(400).json({
        error: 'Offer percentage must be a number between 0 and 100.',
      });
    }
    // --- End Validation ---

    const existingCategory = await Category.findOne({
      name: { $regex: `^${trimmedName}$`, $options: 'i' },
    });

    if (existingCategory) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    const newCategory = new Category({
      name: trimmedName,
      description: trimmedDescription,
      categoryOffer: offer,
    });
    await newCategory.save();
    return res.status(201).json({ message: 'Category added successfully' });
  } catch (error) {
    console.error('Error while adding category:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const categoryToggle = async (req, res) => {
  const { id } = req.body;

  try {
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: 'Category ID is required' });
    }
    const category = await Category.findById(id);

    if (!category)
      return res
        .status(404)
        .json({ success: false, message: 'category not found' });

    category.isListed = !category.isListed;

    await category.save();

    return res.status(200).json({
      success: true,
      message: `Category ${category.isListed ? 'listed' : 'unlisted'} updated successfully`,
    });
  } catch (error) {
    console.error('Toggle error:', error.message);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
};

const editCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, description, offerPercentage } = req.body;
    const trimmedName = name ? name.trim() : '';
    const trimmedDescription = description ? description.trim() : '';

    // --- Validation ---
    const validCharRegex = /^[a-zA-Z\s]+$/;
    if (!trimmedName || trimmedName.length < 3 || trimmedName.length > 25) {
      return res
        .status(400)
        .json({ error: 'Name must be between 3 and 25 characters.' });
    }
    if (!validCharRegex.test(trimmedName)) {
      return res
        .status(400)
        .json({ error: 'Name can only contain letters and spaces.' });
    }
    if (
      !trimmedDescription ||
      trimmedDescription.length < 10 ||
      trimmedDescription.length > 100
    ) {
      return res
        .status(400)
        .json({ error: 'Description must be between 10 and 100 characters.' });
    }
    if (!validCharRegex.test(trimmedDescription)) {
      return res
        .status(400)
        .json({ error: 'Description can only contain letters and spaces.' });
    }
    const offer = parseFloat(offerPercentage);
    if (isNaN(offer) || offer < 0 || offer > 100) {
      return res.status(400).json({
        error: 'Offer percentage must be a number between 0 and 100.',
      });
    }
    // --- End Validation ---

    // Check duplicate category name
    const existing = await Category.findOne({
      name: { $regex: `^${trimmedName}$`, $options: 'i' },
      _id: { $ne: id },
    });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, error: 'Category already exists' });
    }

    // Update category
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      {
        name: trimmedName,
        description: trimmedDescription,
        categoryOffer: offer,
      },
      { new: true },
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }

    await Product.updateMany({ category: id }, [
      {
        $set: {
          bestOffer: { $max: ['$productOffer', offer || 0] },
          salesPrice: {
            $round: [
              {
                $subtract: [
                  '$regularPrice',
                  {
                    $multiply: [
                      '$regularPrice',
                      {
                        $divide: [{ $max: ['$productOffer', offer || 0] }, 100],
                      },
                    ],
                  },
                ],
              },
              2,
            ],
          },
        },
      },
    ]);

    res
      .status(200)
      .json({ message: 'Category and related products updated successfully' });
  } catch (error) {
    console.error('Edit category error:', error);
    res.status(500).json({ message: 'Server error while updating category' });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await Category.findById(id);

    if (!existing) return res.status(404).json({ error: 'category not found' });

    const update = await Category.findByIdAndUpdate(
      id,

      { $set: { isDeleted: true, deletedAt: new Date() } },
    );

    if (!update) {
      res.status(400).json({ error: 'Unable to delete Category' });
    }

    await Product.updateMany(
      { category: id },
      { status: 'Discontinued', isBlocked: true },
    );

    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.log('Error occured while delete user', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  categoryManagement,
  addCategory,
  categoryToggle,
  editCategory,
  deleteCategory,
};
