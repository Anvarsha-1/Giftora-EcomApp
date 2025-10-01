const PDFDocument = require('pdfkit')

const PAGE_WIDTH = 595.28; // A4 width in points
const FONT_REGULAR = 'Helvetica'
const FONT_BOLD = 'Helvetica-Bold'

/**
 * Generates a detailed sales report PDF.
 * @param {Array} orders - The array of formatted order data.
 * @param {Object} summary - The summary statistics for the report.
 * @param {Object} res - The Express response object.
 */
function generateSalesReportPDF(orders, summary, res) {
  const doc = new PDFDocument({ 
    size: 'A4',
    margin: 40,
    bufferPages: true,
  })

  // Set headers to prompt download
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="GIFTORA-Sales-Report-${new Date().toISOString().split('T')[0]}.pdf"`,
  )
  doc.pipe(res)

  // --- Reusable Helper Functions ---
  const formatCurrency = (amount) => `₹${(amount || 0).toLocaleString('en-IN')}`
  const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })

  // --- Document Header ---
  try {
    // Using an absolute path is more reliable if the execution context changes.
    doc.image('public/images/header/giftora.png', 40, 30, { width: 80 })
  } catch (e) {
    console.log("PDF Logo not found, skipping.");
    doc.font(FONT_BOLD).fontSize(16).text('GIFTORA', 40, 40);
  }

  doc.fillColor('#333')
    .fontSize(20).font(FONT_BOLD).text('Sales Report', { align: 'right' })
    .fontSize(10).font(FONT_REGULAR).text(`Generated: ${new Date().toLocaleString('en-IN')}`, { align: 'right' })
    .moveDown(2)

  // --- Summary Section ---
  doc.font(FONT_BOLD).fontSize(14).text('Report Summary', { underline: true }).moveDown(0.5)
  const summaryY = doc.y
  doc.font(FONT_REGULAR).fontSize(10)
  doc.text(`Total Sales (Delivered): ${formatCurrency(summary.totalSales)}`)
  doc.text(`Net Revenue (Excl. Cancelled): ${formatCurrency(summary.netRevenue)}`)
  doc.text(`Total Discounts Given: ${formatCurrency(summary.totalDiscounts)}`)
  doc.y = summaryY
  doc.text(`Total Orders: ${summary.totalOrders}`, { align: 'right' })
  doc.text(`Products Sold: ${summary.productsSold}`, { align: 'right' })
  doc.text(`Total Returns (Cancelled): ${formatCurrency(summary.totalReturns)}`, { align: 'right' })
  doc.moveDown(2)
  doc.strokeColor('#ccc').lineWidth(0.5).moveTo(40, doc.y).lineTo(PAGE_WIDTH - 40, doc.y).stroke().moveDown(1.5)

  // --- Table Header Function ---
  const drawTableHeader = () => {
    const y = doc.y;
    doc.font(FONT_BOLD).fontSize(9);
    doc.text('Order ID', 45, y);
    doc.text('Date', 100, y);
    doc.text('Customer', 160, y);
    doc.text('Status', 280, y);
    doc.text('Items', 330, y);
    doc.text('Discount', 390, y, { width: 60, align: 'right' });
    doc.text('Net Paid', 460, y, { width: 70, align: 'right' });
    doc.moveDown(0.5);
    doc.strokeColor('#ccc').lineWidth(0.5).moveTo(40, doc.y).lineTo(PAGE_WIDTH - 40, doc.y).stroke().moveDown(0.5);
  };

  // --- Table Row Function ---
  const drawTableRow = (order) => {
    const y = doc.y;
    const rowHeight = 15 + (order.products.length * 10); // Estimate row height for the current row
    const footerSpace = 100; // Reserve space for the final summary and page footer

    // Add a new page if the row won't fit, leaving a margin at the bottom
    if (y + rowHeight > doc.page.height - footerSpace) {
      doc.addPage();
      drawTableHeader();
    }

    const startY = doc.y;
    doc.font(FONT_REGULAR).fontSize(8.5);

    // Main row data
    doc.text(order.id, 45, startY, { width: 50, lineBreak: false });
    doc.text(formatDate(order.date), 100, startY, { width: 55 });
    doc.text(order.customerName, 160, startY, { width: 115 });
    doc.text(order.status, 280, startY, { width: 45 });
    doc.text(formatCurrency(order.discount), 390, startY, { width: 60, align: 'right' });
    doc.font(FONT_BOLD).text(formatCurrency(order.netPaidAmount), 460, startY, { width: 70, align: 'right' });

    // Products list within the row
    // Save the current Y position before drawing the product list
    const productListStartY = doc.y;
    doc.font(FONT_REGULAR).fontSize(7.5).fillColor('#555');
    order.products.forEach(p => {
      // Let pdfkit handle the Y position automatically for text wrapping
      doc.text(`${p.quantity}x ${p.name}`, 330, undefined, { width: 120 });
    });

    // Set Y position for the next row, ensuring it's below the tallest cell
    doc.y = Math.max(startY + 20, doc.y + 5);

    // Row separator
    doc.strokeColor('#e0e0e0').lineWidth(0.5).moveTo(40, doc.y).lineTo(PAGE_WIDTH - 40, doc.y).stroke().moveDown(0.5);
  };

  // --- Draw Table ---
  doc.font(FONT_BOLD).fontSize(14).text('Detailed Orders', { underline: true }).moveDown();
  drawTableHeader();
  orders.forEach((order) => {
    drawTableRow(order);
  });

  // --- Final Summary at the end of the report ---
  // Check if there's enough space for the summary, otherwise add a new page
  if (doc.y > doc.page.height - 120) {
    doc.addPage();
  }

  doc.moveDown(3);
  const finalSummaryY = doc.y;
  doc.font(FONT_BOLD).fontSize(12).text('Final Report Summary', { underline: true }).moveDown(0.5);
  doc.font(FONT_REGULAR).fontSize(10);
  
  // Use a consistent starting Y for all summary items to prevent cursor drift
  doc.text(`Total Sales (Delivered): ${formatCurrency(summary.totalSales)}`, { y: finalSummaryY + 25 });
  doc.text(`Total Discounts Given: ${formatCurrency(summary.totalDiscounts)}`, { y: finalSummaryY + 40 });
  doc.text(`Total Returns (Cancelled): ${formatCurrency(summary.totalReturns)}`, { y: finalSummaryY + 55 });
  doc.font(FONT_BOLD).fontSize(11).text(`Net Revenue (Excl. Cancelled): ${formatCurrency(summary.netRevenue)}`, { y: finalSummaryY + 75 });
  doc.y = finalSummaryY + 95; // Position cursor below the summary box

  // --- Page Footer with Page Numbers ---
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.count; i++) {
    doc.switchToPage(i);

    // Add footer text
    doc.font(FONT_REGULAR).fontSize(8);
    doc.fillColor('#555').text('GIFTORA Sales Report', 40, doc.page.height - 35, { align: 'left' });
    doc.text(`Page ${i + 1} of ${range.count}`, 40, doc.page.height - 35, { align: 'right' });
  }

  // Finalize the PDF
  doc.end()
}

module.exports = { generateSalesReportPDF };