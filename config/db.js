const mongoose = require('mongoose');
const env = require('dotenv').config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`Mongodb connected to ${conn.connection.host}`);
  } catch (error) {
    console.log('DB Connection error', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
