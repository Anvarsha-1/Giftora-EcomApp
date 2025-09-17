const multer = require("multer");
const {CloudinaryStorage}= require('multer-storage-cloudinary');
const cloudinary = require('../helpers/cloudinary')

const storage = new CloudinaryStorage({
  cloudinary:cloudinary,
  params:{
    folder: 'giftora/products',
    allowed_formats:['jpg','png','jpeg'],
    quality: "auto:best",
    fetch_format: "auto",

    transformation:[
      {
        width:300,height:300,
        crop: 'fill',
        gravity: 'auto',

      }
    ]
  }
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, 
});

module.exports = upload;
