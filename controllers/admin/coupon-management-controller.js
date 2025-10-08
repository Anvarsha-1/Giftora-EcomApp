
const Coupon = require('../../models/couponSchema');
const Category = require('../../models/categorySchema');
const Product  = require('../../models/productSchema');

const getCouponPage = async(req,res)=>{
    try{
       const searchQuery = req.query.clear=== '1' ? '' : (req.query.search || '')
       
        const statusFilter = req.query.status || "all";
        const typeFilter = req.query.type || "all";
        const sortOption = req.query.sort || "newest";
        const page = parseInt(req.query.page) || 1; 
        const limit = 4;
        console.log(statusFilter, typeFilter, sortOption,searchQuery)
        
        let filter = {
            $or: [{
                code: { $regex: searchQuery, $options: 'i' }
            },
            { description: { $regex: searchQuery, $options: 'i' } },
            ],
            isDeleted: false
        }
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0)

      
        switch(statusFilter.toLowerCase()){
            case 'active':
                filter.isActive = true
                break;
            case 'inactive':
                filter.isActive = false;
                break;
            case 'expired':
                filter.expiry = { $lt: todayStart }
                delete filter.isActive;
                break;
        }

        if (typeFilter !== "all") {
            filter.discountType = typeFilter;
        }
        let sort = {};
        switch (sortOption) {
            case "oldest":
                sort = { createdAt: 1 };
                break;
            case "expiry-soon":
                sort = { expiry: 1 };
                break;
            case "most-used":
                sort = { usedCount: -1 };
                break;
            case "newest":
            default:
                sort = { createdAt: -1 };
                break;
        }

        const coupons = await Coupon.find(filter).sort(sort).skip((page-1)*limit).limit(limit)
        console.log(coupons)
        
        
        const couponIsActive = await Coupon.countDocuments({isActive:true,isDeleted:false})
        const TotalCouponCount = await Coupon.countDocuments({isDeleted:false})
        const totalPages = Math.ceil(TotalCouponCount / limit);
        const couponUserCount = await Coupon.aggregate([{ $group: { _id: null, usedCount: { $sum:"$usedCount"}}}])
        const totalUsedCount = couponUserCount.length > 0 ? couponUserCount[0].usedCount : 0;
        
        return res.render('coupon-management', {
            coupons, couponIsActive, totalUsedCount, searchQuery, currentPage: page,
            totalPages, sortOption, TotalCouponCount,
})
    }catch(error){
       console.log("Error while showing admin coupon page",error.message)
        res.status(500).send("Server error while loading coupons");
    }
}

const getAddCoupon =  async(req,res)=>{
    try{
        const category = await Category.find({isListed:true,isDeleted:false})
        const product =  await Product.find({isBlocked:false,isDeleted:false})
 
        return res.render('add-coupon',{category,product})
    }catch(error){

    }
}

