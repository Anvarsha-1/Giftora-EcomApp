const User = require("../models/userSchema");

const userAuth = async (req, res, next) => {
  try {
    

    const userId = req.session.user || req.session?.passport?.user;
    if (!userId) {
      if (req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ success: false, message: 'Unauthorized: Please login' });
      }
      return res.redirect("/login");
    }

    const userData = await User.findById(userId);
    if (!userData || userData.isBlocked) {
        delete req.session.user
        res.clearCookie("connect.sid");
        if (req.headers.accept?.includes('application/json')) {
          return res.status(403).json({ success: false, message: 'Access denied or user blocked' });
        }
        req.flash('error',"Access denied or user blocked ")
        return res.redirect("/login");
     
    }

    req.user = userData;
    next();
  } catch (error) {
    console.log("Error in user auth middleware:", error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


const adminAuth = async (req, res, next) => { 
  try {
   
    const isApiRequest = req.headers.accept?.includes('application/json');

    if (!req.session.admin) {
      if (isApiRequest) {
        return res.status(401).json({ success: false, message: 'Unauthorized: Admin login required' });
      }
      return res.redirect("/admin/login");
    }

    const adminData = await User.findById(req.session.admin);
    if (!adminData || adminData.isBlocked || !adminData.isAdmin) {
      req.session.destroy(err => {
        if (err) console.log("Error destroying session:", err);
        res.clearCookie("connect.sid");

        if (isApiRequest) {
          return res.status(403).json({ success: false, message: 'Access denied: Invalid or blocked admin' });
        }
        return res.redirect("/admin/login");
      });
      return;
    }

    req.admin = adminData;
    next();
  } catch (error) {
    console.log("Error in admin auth middleware:", error);
    if (req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
    res.status(500).send("Internal Server Error");
  }
};
 

module.exports = {
  userAuth,
  adminAuth,
};
