const cloudinary = require('cloudinary').v2;

const deleteUploadedImages = async (files) => {
  for (const file of files || []) {
    try {
      const publicId = file.filename.split('.')[0]; // Adjust if needed
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.error('Cloudinary deletion failed:', err.message);
    }
  }
};

module.exports = deleteUploadedImages;
