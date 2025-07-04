const User = require("../models/userSchema");

const userAuth = async (req, res, next) => {
  try {
<<<<<<< HEAD
    const userId = req.session.user || req.session?.passport?.user
    if (!userId) {
      return res.redirect("/login");
    }

    const userData = await User.findById(userId);
=======
    if (!req.session.user) {
      return res.redirect("/login");
    }

    const userData = await User.findById(req.session.user);
>>>>>>> e3d1b9fd589f953e478a2819f45acf715ff2701d

    if (!userData) {
      req.session.destroy((err) => {
        if (err) {
          console.log("Error destroying session:", err);
        }
        res.clearCookie("connect.sid");
        res.redirect("/login");
      });
      return;
    }

    if (userData.isBlocked) {
      req.session.destroy((err) => {
        if (err) {
          console.log("Error destroying session:", err);
        }
        res.clearCookie("connect.sid");
        res.redirect("/login");
      });
      return;
    }

<<<<<<< HEAD
    // if (userData.isAdmin) {
    //   return res.redirect("/admin/dashboard");
    // }
=======
    // if (userData.isAdmin) {
    //   return res.redirect("/admin/dashboard");
    // }
>>>>>>> e3d1b9fd589f953e478a2819f45acf715ff2701d

    req.user = userData;
    next();
  } catch (error) {
    console.log("Error in user auth middleware:", error);
    res.status(500).send("Internal Server Error");
  }
};

const adminAuth = async (req, res, next) => {
  try {
    if (!req.session.admin) {
      return res.redirect("/admin/login");
    }
    const adminData = await User.findById(req.session.admin);
    if (!adminData) {
      req.session.destroy((err) => {
        if (err) {
          console.log("Error destroying session:", err);
        }
        res.clearCookie("connect.sid");
        res.redirect("/admin/login");
      });
      return;
    }
    if (adminData.isBlocked) {
      req.session.destroy((err) => {
        if (err) {
          console.log("Error destroying session:", err);
        }
        res.clearCookie("connect.sid");
        res.redirect("/admin/login");
      });
      return;
    }

    if (!adminData.isAdmin) {
      req.session.destroy((err) => {
        if (err) {
          console.log("Error destroying session:", err);
        }
        res.clearCookie("connect.sid");
        res.redirect("/admin/login");
      });
      return;
    }
    req.admin = adminData;
    next();
  } catch (error) {
    console.log("Error in admin auth middleware:", error);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = {
  userAuth,
  adminAuth,
};
