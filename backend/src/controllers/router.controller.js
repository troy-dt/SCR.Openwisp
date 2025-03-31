const { Router, Metric } = require('../models');
const sshClient = require('../utils/ssh');
const cronJobs = require('../utils/cron');
const { Op } = require('sequelize');

// Get all routers
exports.getAllRouters = async (req, res) => {
  try {
    const routers = await Router.findAll();
    res.status(200).json(routers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a router by ID
exports.getRouterById = async (req, res) => {
  try {
    const router = await Router.findByPk(req.params.id);
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
    // If hostname is not provided, use IP address temporarily
    if (!req.body.hostname) {
      req.body.hostname = req.body.ipAddress;
    }
    
    // Create the router in the database
    const router = await Router.create(req.body);
    
    // After creating, try to fetch the real hostname
    try {
      const hostname = await sshClient.fetchHostname(router);
      if (hostname) {
        router.hostname = hostname;
        await router.save();
      }
    } catch (hostnameError) {
      // Just log the error but don't fail the whole request
      console.error('Error fetching hostname:', hostnameError);
    }
    
    res.status(201).json(router);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update a router
exports.updateRouter = async (req, res) => {
  try {
    // Get the router
    const router = await Router.findByPk(req.params.id);
    
    if (!router) {
      return res.status(404).json({ message: 'Router not found' });
    }
    
    // Update the router in the database
    const [updated] = await Router.update(req.body, {
      where: { id: req.params.id },
      returning: true
    });
    
    if (updated === 0) {
      return res.status(404).json({ message: 'Router not found' });
    }
    
    // Reload the router with updated data
    const updatedRouter = await Router.findByPk(req.params.id);
    
    // If IP address was updated, try to fetch the hostname
    if (req.body.ipAddress && (!req.body.hostname || req.body.hostname === router.hostname)) {
      try {
        const hostname = await sshClient.fetchHostname(updatedRouter);
        if (hostname) {
          updatedRouter.hostname = hostname;
          await updatedRouter.save();
        }
      } catch (hostnameError) {
        // Just log the error but don't fail the whole request
        console.error('Error fetching hostname:', hostnameError);
      }
    }
    
    res.status(200).json(updatedRouter);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete a router
exports.deleteRouter = async (req, res) => {
  try {
    const router = await Router.findByPk(req.params.id);
    
    if (!router) {
      return res.status(404).json({ message: 'Router not found' });
    }
    
    // Delete all associated metrics
    await Metric.destroy({
      where: { routerId: req.params.id }
    });
    
    // Delete the router
    await router.destroy();
    
    res.status(200).json({ message: 'Router deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Test router connection
exports.testConnection = async (req, res) => {
  try {
    const router = await Router.findByPk(req.params.id);
    
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
    
    // Check if router exists
    const router = await Router.findByPk(id);
    if (!router) {
      return res.status(404).json({ message: 'Router not found' });
    }
    
    let timeFilter = {};
    const now = new Date();
    
    switch (timespan) {
      case 'hour':
        timeFilter = { timestamp: { [Op.gte]: new Date(now - 60 * 60 * 1000) } };
        break;
      case 'day':
        timeFilter = { timestamp: { [Op.gte]: new Date(now - 24 * 60 * 60 * 1000) } };
        break;
      case 'week':
        timeFilter = { timestamp: { [Op.gte]: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
        break;
      case 'month':
        timeFilter = { timestamp: { [Op.gte]: new Date(now - 30 * 24 * 60 * 60 * 1000) } };
        break;
      default:
        timeFilter = { timestamp: { [Op.gte]: new Date(now - 24 * 60 * 60 * 1000) } };
    }
    
    const metrics = await Metric.findAll({ 
      where: { 
        routerId: id,
        ...timeFilter
      },
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit)
    });
    
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