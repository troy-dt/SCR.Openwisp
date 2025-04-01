const express = require('express');
const router = express.Router();
const routerController = require('../controllers/router.controller');
const metricController = require('../controllers/metric.controller');

// Router routes
router.get('/', routerController.getAllRouters);
router.get('/:id', routerController.getRouterById);
router.post('/', routerController.createRouter);
router.put('/:id', routerController.updateRouter);
router.delete('/:id', routerController.deleteRouter);

// Connection test route
router.post('/:id/test-connection', routerController.testConnection);

// Metrics routes
router.get('/:id/metrics', routerController.getRouterMetrics);
router.post('/:routerId/collect-metrics', metricController.collectMetrics);

// Metrics summary for dashboard
router.get('/metrics/summary', metricController.getMetricsSummary);
router.get('/metrics/latest', metricController.getLatestMetrics);

// Metrics collection configuration
router.get('/metrics/config', routerController.getMetricsConfig);
router.post('/metrics/config', routerController.updateMetricsConfig);

module.exports = router; 