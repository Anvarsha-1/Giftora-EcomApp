const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const cloudinary = require('cloudinary').v2;
const extractImageData = require('../../helpers/imageprocess');
const deleteUploadedImages = require('../../helpers/deleteImage');

const viewProduct = async (req, res, next) => {
  try {
    const isClear = req.query.clear === '1';
    const search = isClear ? '' : req.query.search?.trim() || '';
    const categoryFilter = req.query.category || 'all';
    const sortOption = req.query.sort || 'date-newest';
    const page = parseInt(req.query.page) || 1;
    const limit = 4;

    let matchQuery = { isDeleted: { $ne: true } };
    if (search) {
      matchQuery.productName = { $regex: new RegExp(search, 'i') };
    }

    if (categoryFilter !== 'all') {
      const categoryDoc = await Category.findOne({ name: categoryFilter });
      if (categoryDoc) {
        matchQuery.category = categoryDoc._id;
      }
    }

    let sortQuery = { createdAt: -1 };
    if (sortOption === 'price-high-low') {
      sortQuery = { salesPrice: -1 };
    } else if (sortOption === 'price-low-high') {
      sortQuery = { salesPrice: 1 };
    }

    const productData = await Product.find(matchQuery)
      .limit(limit)
      .skip((page - 1) * limit)
      .sort(sortQuery)
      .populate('category')
      .exec();

    const count = await Product.countDocuments(matchQuery);

    const category = await Category.find({ isListed: true, isDeleted: false });

    if (category) {
      res.render('product-view', {
        data: productData,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        cat: category,
        search,
        categoryFilter,
        sortOption,
      });
    } else {
      res.render('admin-404-page');
    }
  } catch (error) {
    console.error('Error loading products page:', error.message);
    next(error);
  }
};

const loadAddProductPage = async (req, res, next) => {
  try {
    const category = await Category.find({ isListed: true, isDeleted: false });
    return res.render('addProduct', {
      cat: category,
      message: '',
      error: null,
    });
  } catch (error) {
    console.error('Error loading Add products page:', error.message);
    next(error);
  }
};

