const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const PDFDocument = require('pdfkit');
const { Types } = require('mongoose');

// Helper: Audit log (optional, can be expanded)
const logAudit = async (userId, orderId, action, reason) => {
    // Implement audit logging as needed
    // e.g., save to a collection: { userId, orderId, action, reason, date: new Date() }
};

// 1. Order Listing with Search & Pagination
const loadOrderList = async (req, res) => {
    try {
        const userId = req.session.user;
        const { page = 1, q = '', status = '' } = req.query;
        const PAGE_SIZE = 6;
        let query = { userId: Types.ObjectId(userId) };

        if (q) {
            query.$or = [
                { orderId: { $regex: q, $options: 'i' } },
                { 'orderedItems.productName': { $regex: q, $options: 'i' } }
            ];
        }
        if (status) {
            query.status = status;
        }

        const total = await Order.countDocuments(query);
        const orders = await Order.find(query)
            .sort({ createdOn: -1 })
            .skip((page - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE)
            .populate('orderedItems.productId');

        res.render('user/orderList', {
            orders,
            currentPage: Number(page),
            totalPages: Math.ceil(total / PAGE_SIZE),
            q,
            status
        });
    } catch (error) {
        console.error('Error loading order list:', error);
        res.render('error', { title: 'Error', message: 'Could not load orders.' });
    }
};




// 3. Cancel Order (entire order)
const cancelOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { id } = req.params;
        const { reason } = req.body;
        const order = await Order.findOne({ _id: id, userId });
        if (!order || order.status === 'cancelled' || order.status === 'returned') {
            return res.status(400).json({ success: false, message: 'Order cannot be cancelled.' });
        }
        // Update stock for all items
        for (const item of order.orderedItems) {
            await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
        }
        order.status = 'cancelled';
        order.cancelReason = reason;
        await order.save();
        await logAudit(userId, id, 'cancel_order', reason);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error cancelling order.' });
    }
};

// 4. Cancel Individual Product
const cancelOrderItem = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId, itemId } = req.params;
        const { reason } = req.body;
        const order = await Order.findOne({ _id: orderId, userId });
        if (!order || order.status === 'cancelled' || order.status === 'returned') {
            return res.status(400).json({ success: false, message: 'Order cannot be modified.' });
        }
        const item = order.orderedItems.id(itemId);
        if (!item || item.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'Item already cancelled.' });
        }
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
        item.status = 'cancelled';
        item.cancelReason = reason;
        // If all items are cancelled, cancel the order
        if (order.orderedItems.every(i => i.status === 'cancelled')) {
            order.status = 'cancelled';
        }
        await order.save();
        await logAudit(userId, orderId, 'cancel_item', reason);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error cancelling item.' });
    }
};

// 5. Return Order
const returnOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { id } = req.params;
        const { reason } = req.body;
        const order = await Order.findOne({ _id: id, userId });
        if (!order || order.status !== 'delivered') {
            return res.status(400).json({ success: false, message: 'Order cannot be returned.' });
        }
        if (!reason || reason.trim().length < 3) {
            return res.status(400).json({ success: false, message: 'Return reason required.' });
        }
        order.status = 'returned';
        order.returnReason = reason;
        await order.save();
        await logAudit(userId, id, 'return_order', reason);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error returning order.' });
    }
};

// 6. Download Invoice (PDF)
const downloadInvoice = async (req, res) => {
    try {
        const userId = req.session.user;
        const { id } = req.params;
        const order = await Order.findOne({ _id: id, userId }).populate('orderedItems.productId');
        if (!order) return res.status(404).send('Order not found');
        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
        doc.fontSize(20).text('Order Invoice', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Order ID: ${order.orderId}`);
        doc.text(`Order Date: ${order.createdOn}`);
        doc.text(`Status: ${order.status}`);
        doc.text(`Payment: ${order.paymentMethod}`);
        doc.text(`Shipping Address: ${order.shippingAddress}`);
        doc.moveDown();
        doc.text('Items:');
        order.orderedItems.forEach(item => {
            doc.text(`- ${item.productId.productName} x${item.quantity} @ ₹${item.price} = ₹${item.price * item.quantity}`);
        });
        doc.moveDown();
        doc.text(`Total: ₹${order.totalPrice}`);
        doc.end();
        doc.pipe(res);
    } catch (error) {
        res.status(500).send('Error generating invoice');
    }
};

module.exports = {
    loadOrderList,
    loadOrderDetail,
    cancelOrder,
    cancelOrderItem,
    returnOrder,
    downloadInvoice
};
