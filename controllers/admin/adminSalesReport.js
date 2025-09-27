const Order = require('../../models/orderSchema')
const {generateSalesReportPDF} = require('../../helpers/sales-report-pdf')
const ExcelJS = require('exceljs');

const loadSalesReport = async (req, res) => {
  try {
    // Filters and pagination
    let { startDate, endDate, status = 'all', payment = 'all', dateFilter } = req.query || {}
    const page = Math.max(parseInt(req.query.page || '1', 10), 1)
    const limit = Math.max(parseInt(req.query.limit || '10', 10), 1)
    const sortOption = req.query.sort || 'date-newest'
    const skip = (page - 1) * limit
    const search = req.query.search || ""

    console.log(sortOption)
   

    const match = {}

    // Status filter (case-insensitive exact match)
    if (status && status !== 'all') {
      match.status = new RegExp(`^${status}$`, 'i')
    }

    // Payment filter (map to schema values)
    if (payment && payment !== 'all') {
      const map = { online: 'ONLINE', cod: 'COD', wallet: 'WALLET' }
      match.paymentMethod = map[String(payment).toLowerCase()] || payment
    }

    if (search && search.trim() !== '') {
      const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tokens = search.trim().split(/\s+/); // split by spaces

      match.$and = tokens.map(token => ({
        fullName: { $regex: new RegExp(escapeRegex(token), 'i') }
      }));
    }

    
    let sort = {};
    switch (sortOption) {
      case "date-oldest":
        sort = { createdOn: 1 };
        break;
      case "amount-low":
        sort = { finalAmount: 1 };
        break;
      case "amount-high":
        sort = { finalAmount: -1 };
        break;
      case "date-newest":
      default:
        sort = { createdOn: -1 };
        break;
    }

    // Date filter presets
    if (dateFilter && dateFilter !== 'all' && dateFilter !== 'custom') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let start;
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      switch (dateFilter) {
        case 'today':
          start = today;
          break;
        case 'week':
          start = new Date(today);
          start.setDate(today.getDate() - today.getDay());
          break;
        case 'month':
          start = new Date(today.getFullYear(), today.getMonth(), 1);
          break;
        case 'year':
          start = new Date(today.getFullYear(), 0, 1);
          break;
      }
      startDate = start;
      endDate = end;
    }
    // Date range filter
    if (startDate || endDate) {
      match.createdOn = {}
      if (startDate) match.createdOn.$gte = new Date(startDate)
      if (endDate) {
        const e = new Date(endDate)
        e.setHours(23, 59, 59, 999)
        match.createdOn.$lte = e
      }
    }
   
   

    // Total count for pagination
    const totalCount = await Order.countDocuments(match)

    // Page data
      const orders = await Order.find(match)
      .populate('userId', 'firstName lastName email')
      .populate('orderedItems.productId')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean()

    // Payment formatting helper
    const formatPayment = (pm) => {
      switch (pm) {
        case 'ONLINE': return 'Online'
        case 'COD': return 'COD'
        case 'WALLET': return 'Wallet'
        default: return pm || 'Unknown'
      }
    }

    // Convert orders to front-end friendly salesData
    const salesData = orders.map((o) => {
      const customerName = o.userId
        ? [o.fullName].filter(Boolean).join(' ')
        : (o.userId.firstName || 'Unknown')
     

      const products = (o.orderedItems || []).map((oi) => {
        const unit = Number(oi.price) || Number(oi.productId?.salesPrice) || 0
        const qty = Number(oi.quantity) || 0
        return {
          name: oi.productId?.productName || 'Unknown Product',
          quantity: qty,
          price: unit * qty, // total line amount
        }
      })

      return {
        id: o.orderId,
        date: o.createdOn,
        customerName,
        paymentMethod: formatPayment(o.paymentMethod),
        couponUsed: o.couponApplied ? (o.couponCode || '') : '',
        totalAmount: Number(o.totalPrice) || 0,
        discount: Number((o.discountPrice !== undefined) ? o.discountPrice : o.couponDiscount) || 0,
        netPaidAmount: Number(o.finalAmount) || 0,
        status: o.status,
        products,
      }
    })

    // Global summary across ALL matching orders
    const [agg] = await Order.aggregate([
      { $match: match },
      {
        $facet: {
          counts: [ { $count: 'totalOrders' } ],
          totals: [
            {
              $group: {
                _id: null,
                totalAmount: { $sum: { $ifNull: ['$totalPrice', 0] } },
                totalDiscounts: { $sum: { $ifNull: ['$discountPrice', { $ifNull: ['$couponDiscount', 0] }] } },
                deliveredSales: { $sum: { $cond: [ { $eq: ['$status', 'Delivered'] }, { $ifNull: ['$finalAmount', 0] }, 0 ] } },
                cancelledNet: { $sum: { $cond: [ { $eq: ['$status', 'Cancelled'] }, { $ifNull: ['$finalAmount', 0] }, 0 ] } },
                footerNetRevenue: { $sum: { $cond: [ { $ne: ['$status', 'Cancelled'] }, { $ifNull: ['$finalAmount', 0] }, 0 ] } }
              }
            }
          ],
          productsSold: [
            { $match: { status: 'Delivered' } },
            { $unwind: '$orderedItems' },
            { $group: { _id: null, qty: { $sum: '$orderedItems.quantity' } } }
          ]
        }
      }
    ])

    const totalOrdersAll = agg?.counts?.[0]?.totalOrders || 0
    const totals = agg?.totals?.[0] || {}
    const productsSold = agg?.productsSold?.[0]?.qty || 0

    const totalSales = Number(totals.deliveredSales || 0)
    const totalDiscounts = Number(totals.totalDiscounts || 0)
    const totalReturns = Number(totals.cancelledNet || 0)
    const netRevenue = totalSales
   

    const summary = {
      totalSales,
      totalOrders: totalOrdersAll,
      productsSold,
      totalDiscounts,
      totalReturns,
      netRevenue,
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / limit))

    const responseData = {
      salesData,
      summary,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit
      }
    }

    // If it's an AJAX request, send JSON data. Otherwise, render the full page.
    if (req.xhr) {
      return res.json(responseData)
    }

    return res.render('admin/admin-sales-report', responseData)
  } catch (error) {
    console.error('Error loading sales report:', error)
    if (req.xhr) return res.status(500).json({ message: 'Failed to load sales report' })
    return res.status(500).render('admin/internalServer-error', {
      message: 'Failed to load sales report',
    })
  }
}



