const User = require('../../models/userSchema')
const Products = require('../../models/productSchema')
const category = require('../../models/categorySchema')
const Wishlist = require('../../models/wishListSchema')
const mongoose = require('mongoose')


const loadProductListingPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    const clearFilter = req.query.clearFilter === '1';
    const clearSearch = req.query.clearSearch === '1';

    const search = clearSearch ? "" : decodeURIComponent(req.query.search || "").trim();
    console.log(search)
    const selectedCategory = clearFilter ? "" : req.query?.category || '';
    const minPrice = clearFilter ? 0 : parseFloat(req.query?.minPrice) || 0;
    const maxPrice = clearFilter ? Number.MAX_VALUE : parseFloat(req.query?.maxPrice) || Number.MAX_VALUE;
    const sortOption = clearFilter ? 'createdAt-desc' : req.query.sort || 'createdAt-desc';

    const userData = req.session?.user ? await User.findById(req.session?.user) : undefined;
    const userId = req.session.user;
    const categories = await category.find({ isListed: true, isDeleted: false });
    const wishlist = await Wishlist.findOne({ userId });

    let aggregation = [];

    if (search) {
      aggregation.push({
        $search: {
          index: 'default',
          text: { query: search, path: 'productName', fuzzy: { maxEdits: 2 } }
        }
      });
    }
     
    const match = {
      isBlocked: false,
      isDeleted: false,
      quantity: { $gt: 0 },
      salesPrice: { $gte: minPrice, $lte: maxPrice }
    };
    if (selectedCategory) match.category = new mongoose.Types.ObjectId(selectedCategory);

    aggregation.push({ $match: match });

    let sortObj = { createdAt: -1 };
    switch (sortOption) {
      case 'name-asc': sortObj = { productName: 1 }; break;
      case 'name-desc': sortObj = { productName: -1 }; break;
      case 'price-asc': sortObj = { salesPrice: 1 }; break;
      case 'price-desc': sortObj = { salesPrice: -1 }; break;
    }

    aggregation.push({ $sort: sortObj });
    aggregation.push({ $skip: skip });
    aggregation.push({ $limit: limit });
    
  
    let productData = await Products.aggregate(aggregation);
    productData = productData.map(pro => ({
      ...pro,
      productImage: pro.productImage?.[0]?.url || null
    }));

    let countPipeline = [];
    if (search) {
      countPipeline.push({
        $search: {
          index: 'default',
          text: { query: search, path: 'productName', fuzzy: { maxEdits: 2 } }
        }
      });
    }
    countPipeline.push({ $match: match });
    countPipeline.push({ $count: "total" });

    const totalResult = await Products.aggregate(countPipeline);
    const total = totalResult[0]?.total || 0;
 

    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.json({
        products: productData,
        page,
        total,
        totalPages: Math.ceil(total / limit)
      });
    }

    res.render('user/productListingPage', {
      user: userData || null,
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
      wishlistId: wishlist ? wishlist.products.map(item => item.productId.toString()) : []
    });

  } catch (error) {
    console.error("Error in loadProductListingPage:", error.message);
    res.status(500).render('user/error', {
      title: 500,
      message: "something went wrong. please try again"
    });
  }
};



const viewProductDetails = async (req, res) => {
  try {
    const userData = req.session?.user
      ? await User.findById(req.session?.user)
      : undefined;

    const id = req.params.id;

    const productData = await Products.findById(id);
    if (!productData) return res.status(404).json("product not found");

    const userId = req.session.user;


    let wishlistIds = [];

    if (userId) {
      const wishlistDoc = await Wishlist.findOne({ userId });

      if (wishlistDoc) {
        wishlistIds = wishlistDoc.products.map(item =>
          item.productId.toString()
        );

      }
    }

    if (productData.isBlocked || productData.isDeleted) {
      return res.status(404).render("error", {
        title: "404",
        message: "product not available",
      });
    }

    const relatedProducts = await Products.find({
      category: productData.category,
      isBlocked: false,
      isDeleted: false,
      _id: { $ne: productData._id },
    })
      .limit(4)
      .sort({ createdAt: -1 });

    const [mainImage, ...subImage] = productData.productImage;


console.log(productData)
    return res.render("user/productDetails", {
      user: userData,
      firstName: userData?.firstName || "",
      product: productData,
      relatedProducts,
      mainImage,
      subImage,
      wishlistId: wishlistIds,
    });
  } catch (error) {
    console.log("Error while loading product Details", error.message);
    return res.status(404).render("user/error", {
      title: "404",
      message: "Page not found",
    });
  }
};





module.exports = {
  loadProductListingPage,
  viewProductDetails,
}