const validateLogin = require('../../helpers/adminLoginValidaion')
const User = require('../../models/userSchema')



const pageError = (req, res) => {
  try {
    res.status(404).render('admin-404-page');
  } catch (error) {
    console.error('Error rendering 404 page:', error);
    res.status(500).send('Something went wrong');
  }
};


const adminLogin = async (req, res) => {
    try {
        if(req.session.admin) return res.redirect('/admin/dashboard')
        return res.render('admin-login', {
            message: "",
            formData: {},
            errors: {}
        });
    
    } catch (error) {
        console.error('Error in adminLogin:', error);
        return res.status(500).render('admin-login', {
            message: "An error occurred. Please try again",
            formData: {},
            errors: {}
        });
    }
};

const adminVerify = async (req, res) => {
    try {
        const { email, password } = req.body;
        const errors = await validateLogin(req.body);
        console.log("Email:", email, "Password:", password);

        if (Object.keys(errors).length > 0) {
            console.log("Validation errors:", errors);
            return res.render("admin/admin-login", { 
                errors,
                formData: req.body,
                message: "Please correct the errors below",
            });
        }

        const adminUser = await User.findOne({email})
        req.session.admin = adminUser._id;
        return res.redirect('/admin/dashboard'); 

    } catch (error) {
        console.error('Server error:', error);
        return res.render('admin/admin-login', { 
            errors: {},
            formData: req.body,
            message: 'An unexpected error occurred. Please try again.',
        });
    }
};

const logout = async (req, res) => {
    try {
        req.session.destroy(err => {
            if (err) {
                console.log("Error destroying session:", err); 
                return res.redirect('/errorPage');
            }
        
            res.clearCookie('connect.sid'); 
            res.redirect('/admin/login');
        });
    } catch (error) {
        console.log("Unexpected error during logout:", error);
        res.redirect('/errorPage');
    }
};

const adminDashboard = async (req, res) => {
    try { 
        if(!req.session.admin) return res.redirect('/admin/login');
        res.set(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, private"
        );
        return res.render("admin-dashboard");
    } catch (error) {
        console.log('Error loading admin dashboard:', error);
        res.redirect('/pageNotFound');
    }
};











module.exports ={
    adminLogin,
    adminVerify,
    adminDashboard,
    pageError,
    logout,  
}

