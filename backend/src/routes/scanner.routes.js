const express = require('express');
const router = express.Router();
const scannerController = require('../controllers/scanner.controller');

/**
 * @route POST /api/scanner/scan
 * @desc Scan subnet for OpenWrt devices
 * @access Public
 */
router.post('/scan', scannerController.scanSubnet);

/**
 * @route GET /api/scanner/scan/:jobId
 * @desc Check the status of a scan job
 * @access Public
 */
router.get('/scan/:jobId', scannerController.checkScanStatus);

/**
 * @route POST /api/scanner/add
 * @desc Add a discovered router to the database
 * @access Public
 */
router.post('/add', scannerController.addDiscoveredRouter);

/**
 * @route POST /api/scanner/add-multiple
 * @desc Add multiple discovered routers
 * @access Public
 */
router.post('/add-multiple', scannerController.addMultipleRouters);

module.exports = router; 