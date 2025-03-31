const Metric = require('../models/metric.model');
const Router = require('../models/router.model');
const sshClient = require('../utils/ssh');

// Create a new metric
exports.createMetric = async (req, res) => {
  try {
    const metric = new Metric(req.body);
    await metric.save();
    res.status(201).json(metric);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get latest metrics for all routers
exports.getLatestMetrics = async (req, res) => {
  try {
    const routers = await Router.find({ monitoringEnabled: true });
    const routerIds = routers.map(router => router._id);
    
    // For each router, find the latest metric
    const latestMetrics = await Promise.all(
      routerIds.map(async (routerId) => {
        const metric = await Metric.findOne({ routerId })
          .sort({ timestamp: -1 })
          .limit(1);
        
        return metric;
      })
    );
    
    // Filter out null values (routers with no metrics)
    const filteredMetrics = latestMetrics.filter(metric => metric !== null);
    
    res.status(200).json(filteredMetrics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Collect metrics for a specific router
exports.collectMetrics = async (req, res) => {
  try {
    const router = await Router.findById(req.params.id);
    
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
    const metric = new Metric({
      routerId: router._id,
      ...metrics,
      timestamp: new Date()
    });
    
    await metric.save();
    
    res.status(200).json(metric);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get metrics summary for dashboard
exports.getMetricsSummary = async (req, res) => {
  try {
    const routers = await Router.find();
    const onlineCount = await Router.countDocuments({ status: 'online' });
    const offlineCount = await Router.countDocuments({ status: 'offline' });
    const unknownCount = await Router.countDocuments({ status: 'unknown' });
    
    // Get total connected clients across all routers
    const latestMetrics = await Metric.find()
      .sort({ timestamp: -1 })
      .limit(routers.length);
    
    const totalClients = latestMetrics.reduce((total, metric) => {
      return total + (metric.wirelessClients || 0);
    }, 0);
    
    res.status(200).json({
      totalRouters: routers.length,
      onlineRouters: onlineCount,
      offlineRouters: offlineCount,
      unknownRouters: unknownCount,
      totalClients
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 