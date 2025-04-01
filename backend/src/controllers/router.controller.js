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
    // Set initial status
    req.body.status = 'unknown';
    req.body.lastSeen = null;
    
    // If hostname is not provided, use IP address temporarily
    if (!req.body.hostname) {
      req.body.hostname = req.body.ipAddress;
    }
    
    // Create the router in the database
    const router = await Router.create(req.body);
    
    // After creating, try to test connection, fetch hostname and MAC address
    try {
      // First test if we can connect to the router
      const isConnected = await sshClient.testConnection(router);
      
      if (isConnected) {
        // Update status to online
        router.status = 'online';
        router.lastSeen = new Date();
        
        // Try to fetch the real hostname and MAC address if connection works
        const hostname = await sshClient.fetchHostname(router);
        const macAddress = await sshClient.fetchMacAddress(router);
        
        if (hostname) {
          router.hostname = hostname;
        }
        
        if (macAddress) {
          router.macAddress = macAddress;
        }
      } else {
        // Update status to offline if connection fails
        router.status = 'offline';
      }
      
      await router.save();
    } catch (error) {
      // Just log the error but don't fail the whole request
      console.error('Error testing connection or fetching router data:', error);
      router.status = 'offline';
      await router.save();
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
    
    // If IP address was updated, try to fetch the hostname and MAC address
    if (req.body.ipAddress) {
      try {
        let needsUpdate = false;
        
        // Only update hostname if not explicitly provided in the request
        if (!req.body.hostname || req.body.hostname === router.hostname) {
          const hostname = await sshClient.fetchHostname(updatedRouter);
          if (hostname) {
            updatedRouter.hostname = hostname;
            needsUpdate = true;
          }
        }
        
        // Only update MAC address if not explicitly provided in the request
        if (!req.body.macAddress || req.body.macAddress === router.macAddress) {
          const macAddress = await sshClient.fetchMacAddress(updatedRouter);
          if (macAddress) {
            updatedRouter.macAddress = macAddress;
            needsUpdate = true;
          }
        }
        
        if (needsUpdate) {
          await updatedRouter.save();
        }
      } catch (error) {
        // Just log the error but don't fail the whole request
        console.error('Error fetching router data:', error);
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
    
    // Add CORS headers for testing
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Direct-Connection, Accept, Authorization');
    
    // Handle OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    
    // Log details for debugging
    console.log(`Testing connection to router: ${router.name} (${router.ipAddress})`);
    
    // First try a direct port check
    const portOpen = await sshClient.checkPortOpen(router.ipAddress, 22);
    console.log(`Port 22 check for ${router.ipAddress}: ${portOpen ? 'OPEN' : 'CLOSED'}`);
    
    // If port is closed, we don't need to try SSH
    if (!portOpen) {
      // Update router status to offline
      router.status = 'offline';
      await router.save();
      
      return res.status(200).json({ 
        success: false, 
        message: 'Connection failed: SSH port is not reachable',
        details: {
          portOpen: false,
          sshConnection: false,
          commandTest: false
        }
      });
    }
    
    // Try SSH connection
    console.log(`Attempting SSH connection to ${router.ipAddress}`);
    const isConnected = await sshClient.testConnection(router);
    console.log(`SSH connection test for ${router.ipAddress}: ${isConnected ? 'SUCCESS' : 'FAILED'}`);
    
    if (isConnected) {
      // Update router status to online
      router.status = 'online';
      router.lastSeen = new Date();
      await router.save();
      
      // Try to update hostname and MAC if missing
      try {
        let updated = false;
        
        if (!router.hostname || router.hostname === router.ipAddress) {
          const hostname = await sshClient.fetchHostname(router);
          if (hostname) {
            router.hostname = hostname;
            updated = true;
          }
        }
        
        if (!router.macAddress) {
          const macAddress = await sshClient.fetchMacAddress(router);
          if (macAddress) {
            router.macAddress = macAddress;
            updated = true;
          }
        }
        
        if (updated) {
          console.log(`Updated router info: hostname=${router.hostname}, macAddress=${router.macAddress}`);
          await router.save();
        }
      } catch (error) {
        console.error(`Error updating router info during connection test: ${error.message}`);
      }
      
      res.status(200).json({ 
        success: true, 
        message: 'Connection successful',
        details: {
          portOpen: true,
          sshConnection: true,
          hostname: router.hostname,
          macAddress: router.macAddress
        }
      });
    } else {
      // If the port is open but SSH fails, mark as online with limited functionality
      if (portOpen) {
        router.status = 'online';
        router.lastSeen = new Date();
        await router.save();
        
        res.status(200).json({ 
          success: true, 
          message: 'Port connection successful but SSH commands failed. Limited functionality available.',
          details: {
            portOpen: true,
            sshConnection: false,
            commandTest: false
          }
        });
      } else {
        // Update router status to offline
        router.status = 'offline';
        await router.save();
        
        res.status(200).json({ 
          success: false, 
          message: 'Connection failed',
          details: {
            portOpen: false,
            sshConnection: false,
            commandTest: false
          }
        });
      }
    }
  } catch (error) {
    console.error(`Error in testConnection controller: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Error testing connection: ${error.message}`,
      error: error.message
    });
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