const express = require("express");
const env = require("dotenv").config();
const DB = require("./config/db");
const path = require("path");
const PORT = process.env.PORT||3000;
const userRouter = require("./routers/user/userRouter");
const app = express();
DB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'views'));

//app.use(express.static(path.join(__dirname, "public")));

app.use('/',userRouter);

app.listen(PORT, () => {
  console.log("Server running at port 3000");
});
