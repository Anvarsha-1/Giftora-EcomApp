const express = require("express");
const router = express.Router();
const adminController = require("../../controllers/admin/adminController");
const customerController = require("../../controllers/admin/customerController.js");
const categoryController = require("../../controllers/admin/categoryController.js");
const productController = require('../../controllers/admin/productController')
const upload =require('../../helpers/multer')
const { adminAuth } = require("../../middlewares/auth");


//ADMIN AUTHENTICATION
router.get("/errorPage", adminController.pageError);
router.get("/login", adminController.adminLogin);
router.post("/login", adminController.adminVerify);
router.get("/logout", adminController.logout);


//DASHBOARD MANAGEMENT
router.get("/dashboard", adminAuth, adminController.adminDashboard);

//USER MANAGEMENT
router.get("/users", adminAuth, customerController.loadUserList);
router.get("/blockUser", adminAuth, customerController.blockUser);


//CATEGORY MANAGEMENT
router.get("/category", adminAuth, categoryController.categoryManagement);
router.post("/category", adminAuth, categoryController.addCategory);
router.post("/category/toggle",adminAuth, categoryController.categoryToggle);
router.patch("/category/:id",adminAuth,categoryController.editCategory);
router.delete("/category/:id", adminAuth, categoryController.deleteCategory);


//PRODUCT MANAGEMENT
router.get("/products", adminAuth, productController.viewProduct);
router.get("/addProducts", adminAuth, productController.loadAddProductPage);
router.post("/addProducts",adminAuth,upload.array("productImage", 3),productController.addProduct);
router.get('/editProduct/:id',adminAuth,productController.getEditProduct);
router.post('/editProduct/:id',adminAuth,upload.array("productImage", 3),productController.uploadEditProduct)
router.delete('/deleteProduct/:id',adminAuth,productController.deleteProduct)
router.patch('/blockProduct/:id',adminAuth,productController.blockProduct)

module.exports = router;
