const DocumentPDF = require('pdfkit')

const PDFDocument = require('pdfkit');

function BuildPDF(order, dataCallback, endCallback) {
    const doc = new PDFDocument({ margin: 50 });

    doc.on('data', dataCallback);
    doc.on('end', endCallback);

    // ===== HEADER WITH LOGO & MODERN STYLE =====
    try {
        doc.image("/public/images/header/giftora.png", doc.page.width / 2 - 40, 30, { width: 80 });
    } catch (e) {
        // If logo not found, skip
    }
    doc.moveDown(2.2);
    doc
        .fillColor('#2E3A59')
        .fontSize(24)
        .font('Helvetica-Bold')
        .text("GIFTORA", { align: "center" })
        .moveDown(0.2);
    doc
        .fillColor('#666')
        .fontSize(11)
        .font('Helvetica')
        .text("123 Business Street, City, Country", { align: "center" })
        .text("Email: support@giftora.com | Phone: +91-9061318498", { align: "center" });
    doc.moveDown(1.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).lineWidth(1).strokeColor('#e0e0e0').stroke();
    doc.moveDown(1);

    // ===== INVOICE DETAILS =====
    doc
        .fontSize(13)
        .fillColor('#2E3A59')
        .font('Helvetica-Bold')
        .text(`Invoice #: ${order.orderId}`, 50, doc.y)
        .font('Helvetica')
        .fillColor('#333')
        .text(`Date: ${new Date(order.createdOn).toLocaleDateString()}`)
        .text(`Payment Method: ${order.paymentMethod}`)
        .text(`Payment Status: ${order.paymentStatus}`);
    doc.moveDown(1);

    // ===== CUSTOMER DETAILS =====
    if (order.address) {
        doc
            .fontSize(12)
            .fillColor('#2E3A59')
            .font('Helvetica-Bold')
            .text("Bill To:")
            .font('Helvetica')
            .fillColor('#333')
            .text(order.fullName)
            .text(`Mobile: ${order.mobileNumber}`)
            .text(order.address)
            .text(`City: ${order.city}`)
            .text(`District: ${order.district}`)
            .text(`State: ${order.state}`)
            .text(`Landmark: ${order.landmark || ''}`)
            .text(`Pin Code: ${order.pinCode}`)
            .text(`Address Type: ${order.addressType}`);
    }
    doc.moveDown(1);

    // ===== TABLE HEADER WITH COLOR =====
    const tableTop = doc.y;
    doc
        .rect(50, tableTop, 500, 22)
        .fill('#f5f6fa');
    doc
        .fillColor('#2E3A59')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text("Item", 55, tableTop + 6, { continued: true })
        .text("Qty", 245, tableTop + 6, { continued: true })
        .text("Price", 295, tableTop + 6, { continued: true })
        .text("Status", 345, tableTop + 6, { continued: true })
        .text("Total", 395, tableTop + 6);
    doc.moveDown(1.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).lineWidth(1).strokeColor('#e0e0e0').stroke();
    doc.moveDown(0.2);

    // ===== TABLE ROWS =====
    let subtotal = 0;
    order.orderedItems.forEach(item => {
        const productName = item.productId?.ProductName || "Product";
        const qty = item.quantity;
        const price = item.price || item.productId?.price || 0;
        const total = qty * price;
        subtotal += total;

        doc
            .fillColor('#333')
            .font('Helvetica')
            .fontSize(11)
            .text(productName, 55, doc.y, { continued: true })
            .text(qty.toString(), 245, doc.y, { continued: true })
            .text(`Rs.${price}`, 295, doc.y, { continued: true })
            .text(`${item.status}`, 345, doc.y, { continued: true })
            .text(`Rs.${total}`, 395, doc.y);
        doc.moveDown(0.5);
    });
    doc.moveTo(50, doc.y).lineTo(550, doc.y).lineWidth(1).strokeColor('#e0e0e0').stroke();
    doc.moveDown(0.5);

    // ===== TOTALS SECTION WITH SHADED BOX =====
    let totalsTop = doc.y;
    // Calculate tax and shipping
    const tax = Math.round(subtotal * 0.05);
    const shipping = subtotal < 1000 ? 50 : 0;
    let grandTotal = subtotal + tax + shipping;
    let offset = 10;
    doc
        .rect(350, totalsTop, 200, 120)
        .fill('#f5f6fa');
    doc
        .fontSize(12)
        .fillColor('#2E3A59')
        .font('Helvetica-Bold')
        .text(`Subtotal:`, 360, totalsTop + offset, { continued: true })
        .font('Helvetica')
        .fillColor('#333')
        .text(`Rs.${subtotal}`, 430, totalsTop + offset);
    offset += 18;
    doc
        .font('Helvetica-Bold')
        .fillColor('#2E3A59')
        .text(`Tax (5%):`, 360, totalsTop + offset, { continued: true })
        .font('Helvetica')
        .fillColor('#333')
        .text(`Rs.${tax}`, 430, totalsTop + offset);
    offset += 18;
    doc
        .font('Helvetica-Bold')
        .fillColor('#2E3A59')
        .text(`Shipping:`, 360, totalsTop + offset, { continued: true })
        .font('Helvetica')
        .fillColor('#333')
        .text(`Rs.${shipping}`, 430, totalsTop + offset);
    offset += 18;
    if (order.discountPrice > 0) {
        doc
            .font('Helvetica-Bold')
            .fillColor('#2E3A59')
            .text(`Discount:`, 360, totalsTop + offset, { continued: true })
            .font('Helvetica')
            .fillColor('#27ae60')
            .text(`-Rs.${order.discountPrice}`, 430, totalsTop + offset);
        grandTotal -= order.discountPrice;
        offset += 15;
    }
    if (order.couponDiscount > 0) {
        doc
            .font('Helvetica-Bold')
            .fillColor('#2E3A59')
            .text(`Coupon Discount:`, 360, totalsTop + offset, { continued: true })
            .font('Helvetica')
            .fillColor('#27ae60')
            .text(`-Rs.${order.couponDiscount}`, 430, totalsTop + offset);
        grandTotal -= order.couponDiscount;
        offset += 15;
    }
    doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#2E3A59')
        .text(`Grand Total:`, 360, totalsTop + offset + 5, { continued: true })
        .font('Helvetica')
        .fillColor('#e67e22')
        .text(`Rs.${grandTotal}`, 400, totalsTop + offset);
    doc.moveDown(4);

    // ===== FOOTER =====
    doc.moveTo(50, doc.page.height - 100).lineTo(550, doc.page.height - 100).lineWidth(1).strokeColor('#e0e0e0').stroke();
    doc
        .fontSize(11)
        .fillColor('#2E3A59')
        .font('Helvetica-Bold')
        .text("Thank you for shopping with us!", 0, doc.page.height - 90, { align: "center" })
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#888')
        .text("This is a system-generated invoice, no signature required.", 0, doc.page.height - 75, { align: "center" });

    doc.end();
}

module.exports = BuildPDF;
