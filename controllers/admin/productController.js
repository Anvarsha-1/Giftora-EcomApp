const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const cloudinary = require('cloudinary').v2;
const extractImageData = require('../../helpers/imageprocess')
const deleteUploadedImages = require('../../helpers/deleteImage')

const viewProduct = async (req, res) => {
  try {
    const isClear = req.query.clear==="1"
    const search  = isClear ? "" : req.query.search?.trim() || "";
    const page =parseInt(req.query.page) || 1
    const limit = 4;

    const productData  = await Product.find({
       isDeleted:{$ne:true},
         $or:[{
          productName:{$regex:new  RegExp(".*"+search+".*","i")},

        }]

    }).limit(limit*1).skip((page-1)*limit).sort({createdAt:-1}).populate('category').exec();

  

    const count = await Product.find({
      isDeleted:{$ne:true},
      $or:[{
        productName: { $regex: new RegExp(".*" + search + ".*", "i") }
      }]
    }).countDocuments();

    const category = await Category.find({isListed:true ,isDeleted:false});

    if(category){
      res.render("product-view",{
        data:productData,
        currentPage:page,
        totalPages:Math.ceil(count/limit),
        cat:category,
        search,
      })
      
    }else{
      res.render('admin-404-page')
    }
    
  } catch (error) {
    console.log("Error loading products page:", error);
    res.status(500).redirect("/pageNotFound");
  }
};


const loadAddProductPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true, isDeleted: false });
    return res.render("addProduct", { 
      cat: category,
      message: "",
      error: null,
    });
  } catch (error) {
    console.log("Error loading Add products page:", error);
    return res.status(500).json({
      success: false,
      error: 'Failed to load add product page'
    });
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
    } = req.body;

     console.log("Product name in add product",productName)
    
    if (!productName || !description || !category || !quantity || !regularPrice ) {
      await deleteUploadedImages(req.files);
      return res.status(400).json({
        success: false,
        error: 'All fields are required',
        formData: req.body,
        cat: await Category.find({ isListed: true, isDeleted: false }),
      });
    }

    const validNameRegex = /^[a-zA-Z0-9 _-]+$/

    if(!validNameRegex.test(productName)){
      return res.status(400).json({
        success:false,
        error:"Product Name only contain alphabets",
        message:"Product only contain alphabets",
        formData: req.body,
        cat: await Category.find({ isListed: true, isDeleted: false }),
      })
    }

   
    if (isNaN(quantity) || quantity < 0 || isNaN(regularPrice) || regularPrice < 0) {
      await deleteUploadedImages(req.files);
      return res.status(400).json({
        success: false,
        error: 'Quantity and price must be non-negative numbers',
        formData: req.body,
        cat: await Category.find({ isListed: true, isDeleted: false }),
      });
    }

    
    const normalizedProductName = productName.trim().toLowerCase();
    console.log('Checking productName:', normalizedProductName); 

   
    const productExists = await Product.findOne({
      productName: { $regex: new RegExp('^' + normalizedProductName + '$', 'i') },
    });
    
    console.log('Duplicate product found:', productExists);
    if (productExists) {
      console.log('Duplicate product found:', productExists);
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
    
    console.log("Files received:");
    console.log(req.files.map(file => ({
      path: file.path,
      size: file.size,
      type: file.mimetype
    })));


 
    const images = extractImageData(req.files);

   
    const newProduct = new Product({
      productName: productName.trim(), 
      description,
      category: categoryDoc._id,
      regularPrice,
      quantity,
      productImage: images,
      status: status || 'Available',
    });

    await newProduct.save();
    console.log('Product saved:', newProduct); 
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
    const {id} = req.params
    const product = await Product.findOne({ _id: id });
    const category = await Category.find({
      isDeleted: { $ne: true },
      isListed: true,
    });
    if (!product) {
      console.log("Product not found");
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    return res.render('admin/editProduct', {
      cat: category,
      formData: product,
      message: "",
      error: null,
    });
  } catch (error) {
    console.log("Error message:", error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to load edit product page'
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
    } = req.body;

  
    const product = await Product.findById(productId);
    if (!product) {
      await deleteUploadedImages(req.files);
      return res.status(404).json({
        success:false,
        error: "Product not found",
        formData: req.body,
        cat: await Category.find({ isBlocked: true, isDeleted: false }),
      });
    }

    
    if (!productName.trim() || !description.trim() || !category || !quantity.trim() || !regularPrice.trim()) {
      await deleteUploadedImages(req.files);
      return res.status(400).json({
        success:false,
        error: "All fields are required",
        formData: req.body,
        cat: await Category.find({ isBlocked: true, isDeleted: false }),
      });
    }

    if (isNaN(quantity) || quantity < 0 || isNaN(regularPrice) || regularPrice < 0) {
      await deleteUploadedImages(req.files);
      return res.status(400).json({
        success:false,
        error: "Quantity and price must be non-negative numbers",
        formData: req.body,
        cat: await Category.find({ isBlocked: true, isDeleted: false }),
      });
    }

    const validNameRegex = /^[a-zA-Z0-9 _-]+$/

    if(!validNameRegex.test(productName)){
      return res.status(400).json({
        success:false,
        error:"Product only contain alphabets",
        message:"Product only contain alphabets",
        formData: req.body,
        cat: await Category.find({ isBlocked: true, isDeleted: false }),
      })
    }

  
    const existing = Array.isArray(existingImages) ? existingImages : (existingImages ? [existingImages] : []);
    const formattedExisting = existing
      .filter(public_id => public_id && !removedImages.includes(public_id)) 
      .map(public_id => ({
        public_id,
        url: `https://res.cloudinary.com/${process.env.CLOUD_NAME}/image/upload/${public_id}`,
      }));

    
    const newImages = extractImageData(req.files);

    
    const finalImages = [...formattedExisting, ...newImages];

  
    if (finalImages.length !== 3) {
      await deleteUploadedImages(req.files);
      return res.status(400).json({
        success:false,
        error: `You must have exactly 3 images (existing + new). Currently have ${finalImages.length} images.`,
        formData: req.body,
        cat: await Category.find({ isListed: true, isDeleted: false }),
      });
    }

  
    if (Array.isArray(removedImages) && removedImages.length > 0) {
      
      for (const public_id of removedImages) {
        
        if (public_id) {
          
          try {

            await cloudinary.uploader.destroy(public_id);

          } catch (err) {

            console.error(`Failed to delete Cloudinary image ${public_id}:`, err.message);

          }


        }

      }

    }

   
    product.productName = productName;

    product.description = description;

    product.category = category;

    product.quantity = quantity;

    product.regularPrice = regularPrice;

    product.status = status || "Available";

    product.productImage = finalImages; 

    await product.save();

    return res.status(200).json({success:true,message:"Product updated successfully"});

  } catch (error) {

    console.error("Error in uploadEditProduct:", error.message);

    await deleteUploadedImages(req.files);
    
    return res.status(500).json({

      success:false,

      error: `An error occurred: ${error.message}`,

      formData: req.body || {},

      cat: await Category.find({ isListed: true, isDeleted: false }),

    });

  }

};




const deleteProduct = async (req,res)=>{
  const {id} = req.params
     try{
         if(!id) return res.status(404).json({success:false,error:"Product id required"})

          const product = await Product.findByIdAndUpdate(id,{isDeleted:true},{new:true});
          
          if(!product) return res.status(404).json({success:false,error:"Product not found"})

           res.status(200).json({success:true,message:"Product delete successfully"})

     }catch(error){
      console.error("Error deleting product:", error.message);

      res.status(500).json({ success: false, message: "Server error" });

     }

}

const blockProduct = async(req,res)=>{

  const {id} = req.params;

  try{

        if(!id) return res.status(400).json({success:false,error:"Product id required"});

        const product = await  Product.findById(id);

        if(!product) return res.status(404).json('Product not found')

        product.isBlocked = !product.isBlocked

        await product.save();

        res.status(200).json({success:true,message:`Product ${product.isBlocked ? 'Blocked':'unblocked'} successfully `,product})

  }catch(error){
       console.log("Error while block product",error.message);

       return res.status(500).json({success:false,error:"Internal server error"})
  }
}


module.exports = {
  viewProduct,
  loadAddProductPage,
  addProduct,
  getEditProduct,
  uploadEditProduct,
  deleteProduct,
  blockProduct,
};
