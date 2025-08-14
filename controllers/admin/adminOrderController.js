const Order = require('../../models/orderSchema')
const Address = require('../../models/addressSchema')
const User = require('../../models/userSchema')


const loadOrderPage = async (req, res) => {
    try {

        const {
            page = 1,
            status,
            sort = 'latest',
            search = ''
        } = req.query;

        let defaultPageSize = 10
        let filter = {};

        if (status && status !== 'All') filter.status = status;

        if (search) {
            filter.$or = [
                { orderId: { $regex: search, $options: 'i' } },
            ];
        }

        let query = Order.find(filter).populate({
            path: 'userId',
            select: 'firstName lastName email',
            match: search ? {
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            } : undefined
        });

        const sortBy = sort === 'oldest' ? 1 : -1;
        query = query.sort({ createdOn: sortBy });


        const skip = (parseInt(page) - 1) * defaultPageSize;
        query = query.skip(skip).limit(defaultPageSize);

        let orders = await query.lean();

        if (search) {
            orders = orders.filter(order => order.userId !== null);
        }


        let countFilter = { ...filter };
        if (search) countFilter = {};
        const totalOrders = await Order.countDocuments(countFilter);
        const totalPages = Math.ceil(totalOrders / defaultPageSize);


        const params = { ...req.query };
        delete params.page;
        const paramsStr = Object.keys(params).length > 0 ? '&' + Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';

        res.render('admin/orderManagement', {
            orders,
            currentPage: parseInt(page),
            totalPages,
            query: req.query,
            searchParamsExceptPage: paramsStr
        });
    } catch (error) {
        console.log("Error while loading order page", error.message)
        res.status(500).send('Failed to load orders');
    }
}





const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const { status } = req.body;
        console.log(status)
        if (!orderId || !status) return res.status(400).json({ success: false, message: 'Invalid payload' });
        const order = await Order.findOne({orderId}).populate('orderedItems.productId')
        console.log(order)
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        order.status=status
        order.orderedItems.forEach((item)=>{
            item.status = status
        })
        if (status === 'Delivered') {
            order.paymentStatus = "Completed"
            
        }
        await order.save()
        return res.json({ success: true, status: order.status });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Update failed' });
    }
}

const getPendingReturnsCount = async (req, res) => {
    try {

        const count = await Return.countDocuments({ status: 'Pending' });
        return res.json({ count:10 });
    } catch {
        return res.json({ count: 0 });
    }
};



const getReturnedOrder = async (req, res) => {
    try {

        const orders = await Order.find({ "orderedItems.status": "Return Request" }).populate('orderedItems.productId').populate('userId')
        
        const user = await User.findById(req.session.user)

        if (!orders || orders.length < 1) {
            return res.render('verifyOrderReturn', { orders: [], user })
        }
        
       
        return res.render("verifyOrderReturn", { orders, user })
    } catch (error) {
        console.log("error while return order verify page ", error.message)
    }
}


const verifyOrderReturn = async (req, res) => {
    try {
        const { orderId, itemId } = req.params

        console.log(orderId, itemId)
        const order = await Order.findOne({ orderId }).populate('orderedItems.productId')
        if (!order) {
            return res.json({ success: false, message: "Invalid request Order not found" })
        }
        
        const product = order.orderedItems.find((item)=>itemId.toString()===item._id.toString())

        if(!product){
           return res.json({success:false,message:"Product not found"})
        }
        
        product.status = "Returned";
        product.adminApprovalStatus = 'Approved';
        
        const allOrderReturnCheck = order.orderedItems.every((item)=>item.status==='Returned')
        
        if(allOrderReturnCheck){
            order.status = 'Returned'
        }
        
        await order.save()
        return res.json({ success: true })
    } catch (error) {
        console.log("error while updating verify orderReturn ", error.message)
        return res.json({ success: false, message: "Something went wrong please try again" })
    }
}

module.exports = {
    loadOrderPage,
    updateOrderStatus,
    getPendingReturnsCount,
    getReturnedOrder,
    verifyOrderReturn
}