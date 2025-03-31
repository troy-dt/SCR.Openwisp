const Router = require('../models/router.model');
const Metric = require('../models/metric.model');
const sshClient = require('../utils/ssh');
const cronJobs = require('../utils/cron');

// Get all routers
exports.getAllRouters = async (req, res) => {
  try {
    const routers = await Router.find();
    res.status(200).json(routers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a router by ID
exports.getRouterById = async (req, res) => {
  try {
    const router = await Router.findById(req.params.id);
    if (!router) {
      return res.status(404).json({ message: 'Router not found' });
    }
    res.status(200).json(router);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new router
exports.createRouter = async (req, res) => {
  try {
    const router = new Router(req.body);
    await router.save();
    res.status(201).json(router);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update a router
exports.updateRouter = async (req, res) => {
  try {
    const router = await Router.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true }
    );
    
    if (!router) {
      return res.status(404).json({ message: 'Router not found' });
    }
    
    res.status(200).json(router);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete a router
exports.deleteRouter = async (req, res) => {
  try {
    const router = await Router.findByIdAndDelete(req.params.id);
    
    if (!router) {
      return res.status(404).json({ message: 'Router not found' });
    }
    
    // Delete all associated metrics
    await Metric.deleteMany({ routerId: req.params.id });
    
    res.status(200).json({ message: 'Router deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Test router connection
exports.testConnection = async (req, res) => {
  try {
    const router = await Router.findById(req.params.id);
    
    if (!router) {
      return res.status(404).json({ message: 'Router not found' });
    }
    
    // Test SSH connection
    const isConnected = await sshClient.testConnection(router);
    
    if (isConnected) {
      // Update router status to online
      router.status = 'online';
      router.lastSeen = new Date();
      await router.save();
      
      res.status(200).json({ success: true, message: 'Connection successful' });
    } else {
      // Update router status to offline
      router.status = 'offline';
      await router.save();
      
      res.status(200).json({ success: false, message: 'Connection failed' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get router metrics
exports.getRouterMetrics = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 24, timespan = 'day' } = req.query;
    
    let timeFilter = {};
    const now = new Date();
    
    switch (timespan) {
      case 'hour':
        timeFilter = { timestamp: { $gte: new Date(now - 60 * 60 * 1000) } };
        break;
      case 'day':
        timeFilter = { timestamp: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
        break;
      case 'week':
        timeFilter = { timestamp: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
        break;
      case 'month':
        timeFilter = { timestamp: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } };
        break;
      default:
        timeFilter = { timestamp: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
    }
    
    const metrics = await Metric.find({ 
      routerId: id,
      ...timeFilter
    })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit));
    
    res.status(200).json(metrics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get metrics collection configuration
exports.getMetricsConfig = async (req, res) => {
  try {
    const currentInterval = cronJobs.getCollectionInterval();
    const availableIntervals = cronJobs.getAvailableIntervals();
    const status = cronJobs.getStatus();
    
    res.status(200).json({
      currentInterval,
      availableIntervals,
      status
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update metrics collection interval
exports.updateMetricsConfig = async (req, res) => {
  try {
    const { interval } = req.body;
    
    if (!interval) {
      return res.status(400).json({ message: 'Interval is required' });
    }
    
    const success = cronJobs.updateCollectionInterval(interval);
    
    if (!success) {
      return res.status(400).json({ message: 'Invalid interval' });
    }
    
    res.status(200).json({ 
      message: 'Metrics collection interval updated',
      currentInterval: cronJobs.getCollectionInterval()
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 