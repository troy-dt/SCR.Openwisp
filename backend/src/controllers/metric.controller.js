const { Router, Metric } = require('../models');
const sshClient = require('../utils/ssh');
const { Op } = require('sequelize');

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
    const router = await Router.findByPk(req.params.id);
    
    if (!router) {
      return res.status(404).json({ message: 'Router not found' });
    }
    
    if (!router.monitoringEnabled) {
      return res.status(400).json({ message: 'Monitoring is disabled for this router' });
    }
    
    // Collect metrics via SSH
    const metrics = await sshClient.collectMetrics(router);
    
    if (!metrics) {
      // Update router status to offline
      router.status = 'offline';
      await router.save();
      
      return res.status(500).json({ message: 'Failed to collect metrics' });
    }
    
    // Update router status to online
    router.status = 'online';
    router.lastSeen = new Date();
    await router.save();
    
    // Save the metrics
    const metric = await Metric.create({
      routerId: router.id,
      ...metrics,
      timestamp: new Date()
    });
    
    res.status(200).json(metric);
  } catch (error) {
    res.status(500).json({ message: error.message });
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