const createSalesReportPDF = async (req, res) => {
  try {
    console.log("Generating PDF report...");
    // Reuse the same filter logic from the main report function
    let { startDate, endDate, status = 'all', payment = 'all', dateFilter, search } = req.query || {}
    const sortOption = req.query.sort || 'date-newest'

    const match = {}

    // Status filter
    if (status && status !== 'all') {
      match.status = new RegExp(`^${status}$`, 'i')
    }

    // Payment filter
    if (payment && payment !== 'all') {
      const map = { online: 'ONLINE', cod: 'COD', wallet: 'WALLET' }
      match.paymentMethod = map[String(payment).toLowerCase()] || payment
    }

    // Search filter
    if (search && search.trim() !== '') {
      const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapeRegex(search), 'i');
      match.$or = [{ 'userId.firstName': regex }, { 'userId.lastName': regex }, { 'userId.email': regex }];
    }

    // Date filter presets
    if (dateFilter && dateFilter !== 'all' && dateFilter !== 'custom') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let start;
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      switch (dateFilter) {
        case 'today': start = today; break;
        case 'week': start = new Date(today); start.setDate(today.getDate() - today.getDay()); break;
        case 'month': start = new Date(today.getFullYear(), today.getMonth(), 1); break;
        case 'year': start = new Date(today.getFullYear(), 0, 1); break;
      }
      startDate = start;
      endDate = end;
    }

    // Date range filter
    if (startDate || endDate) {
      match.createdOn = {}
      if (startDate) match.createdOn.$gte = new Date(startDate)
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        match.createdOn.$lte = e;
      }
    }

    // Sorting
    let sort = {};
    switch (sortOption) {
      case "date-oldest": sort = { createdOn: 1 }; break;
      case "amount-low": sort = { finalAmount: 1 }; break;
      case "amount-high": sort = { finalAmount: -1 }; break;
      default: sort = { createdOn: -1 }; break;
    }

    // Fetch ALL matching orders (no pagination)
    const orders = await Order.find(match)
      .populate('userId', 'firstName lastName email')
      .populate('orderedItems.productId', 'productName salesPrice')
      .sort(sort)
      .lean();

    // --- Re-calculate summary for the ENTIRE filtered dataset ---
    const [agg] = await Order.aggregate([
      { $match: match },
      {
        $facet: {
          counts: [ { $count: 'totalOrders' } ],
          totals: [
            {
              $group: {
                _id: null,
                totalDiscounts: { $sum: { $ifNull: ['$discountPrice', { $ifNull: ['$couponDiscount', 0] }] } },
                deliveredSales: { $sum: { $cond: [ { $eq: ['$status', 'Delivered'] }, { $ifNull: ['$finalAmount', 0] }, 0 ] } },
                cancelledNet: { $sum: { $cond: [ { $eq: ['$status', 'Cancelled'] }, { $ifNull: ['$finalAmount', 0] }, 0 ] } },
                netRevenue: { $sum: { $cond: [ { $ne: ['$status', 'Cancelled'] }, { $ifNull: ['$finalAmount', 0] }, 0 ] } }
              }
            }
          ],
          productsSold: [
            { $match: { status: 'Delivered' } },
            { $unwind: '$orderedItems' },
            { $group: { _id: null, qty: { $sum: '$orderedItems.quantity' } } }
          ]
        }
      }
    ]);

    const summary = {
      totalSales: agg?.totals?.[0]?.deliveredSales || 0,
      totalOrders: agg?.counts?.[0]?.totalOrders || 0,
      productsSold: agg?.productsSold?.[0]?.qty || 0,
      totalDiscounts: agg?.totals?.[0]?.totalDiscounts || 0,
      totalReturns: agg?.totals?.[0]?.cancelledNet || 0,
      netRevenue: agg?.totals?.[0]?.netRevenue || 0,
    };

    // --- Map data to the format expected by the PDF generator ---
    const reportData = orders.map(o => ({
      id: o.orderId,
      date: o.createdOn,
      customerName: o.userId ? `${o.userId.firstName} ${o.userId.lastName}` : (o.fullName || 'N/A'),
      customerEmail: o.userId ? o.userId.email : 'N/A',
      paymentMethod: (o.paymentMethod || '').replace('ONLINE', 'Online').replace('COD', 'COD').replace('WALLET', 'Wallet'),
      couponUsed: o.couponApplied ? o.couponCode : '',
      totalAmount: o.totalPrice || 0,
      discount: (o.discountPrice !== undefined ? o.discountPrice : o.couponDiscount) || 0,
      netPaidAmount: o.finalAmount || 0,
      status: o.status,
      products: (o.orderedItems || []).map(item => ({
        name: item.productId?.productName || 'Product not found',
        quantity: item.quantity,
        price: item.price || item.productId?.salesPrice || 0,
      })),
    }));

    generateSalesReportPDF(reportData, summary, res)

  } catch (error) {
    console.error('Error creating sales report PDF:', error);
    res.status(500).send('Error generating PDF report.');
  }
}