const addProduct = async (req, res) => {
  try {
    const {
      productName,
      description,
      category,
      quantity,
      regularPrice,
      status,
      offerPercentage,
    } = req.body;

    if (
      !productName ||
      !description ||
      !category ||
      !quantity ||
      !regularPrice ||
      !offerPercentage
    ) {
      if (req.files && req.files.length > 0) {
        await deleteUploadedImages(req.files);
        return res.status(400).json({
          success: false,
          error: 'All fields are required',
          formData: req.body,
          cat: await Category.find({ isListed: true, isDeleted: false }),
        });
      }
    }

    const validNameRegex = /^[a-zA-Z0-9 _-]+$/;

    if (!validNameRegex.test(productName)) {
      return res.status(400).json({
        success: false,
        error: 'Product Name only contain alphabets',
        message: 'Product only contain alphabets',
        formData: req.body,
        cat: await Category.find({ isListed: true, isDeleted: false }),
      });
    }

    if (
      isNaN(quantity) ||
      quantity < 0 ||
      isNaN(regularPrice) ||
      regularPrice < 0 ||
      isNaN(offerPercentage) ||
      offerPercentage < 0
    ) {
      if (req.files && req.files.length > 0) {
        await deleteUploadedImages(req.files);
        return res.status(400).json({
          success: false,
          error:
            'Quantity, regular price, and offerPercentage must be non-negative numbers',
          formData: req.body,
          cat: await Category.find({ isListed: true, isDeleted: false }),
        });
      }
    }

    const normalizedProductName = productName.trim().toLowerCase();

    const productExists = await Product.findOne({
      productName: {
        $regex: new RegExp('^' + normalizedProductName + '$', 'i'),
      },
    });

    if (productExists) {
      await deleteUploadedImages(req.files);
      return res.status(400).json({
        success: false,
        error: 'Product already exists, please try with another name',
        formData: req.body,
        cat: await Category.find({ isListed: true, isDeleted: false }),
      });
    }

    if (!req.files || req.files.length !== 3) {
      await deleteUploadedImages(req.files);
      return res.status(400).json({
        success: false,
        error: 'Exactly three images are required',
        formData: req.body,
        cat: await Category.find({ isListed: true, isDeleted: false }),
      });
    }

    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) {
      await deleteUploadedImages(req.files);
      return res.status(400).json({
        success: false,
        error: 'Invalid category',
        formData: req.body,
        cat: await Category.find({ isListed: true, isDeleted: false }),
      });
    }

    if (status === 'Available' && quantity <= 0) {
      await deleteUploadedImages(req.files);
      return res.status(400).json({
        success: false,
        error: 'Quantity must be greater than 0 when status is Available',
        formData: req.body,
        cat: await Category.find({ isListed: true, isDeleted: false }),
      });
    }

    if (status !== 'Available' && quantity > 0) {
      await deleteUploadedImages(req.files);
      return res.status(400).json({
        success: false,
        error: 'Quantity must be 0 when product is not Available',
        formData: req.body,
        cat: await Category.find({ isListed: true, isDeleted: false }),
      });
    }

    console.log(
      req.files.map((file) => ({
        path: file.path,
        size: file.size,
        type: file.mimetype,
      })),
    );

    const images = extractImageData(req.files);

    const productOffer = offerPercentage || 0;
    const categoryOffer = categoryDoc?.categoryOffer || 0;

    const appliedOffer = Math.max(productOffer, categoryOffer);

    const finalPrice = regularPrice - (regularPrice * appliedOffer) / 100;

    const newProduct = new Product({
      productName: productName.trim(),
      description,
      category: categoryDoc._id,
      regularPrice,
      quantity,
      salesPrice: finalPrice,
      productImage: images,
      status: status || 'Available',
      productOffer: offerPercentage || 0,
      bestOffer: appliedOffer,
    });

    await newProduct.save();
    return res.status(200).json({
      success: true,
      message: 'Product added successfully',
    });
  } catch (error) {
    console.error('Error in addProduct:', error.message);
    await deleteUploadedImages(req.files);
    return res.status(500).json({
      success: false,
      error: `An error occurred: ${error.message}`,
      formData: req.body || {},
      cat: await Category.find({ isListed: true, isDeleted: false }),
    });
  }
};

const getEditProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findOne({ _id: id });
    const category = await Category.find({
      isDeleted: { $ne: true },
      isListed: true,
    });
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }
    return res.render('admin/editProduct', {
      cat: category,
      formData: product,
      message: '',
      error: null,
    });
  } catch (error) {
    ('Error message:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to load edit product page',
    });
  }
};

