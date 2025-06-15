const express = require("express");
const router = express.Router();
const userController = require("../../controllers/user/userController")

router.get('/',userController.loadHomePage);
router.get('/PageNotFound',userController.PageNotFound);
router.get("/signup",userController.loadSignUp);
router.post("/signup",userController.signUp);


module.exports=router
