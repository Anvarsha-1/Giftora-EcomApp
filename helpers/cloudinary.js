const cloudinary = require('cloudinary').v2
require('dotenv').config()


cloudinary.config({
     cloud_name: process.env.CLOUD_NAME,
     api_secret: process.env.CLOUD_SECRET_KEY,
     api_key: process.env.CLOUD_API_KEY
})

module.exports= cloudinary     