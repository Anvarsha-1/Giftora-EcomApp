const express = require('express');
const env = require("dotenv").config();
const DB = require("./config/db")
const PORT = process.env.PORT
const app = express();
DB();



app.listen(PORT,()=>{
    console.log("Server running at port 3000");
})