const addCoupons = async (req, res) => {
    try {
        const {
            couponCode,
            description,
            discountType,
            discountAmount,
            minimumOrderAmount,
            startDate,
            expirationDate,
            maxUsesPerUser,
            totalUsageLimit,
            maxDiscount: bodyMaxDiscount,
            activeStatus,
            applicableCategories,
            applicableProducts,
            selectedCategories,
            selectedProducts
        } = req.body;
        console.log(req.body)

        // Basic sanitization and normalization
        const code = (couponCode || '').trim().toUpperCase();
        const desc = (description || '').trim();
        const type = (discountType || '').toLowerCase();
        const discount = Number(discountAmount);
        const minPurchase = Number(minimumOrderAmount);
        const start = startDate ? new Date(startDate) : null;
        const expiry = expirationDate ? new Date(expirationDate) : null;
        const userUsageLimit = Number(maxUsesPerUser);
        let usageLimit = (totalUsageLimit === null || totalUsageLimit === undefined || totalUsageLimit === ''
            ? 0
            : Number(totalUsageLimit)); // 0 => unlimited
        const isActive = Boolean(activeStatus);

        // Validations
        if (!code) return res.status(400).json({ success: false, message: 'Coupon code is required' });
        if (!desc) return res.status(400).json({ success: false, message: 'Description is required' });
        if (!['percentage', 'flat'].includes(type)) return res.status(400).json({ success: false, message: 'discountType must be either "percentage" or "flat"' });
        if (!Number.isFinite(discount) || discount <= 0) return res.status(400).json({ success: false, message: 'discountAmount must be a number greater than 0' });
        if (type === 'percentage' && discount > 100) return res.status(400).json({ success: false, message: 'For percentage type, discountAmount must be between 0 and 100' });
        if (!Number.isFinite(minPurchase) || minPurchase < 0) return res.status(400).json({ success: false, message: 'minimumOrderAmount must be a number greater than or equal to 0' });
        if (!start || isNaN(start.getTime())) return res.status(400).json({ success: false, message: 'startDate is invalid or missing' });
        if (!expiry || isNaN(expiry.getTime())) return res.status(400).json({ success: false, message: 'expirationDate is invalid or missing' });
        if (start > expiry) return res.status(400).json({ success: false, message: 'expirationDate must be on or after startDate' });
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (expiry < today) return res.status(400).json({ success: false, message: 'expirationDate must be today or a future date' });
        if (!Number.isInteger(userUsageLimit) || userUsageLimit < 1) return res.status(400).json({ success: false, message: 'maxUsesPerUser must be an integer of at least 1' });
        if (!(usageLimit === 0 || (Number.isInteger(usageLimit) && usageLimit >= 1))) return res.status(400).json({ success: false, message: 'totalUsageLimit must be an integer of at least 1, or empty for unlimited' });

        // Handle maxDiscount
        let maxDiscount = Number(bodyMaxDiscount);
        if (type === 'flat') {
            // For flat discounts, cap equals the flat amount
            maxDiscount = discount;
        } else {
            if (!Number.isFinite(maxDiscount) || maxDiscount <= 0) {
                return res.status(400).json({ success: false, message: 'maxDiscount is required and must be > 0 for percentage discounts' });
            }
        }

        // Ensure unique code (case-insensitive handled by uppercase normalization)
        const existing = await Coupon.findOne({ code });
        if (existing) {
            return res.status(409).json({ success: false, message: 'A coupon with this code already exists' });
        }

        // Resolve applicability
        let categoryIds = [];
        let productIds = [];

        if (applicableCategories === 'all') {
            // keep empty to mean all categories (interpretation on apply side)
            categoryIds = [];
        } else if (Array.isArray(selectedCategories) && selectedCategories.length) {
            // validate category ids exist and are listed
            const validCats = await Category.find({ _id: { $in: selectedCategories }, isListed: true, isDeleted: false }).select('_id');
            categoryIds = validCats.map(c => c._id);
            if (categoryIds.length === 0) {
                return res.status(400).json({ success: false, message: 'No valid categories selected' });
            }
        }

        if (applicableProducts === 'all') {
            productIds = [];
        } else if (Array.isArray(selectedProducts) && selectedProducts.length) {
            const validPros = await Product.find({ _id: { $in: selectedProducts }, isBlocked: false, isDeleted: false }).select('_id');
            productIds = validPros.map(p => p._id);
            if (productIds.length === 0) {
                return res.status(400).json({ success: false, message: 'No valid products selected' });
            }
        }

        const coupon = new Coupon({
            code,
            description: desc,
            discountType: type,
            discount,
            minPurchase,
            maxDiscount,
            startDate: start,
            expiry,
            usageLimit,
            userUsageLimit,
            isActive,
            applicableCategories: categoryIds,
            applicableProducts: productIds
        });

        await coupon.save();

        return res.status(201).json({ success: true, message: 'Coupon created successfully', data: { id: coupon._id } });
    } catch (error) {
        if (error && error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Coupon code must be unique' });
        }
        console.error('Error while creating coupon:', error.message);
        return res.status(500).json({ success: false, message: 'Internal server error while creating coupon' });
    }
}

const getEditCoupons = async(req,res)=>{
    try{
        const id = req.params.id
        const coupon = await Coupon.findById(id)
        const categories = await Category.find({isDeleted:false,isListed:true})
        const products = await Product.find({isDeleted:false,isBlocked:false})
        return res.render('edit-coupon', { coupon, categories, products })
    }catch(error){

    }
}

