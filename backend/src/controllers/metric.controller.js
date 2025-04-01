const { Router, Metric } = require('../models');
const sshClient = require('../utils/ssh');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

// Create a new metric
exports.createMetric = async (req, res) => {
  try {
    const metric = await Metric.create(req.body);
    res.status(201).json(metric);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get latest metrics for all routers
exports.getLatestMetrics = async (req, res) => {
  try {
    const routers = await Router.findAll({
      where: { monitoringEnabled: true }
    });
    
    if (routers.length === 0) {
      return res.status(200).json([]);
    }
    
    const routerIds = routers.map(router => router.id);
    
    // Get the latest metric for each router with a subquery
    const latestMetrics = await Metric.findAll({
      where: {
        routerId: { [Op.in]: routerIds }
      },
      include: [
        {
          model: Router,
          as: 'router',
          attributes: ['name', 'hostname', 'ipAddress', 'status']
        }
      ],
      order: [['timestamp', 'DESC']],
      group: ['Metric.routerId', 'Metric.id', 'router.id']
    });
    
    // Create a map of routerId -> metric for faster lookup
    const metricMap = new Map();
    latestMetrics.forEach(metric => {
      if (!metricMap.has(metric.routerId) || 
          new Date(metric.timestamp) > new Date(metricMap.get(metric.routerId).timestamp)) {
        metricMap.set(metric.routerId, metric);
      }
    });
    
    // Get the final list of latest metrics
    const filteredMetrics = [...metricMap.values()];
    
    res.status(200).json(filteredMetrics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Collect metrics for a specific router
exports.collectMetrics = async (req, res) => {
  try {
    const { routerId } = req.params;
    
    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      return res.status(204).send();
    }
    
    // Add CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    
    // Log the metrics collection attempt for debugging
    logger.info(`Collecting metrics for router ID ${routerId}`);
    
    // Find the router and check if monitoring is enabled
    const router = await Router.findByPk(routerId);
    if (!router) {
      logger.error(`Router not found: ${routerId}`);
      return res.status(404).json({ message: 'Router not found' });
    }
    
    if (!router.monitoringEnabled) {
      logger.warn(`Monitoring is disabled for router ${router.name} (${router.ipAddress})`);
      return res.status(400).json({ message: 'Monitoring is disabled for this router' });
    }
    
    // First check if the port is open without trying to collect metrics
    const portOpen = await sshClient.checkPortOpen(router.ipAddress, 22);
    if (!portOpen) {
      logger.warn(`Router ${router.ipAddress} is not reachable - SSH port closed`);
      
      // Update router status to offline
      router.status = 'offline';
      await router.save();
      
      return res.status(200).json({ 
        message: 'Device not reachable, SSH port closed',
        online: false,
        metrics: null
      });
    }
    
    // If we got here, the port is open, so the device is reachable
    // Update the router status immediately to online and last seen timestamp
    router.status = 'online';
    router.lastSeen = new Date();
    await router.save();
    
    // Now attempt to collect metrics
    const metrics = await sshClient.collectMetrics(router);
    
    // If metrics is null, the SSH connection failed but the device is still online (port is open)
    if (!metrics) {
      logger.error(`Failed to collect metrics for router ${router.name} (${router.ipAddress}), but device is reachable`);
      
      return res.status(200).json({ 
        message: 'Device is online but metrics collection failed',
        online: true,
        metrics: null
      });
    }
    
    // Check if there was an error in metrics collection
    let partialCollection = false;
    if (metrics.error) {
      logger.warn(`Partial metrics collection for router ${router.name}: ${metrics.error}`);
      partialCollection = true;
    }
    
    // Create a new metric with the collected data
    const newMetric = await Metric.create({
      routerId: router.id,
      timestamp: new Date(),
      uptime: metrics.uptime,
      memoryUsage: metrics.memoryUsage,
      cpuLoad: metrics.cpuLoad,
      diskUsage: metrics.diskUsage,
      networkInterfaces: metrics.networkInterfaces || [],
      wirelessClients: metrics.wirelessClients || 0
    });
    
    logger.info(`Metrics saved for router ${router.name} (${router.ipAddress})`);
    
    // Return the collected metrics
    return res.status(200).json({ 
      message: partialCollection ? 'Partial metrics collected' : 'Metrics collected successfully',
      online: true,
      metrics: newMetric 
    });
  } catch (error) {
    logger.error(`Error in collectMetrics: ${error.message}`);
    return res.status(500).json({ message: 'Error collecting metrics', error: error.message });
  }
};

// Get metrics summary for dashboard
exports.getMetricsSummary = async (req, res) => {
  try {
    const totalRouters = await Router.count();
    const onlineRouters = await Router.count({ where: { status: 'online' } });
    const offlineRouters = await Router.count({ where: { status: 'offline' } });
    const unknownRouters = await Router.count({ where: { status: 'unknown' } });
    
    // Get the latest metrics for calculating total clients
    const latestMetrics = await Metric.findAll({
      limit: totalRouters,
      order: [['timestamp', 'DESC']],
      group: ['Metric.routerId', 'Metric.id'],
      attributes: ['id', 'routerId', 'wirelessClients']
    });
    
    const totalClients = latestMetrics.reduce((total, metric) => {
      return total + (metric.wirelessClients || 0);
    }, 0);
    
    res.status(200).json({
      totalRouters,
      onlineRouters,
      offlineRouters,
      unknownRouters,
      totalClients
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 