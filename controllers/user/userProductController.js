const User = require('../../models/userSchema')
const Products = require('../../models/productSchema')
const category = require('../../models/categorySchema')
const Wishlist = require('../../models/wishListSchema')


const loadProductListingPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    const clearFilter = req.query.clearFilter === '1'
    const clearSearch = req.query.clearSearch === '1'

    const search = clearSearch ? "" : req.query.search || "";
    const selectedCategory = clearFilter ? "" : req.query?.category || '';
    const minPrice = clearFilter ? 0 : parseFloat(req.query?.minPrice) || 0;
    const maxPrice = clearFilter ? Number.MAX_VALUE : parseFloat(req.query?.maxPrice) || Number.MAX_VALUE;
    const sortOption = clearFilter ? 'createdAt-desc' : req.query.sort || 'createdAt-desc';

    const userData = req.session?.user ? await User.findById(req.session?.user) : undefined
    const userId = req.session.user 
    const categories = await category.find({ isListed: true, isDeleted: false });

    const wishlist = await Wishlist.findOne({ userId })
    const wishlistId = wishlist ? wishlist.products.map(item => item.productId.toString()) : []

    let query = {
      isBlocked: false,
      isDeleted: false,
      quantity: { $gt: 0 },
      salesPrice: { $gte: minPrice, $lte: maxPrice },
    };

    if (search) {
      query.productName = { $regex: search, $options: 'i' };
    }

    if (selectedCategory) {
      query.category = selectedCategory;
    }


    let sort = {};
    switch (sortOption) {
      case 'name-asc':
        sort = { productName: 1 };
        break;
      case 'name-desc':
        sort = { productName: -1 };
        break;
      case 'price-asc':
        sort = { salesPrice: 1 };
        break;
      case 'price-desc':
        sort = { salesPrice: -1 };
        break;
      case 'createdAt-desc':
      default:
        sort = { createdAt: -1 };
        break;
    }

    const total = await Products.countDocuments(query);

    let productData = await Products.find(query)
      .skip(skip)
      .limit(limit)
      .sort(sort);

    productData = productData.map(pro => ({
      ...pro._doc,
      productImage: pro.productImage?.[0]?.url || null,
    }));

    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.json({
        products: productData,
        page,
        total,
        totalPages: Math.ceil(total / limit)
      });
    }

    res.render('user/productListingPage', {
      user: userData,
      firstName: userData?.firstName || "",
      products: productData,
      cat: categories,
      currentPage: page,
      totalPage: Math.ceil(total / limit),
      totalProduct: total,
      search,
      categoryFilter: selectedCategory,
      minPrice: req.query.minPrice || '',
      maxPrice: req.query.maxPrice || '',
      sort: sortOption,
      wishlistId :wishlistId
    });

  } catch (error) {
    console.error("Error in loadProductListingPage:", error.message);
    res.status(500).render('user/error',{
      title:500,
      message:"something went wrong. please try again"
    })
  }
};


const viewProductDetails = async (req, res) => {
  try {
    const userData = req.session?.user ? await User.findById(req.session?.user) : undefined
    const id = req.params.id
    const productData = await Products.findById(id)
    if (!productData) return res.status(404).json("product not found")


    if (productData.isBlocked || productData.isDeleted) {
      return res.status(404).render('error', {
        title: "404",
        message: "product not available"
      })
    }

    const relatedProducts = await Products.find({
      category: productData.category,
      isBlocked: false,
      isDeleted: false,
      _id: { $ne: productData._id }
    }).limit(4).sort({ createdAt: -1 })


    const [mainImage, ...subImage] = productData.productImage


    return res.render('user/productDetails', {
      user: userData,
      firstName: userData?.firstName || "",
      product: productData,
      relatedProducts: relatedProducts,
      mainImage,
      subImage
    })
  } catch (error) {
    console.log("Error while loading product Details", error.message);
    return res.status(404).render('user/error', {
      title: "404",
      message: "Page not found"
    })
  }
}




module.exports = {
  loadProductListingPage,
  viewProductDetails,
}