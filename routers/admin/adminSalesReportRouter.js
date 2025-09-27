const express = require('express')
const router = express.Router()
const salesReportController = require('../../controllers/admin/adminSalesReport.js')
const { adminAuth } = require('../../middlewares/auth.js')

router.get('/', adminAuth, salesReportController.loadSalesReport)
router.get('/download-report', adminAuth, salesReportController.createSalesReportPDF)
router.get('/download-report-excel', adminAuth, salesReportController.createSalesReportExcel)


module.exports = router 