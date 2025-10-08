const validateLogin = require('../../helpers/adminLoginValidaion')
const User = require('../../models/userSchema')
const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const Order = require('../../models/orderSchema')



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
        if (req.session.admin) return res.redirect('/admin/dashboard')
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

        const adminUser = await User.findOne({ email })
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

        delete req.session.admin;
        res.clearCookie('connect.sid');
        res.redirect('/admin/login');
    } catch (error) {
        console.log("Unexpected error during logout:", error);
        res.status(500).redirect('/errorPage');
    }
};

async function getSalesReportData(filter) {
    const now = new Date();
    let startDate, endDate, groupBy, labels, dataMap;

    if (filter === 'yearly') {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        groupBy = { $month: '$createdOn' };
        labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        dataMap = new Array(12).fill(0);
    } else if (filter === 'daily') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        groupBy = { $hour: '$createdOn' };
        labels = ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'];
        dataMap = new Array(24).fill(0);
    } else { // monthly
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        groupBy = { $dayOfMonth: '$createdOn' };
        const daysInMonth = endDate.getDate();
        labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
        dataMap = new Array(daysInMonth).fill(0);
    }

    const sales = await Order.aggregate([
        { $match: { status: 'Delivered', createdOn: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: groupBy, totalSales: { $sum: '$finalAmount' } } },
        { $sort: { _id: 1 } }
    ]);

    sales.forEach(item => {
        let index;
        if (filter === 'yearly') {
            index = item._id - 1; // month is 1-12
        } else if (filter === 'daily') {
            index = item._id; // hour is 0-23
        } else { // monthly
            index = item._id - 1; // day is 1-31
        }
        if (index >= 0 && index < dataMap.length) {
            dataMap[index] = item.totalSales;
        }
    });

    return { labels, values: dataMap };
}

const renderAdminDashboard = async (req, res) => {
    try {
        const filter = req.query.filter || 'monthly'
        
        const [salesData, topProduct, topCategories, totalUsers, totalOrders, totalSalesData, pendingOrdersCount, topCustomers] = await  Promise.all([
            getSalesReportData(filter),

            //Top 10 product by units sold 
            Order.aggregate([
                { $unwind: '$orderedItems' },
                {
                    $match: {
                        'orderedItems.status': { $nin: ['Cancelled', 'Returned'] },
                    }
                },
                {
                    $group: {
                        _id: '$orderedItems.productId',
                        soldQty: { $sum: "$orderedItems.quantity" },
                        revenue: { $sum: { $multiply: ['$orderedItems.quantity', '$orderedItems.price'] } }
                    }
                },
                { $sort: { soldQty: -1 } },
                { $limit: 10 },
                {
                    $lookup: {
                        from: 'products', 
                        localField: '_id',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
                { $project: { productName: '$product.productName', soldQty: 1, revenue: 1 } }
            ]),

            //Top 10 category by unit sold
            Order.aggregate([
                { $unwind: "$orderedItems" }, // Correct field name
                {
                    $match: {
                        'orderedItems.status': { $nin: ['Cancelled', 'Returned'] },
                    }
                },
                { $lookup: { from: "products", localField: "orderedItems.productId", foreignField: "_id", as: "product" } },
                { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
                {
                    $group: {
                        _id: "$product.category",
                        soldQty: { $sum: "$orderedItems.quantity" },
                        revenue: { $sum: { $multiply: ["$orderedItems.quantity", "$orderedItems.price"] } }
                    }
                },
                { $sort: { soldQty: -1 } },
                { $limit: 10 },
                { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
                { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
                { $project: { categoryName: "$category.name", soldQty: 1, revenue: 1 } }
            ])
            ,
            // Get total users (assuming admins are not regular users)
            User.countDocuments({ isAdmin: { $ne: true } }),
            // Get total orders
            Order.countDocuments(),
            // Get total sales from delivered orders
            Order.aggregate([
                { $match: { status: { $nin: ['Cancelled', 'Returned'] } } },
                { $group: { _id: null, totalSales: { $sum: '$finalAmount' } } }
            ]),
            // Get pending orders count
            Order.countDocuments({ status: 'Pending' }),
            // Get Top 10 Customers by total amount spent on delivered orders
            Order.aggregate([
                { $match: { status: { $nin: ['Cancelled', 'Returned'] } } },
                {
                    $group: {
                        _id: '$userId',
                        totalSpent: { $sum: '$finalAmount' }
                    }
                },
                { $sort: { totalSpent: -1 } },
                { $limit: 10 },
                {
                    $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'customer' }
                },
                { $unwind: '$customer' },
                { $project: { customerName: { $concat: ['$customer.firstName', ' ', '$customer.lastName'] }, totalSpent: 1 } }
            ])

        ])
        return res.render("admin-dashboard", {
            salesReport: salesData,
            topProducts: topProduct,
            topCategories,
            totalUsers,
            totalOrders,
            pendingOrders: pendingOrdersCount,
            topCustomers,
            totalSales: totalSalesData.length > 0 ? totalSalesData[0].totalSales : 0,
            filter
        });
    } catch (error) {
        console.log('Error loading admin dashboard:', error);
        res.redirect('/pageNotFound');
    }
};



const getDashboardData = async (req, res) => {
    const filter = req.query.filter || 'monthly';
    try {
        const salesReport = await getSalesReportData(filter);
        res.json({ salesReport });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};










module.exports = {
    adminLogin,
    adminVerify,
    renderAdminDashboard,
    pageError,
    logout,
    getDashboardData
}