const createSalesReportExcel = async (req, res) => {
  try {
    console.log("Generating Excel report...");
    // Reuse the same filter logic from the main report function
    let { startDate, endDate, status = 'all', payment = 'all', dateFilter, search } = req.query || {}
    const sortOption = req.query.sort || 'date-newest'

    const match = {}

    // Status filter
    if (status && status !== 'all') {
      match.status = new RegExp(`^${status}$`, 'i')
    }

    // Payment filter
    if (payment && payment !== 'all') {
      const map = { online: 'ONLINE', cod: 'COD', wallet: 'WALLET' }
      match.paymentMethod = map[String(payment).toLowerCase()] || payment
    }

    // Search filter
    if (search && search.trim() !== '') {
      const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapeRegex(search), 'i');
      match.$or = [{ 'userId.firstName': regex }, { 'userId.lastName': regex }, { 'userId.email': regex }];
    }

    // Date filter presets
    if (dateFilter && dateFilter !== 'all' && dateFilter !== 'custom') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let start;
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      switch (dateFilter) {
        case 'today': start = today; break;
        case 'week': start = new Date(today); start.setDate(today.getDate() - today.getDay()); break;
        case 'month': start = new Date(today.getFullYear(), today.getMonth(), 1); break;
        case 'year': start = new Date(today.getFullYear(), 0, 1); break;
      }
      startDate = start;
      endDate = end;
    }

    // Date range filter
    if (startDate || endDate) {
      match.createdOn = {}
      if (startDate) match.createdOn.$gte = new Date(startDate)
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        match.createdOn.$lte = e;
      }
    }

    // Sorting
    let sort = {};
    switch (sortOption) {
      case "date-oldest": sort = { createdOn: 1 }; break;
      case "amount-low": sort = { finalAmount: 1 }; break;
      case "amount-high": sort = { finalAmount: -1 }; break;
      default: sort = { createdOn: -1 }; break;
    }

    // Fetch ALL matching orders (no pagination)
    const orders = await Order.find(match)
      .populate('userId', 'firstName lastName email')
      .populate('orderedItems.productId', 'productName')
      .sort(sort)
      .lean();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    worksheet.columns = [
      { header: 'Order ID', key: 'id', width: 20 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Customer Name', key: 'customerName', width: 25 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Products', key: 'products', width: 40 },
      { header: 'Total Amount', key: 'totalAmount', width: 15, style: { numFmt: '"₹"#,##0.00' } },
      { header: 'Discount', key: 'discount', width: 15, style: { numFmt: '"₹"#,##0.00' } },
      { header: 'Net Paid', key: 'netPaidAmount', width: 15, style: { numFmt: '"₹"#,##0.00' } },
    ];

    orders.forEach(order => {
      worksheet.addRow({
        id: order.orderId,
        date: order.createdOn,
        customerName: order.userId ? `${order.userId.firstName} ${order.userId.lastName}` : (order.fullName || 'N/A'),
        paymentMethod: (order.paymentMethod || '').replace('ONLINE', 'Online').replace('COD', 'COD').replace('WALLET', 'Wallet'),
        status: order.status,
        products: (order.orderedItems || []).map(p => `${p.quantity}x ${p.productId?.productName || 'N/A'}`).join(', '),
        totalAmount: order.totalPrice || 0,
        discount: (order.discountPrice !== undefined ? order.discountPrice : o.couponDiscount) || 0,
        netPaidAmount: order.finalAmount || 0,
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="sales-report-${new Date().toISOString().split('T')[0]}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error creating sales report Excel:', error);
    res.status(500).send('Error generating Excel report.');
  }
}

module.exports = {
  loadSalesReport,
  createSalesReportPDF,
  createSalesReportExcel,
}