const uploadEditProduct = async (req, res) => {
  try {
    const {
      productName,
      description,
      category,
      quantity,
      regularPrice,
      status,
      productId,
      existingImages = [],
      removedImages = [],
      offerPercentage,
    } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      await deleteUploadedImages(req.files);
      return res.status(404).json({
        success: false,
        error: 'Product not found',
        formData: req.body,
        cat: await Category.find({ isBlocked: true, isDeleted: false }),
      });
    }

    if (
      !productName.trim() ||
      !description.trim() ||
      !category ||
      !quantity.trim() ||
      !regularPrice.trim() ||
      !offerPercentage.trim()
    ) {
      await deleteUploadedImages(req.files);
      return res.status(400).json({
        success: false,
        error: 'All fields are required',
        formData: req.body,
        cat: await Category.find({ isBlocked: true, isDeleted: false }),
      });
    }

    if (
      isNaN(quantity) ||
      quantity < 0 ||
      isNaN(regularPrice) ||
      regularPrice < 0 ||
      isNaN(offerPercentage) ||
      offerPercentage < 0
    ) {
      await deleteUploadedImages(req.files);
      return res.status(400).json({
        success: false,
        error:
          'Quantity, regular price, and offerPercentage  must be non-negative numbers',
        formData: req.body,
        cat: await Category.find({ isBlocked: true, isDeleted: false }),
      });
    }
    const categoryDoc = await Category.find({
      isListed: true,
      isDeleted: false,
    });

    const validNameRegex = /^[a-zA-Z0-9 _-]+$/;

    if (!validNameRegex.test(productName)) {
      return res.status(400).json({
        success: false,
        error: 'Product only contain alphabets',
        message: 'Product only contain alphabets',
        formData: req.body,
        cat: categoryDoc,
      });
    }

    const existing = Array.isArray(existingImages)
      ? existingImages
      : existingImages
        ? [existingImages]
        : [];
    const formattedExisting = existing
      .filter((public_id) => public_id && !removedImages.includes(public_id))
      .map((public_id) => ({
        public_id,
        url: `https://res.cloudinary.com/${process.env.CLOUD_NAME}/image/upload/${public_id}`,
      }));

    const newImages = extractImageData(req.files);

    const finalImages = [...formattedExisting, ...newImages];

    if (finalImages.length !== 3) {
      await deleteUploadedImages(req.files);
      return res.status(400).json({
        success: false,
        error: `You must have exactly 3 images (existing + new). Currently have ${finalImages.length} images.`,
        formData: req.body,
        cat: categoryDoc,
      });
    }

    if (status !== 'Available' && quantity > 0) {
      await deleteUploadedImages(req.files);
      return res.status(400).json({
        success: false,
        error: 'Quantity must be 0 ',
        formData: req.body,
        cat: categoryDoc,
      });
    }

    if (Array.isArray(removedImages) && removedImages.length > 0) {
      for (const public_id of removedImages) {
        if (public_id) {
          try {
            await cloudinary.uploader.destroy(public_id);
          } catch (err) {
            console.error(
              `Failed to delete Cloudinary image ${public_id}:`,
              err.message,
            );
          }
        }
      }
    }

    const categoryDetails = await Category.findById(category);

    const catOffer = categoryDetails?.categoryOffer || 0;
    const proOffer = offerPercentage || 0;

    const appliedOffer = Math.max(catOffer, proOffer);

    const finalAmount = regularPrice - (appliedOffer * regularPrice) / 100;

    product.productName = productName;

    product.description = description;

    product.category = category;

    product.quantity = quantity;

    product.regularPrice = regularPrice;

    product.salesPrice = finalAmount;

    product.status = status || 'Available';

    product.productOffer = offerPercentage;

    product.bestOffer = appliedOffer;

    product.productImage = finalImages;

    await product.save();

    return res
      .status(200)
      .json({ success: true, message: 'Product updated successfully' });
  } catch (error) {
    console.error('Error in uploadEditProduct:', error.message);

    await deleteUploadedImages(req.files);

    return res.status(500).json({
      success: false,

      error: `An error occurred: ${error.message}`,

      formData: req.body || {},

      cat: await Category.find({ isListed: true, isDeleted: false }),
    });
  }
};

const deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    if (!id)
      return res
        .status(404)
        .json({ success: false, error: 'Product id required' });

    const product = await Product.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true },
    );

    if (!product)
      return res
        .status(404)
        .json({ success: false, error: 'Product not found' });

    res
      .status(200)
      .json({ success: true, message: 'Product delete successfully' });
  } catch (error) {
    console.error('Error deleting product:', error.message);

    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const blockProduct = async (req, res) => {
  const { id } = req.params;

  try {
    if (!id)
      return res
        .status(400)
        .json({ success: false, error: 'Product id required' });

    const product = await Product.findById(id);

    if (!product) return res.status(404).json('Product not found');

    product.isBlocked = !product.isBlocked;

    await product.save();

    res.status(200).json({
      success: true,
      message: `Product ${product.isBlocked ? 'Blocked' : 'unblocked'} successfully `,
      product,
    });
  } catch (error) {
    console.log('Error while block product', error.message);

    return res
      .status(500)
      .json({ success: false, error: 'Internal server error' });
  }
};

module.exports = {
  viewProduct,
  loadAddProductPage,
  addProduct,
  getEditProduct,
  uploadEditProduct,
  deleteProduct,
  blockProduct,
};