const editCoupons = async(req,res)=>{
      try{
        const { id } = req.params;
        if (!id) return res.status(400).json({ success: false, message: 'Coupon id is required' });

        const {
            code,
            description,
            discountType,
            discount,
            minPurchase,
            maxDiscount: bodyMaxDiscount,
            startDate,
            expiry,
            userUsageLimit,
            usageLimit: bodyUsageLimit,
            isActive,
            applicableCategories,
            applicableProducts
        } = req.body;

        // Normalize & sanitize
        const newCode = (code || '').trim().toUpperCase();
        const desc = (description || '').trim();
        const type = (discountType || '').toLowerCase();
        const discountNum = Number(discount);
        const minPurchaseNum = Number(minPurchase);
        const start = startDate ? new Date(startDate) : null;
        const exp = expiry ? new Date(expiry) : null;
        const userLimitNum = Number(userUsageLimit);
        let usageLimit = (bodyUsageLimit === null || bodyUsageLimit === undefined || bodyUsageLimit === '' ? 0 : Number(bodyUsageLimit));
        const active = Boolean(isActive);

        // Validations
        if (!newCode) return res.status(400).json({ success: false, message: 'Coupon code is required' });
        if (!desc) return res.status(400).json({ success: false, message: 'Description is required' });
        if (!['percentage', 'flat'].includes(type)) return res.status(400).json({ success: false, message: 'discountType must be either "percentage" or "flat"' });
        if (!Number.isFinite(discountNum) || discountNum <= 0) return res.status(400).json({ success: false, message: 'discount must be a number greater than 0' });
        if (type === 'percentage' && discountNum > 100) return res.status(400).json({ success: false, message: 'For percentage type, discount must be between 0 and 100' });
        if (!Number.isFinite(minPurchaseNum) || minPurchaseNum < 0) return res.status(400).json({ success: false, message: 'minPurchase must be a number >= 0' });
        if (!start || isNaN(start.getTime())) return res.status(400).json({ success: false, message: 'startDate is invalid or missing' });
        if (!exp || isNaN(exp.getTime())) return res.status(400).json({ success: false, message: 'expiry is invalid or missing' });
        if (start > exp) return res.status(400).json({ success: false, message: 'expiry must be on or after startDate' });
        const today = new Date(); today.setHours(0,0,0,0);
        if (exp < today) return res.status(400).json({ success: false, message: 'expiry must be today or a future date' });
        if (!Number.isInteger(userLimitNum) || userLimitNum < 1) return res.status(400).json({ success: false, message: 'userUsageLimit must be an integer of at least 1' });
        if (!(usageLimit === 0 || (Number.isInteger(usageLimit) && usageLimit >= 1))) return res.status(400).json({ success: false, message: 'usageLimit must be an integer of at least 1, or empty for unlimited' });

        // Handle maxDiscount
        let maxDiscount = Number(bodyMaxDiscount);
        if (type === 'flat') {
            maxDiscount = discountNum;
        } else {
            if (!Number.isFinite(maxDiscount) || maxDiscount <= 0) {
                return res.status(400).json({ success: false, message: 'maxDiscount is required and must be > 0 for percentage discounts' });
            }
        }

        // Ensure unique code (exclude current coupon)
        const existing = await Coupon.findOne({ code: newCode, _id: { $ne: id } });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Another coupon with this code already exists' });
        }

        // Applicability handling (empty arrays mean apply to all)
        let categoryIds = [];
        let productIds = [];

        if (Array.isArray(applicableCategories) && applicableCategories.length) {
            const validCats = await Category.find({ _id: { $in: applicableCategories }, isListed: true, isDeleted: false }).select('_id');
            categoryIds = validCats.map(c => c._id);
            if (categoryIds.length === 0) return res.status(400).json({ success: false, message: 'No valid categories selected' });
        }
        if (Array.isArray(applicableProducts) && applicableProducts.length) {
            const validPros = await Product.find({ _id: { $in: applicableProducts }, isBlocked: false, isDeleted: false }).select('_id');
            productIds = validPros.map(p => p._id);
            if (productIds.length === 0) return res.status(400).json({ success: false, message: 'No valid products selected' });
        }

        const updated = await Coupon.findByIdAndUpdate(
            id,
            {
                code: newCode,
                description: desc,
                discountType: type,
                discount: discountNum,
                minPurchase: minPurchaseNum,
                maxDiscount,
                startDate: start,
                expiry: exp,
                usageLimit,
                userUsageLimit: userLimitNum,
                isActive: active,
                applicableCategories: categoryIds,
                applicableProducts: productIds
            },
            { new: true }
        );

        if (!updated) return res.status(404).json({ success: false, message: 'Coupon not found' });

        return res.status(200).json({ success: true, message: 'Coupon updated successfully', data: { id: updated._id } });
      }catch(error){
        if (error && error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Coupon code must be unique' });
        }
        console.error('Error while updating coupon:', error);
        return res.status(500).json({ success: false, message: 'Internal server error while updating coupon' });
      }
}


const deleteCoupon = async(req,res)=>{
    try{
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, message: 'Coupon id is required' });
        }

        const updated = await Coupon.findByIdAndUpdate(
            id,
            { isDeleted: true, deletedAt: new Date() },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        return res.json({ success: true, message: 'Coupon deleted successfully' });
    }catch(error){
        console.error('Error while deleting coupon:', error);
        return res.status(500).json({ success: false, message: 'Internal server error while deleting coupon' });
    }
}

module.exports = {
    getCouponPage,
    getAddCoupon,
    addCoupons,
    getEditCoupons,
    editCoupons,
    deleteCoupon
}