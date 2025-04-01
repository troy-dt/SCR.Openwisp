const scanner = require('../utils/scanner');
const { Router } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { 
  scanForOpenWrtDevices, 
  createScanJob, 
  getScanJob, 
  startScanJob 
} = require('../utils/scanner');
const express = require('express');
const process = require('process');

// Log that the scanner controller is loaded
logger.info('Scanner controller loaded');

/**
 * Starts a subnet scan job and returns immediately with a job ID
 */
const scanSubnet = async (req, res) => {
  // Immediately set response headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Scanner-Request');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  
  // Handle OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    logger.info('⏱️ Starting scanner job controller');
    
    // Extract parameters
    const { subnet, username, password } = req.body;
    
    // Validate input
    if (!subnet) {
      return res.status(400).json({ 
        status: 'error',
        error: 'Subnet is required' 
      });
    }
    
    if (!username || !password) {
      return res.status(400).json({ 
        status: 'error',
        error: 'SSH credentials are required' 
      });
    }
    
    // Format subnet properly
    const subnetBase = subnet.endsWith('.') ? subnet : `${subnet}.`;
    
    // Create a new scan job - this is very fast
    const jobId = createScanJob(subnetBase, username, password);
    logger.info(`🔍 Created scan job ${jobId} for subnet ${subnetBase}`);
    
    // Respond immediately with the job ID
    const responseData = {
      status: 'accepted',
      message: 'Scan job created and started',
      jobId: jobId,
      subnet: subnetBase,
      timestamp: new Date().toISOString()
    };
    
    res.status(200).json(responseData);
    
    // Start the job in the background after response is sent
    process.nextTick(() => {
      try {
        startScanJob(jobId).catch(err => {
          logger.error(`Error in background scan job ${jobId}: ${err.message}`);
        });
      } catch (error) {
        logger.error(`Error starting job ${jobId}: ${error.message}`);
      }
    });
  } catch (error) {
    logger.error('❌ Unexpected error in scanSubnet controller:', error);
    
    // Ensure we send a valid JSON response for all error cases
    return res.status(500).json({
      status: 'error',
      error: `Server error: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Check the status of a scan job
 */
const checkScanStatus = async (req, res) => {
  // Set headers right away
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Scanner-Request');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  
  // Handle OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({
        status: 'error',
        error: 'Job ID is required'
      });
    }
    
    // Get the job status
    const job = getScanJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        status: 'error',
        error: 'Job not found or expired'
      });
    }
    
    // Process devices to check if they exist in the database
    // Only process if job is completed and has devices
    let devices = [];
    if (job.status === 'completed' && job.results.devices.length > 0) {
      try {
        devices = await processDevicesForResponse(job.results.devices);
      } catch (err) {
        logger.error(`Error processing devices for job ${jobId}: ${err.message}`);
        devices = job.results.devices;
      }
    } else {
      devices = job.results.devices;
    }
    
    // Respond with the job status
    res.status(200).json({
      status: job.status,
      progress: job.progress,
      subnet: job.subnet,
      message: job.message || getMessageForStatus(job),
      devices: devices,
      devicesFound: devices.length,
      partialScan: job.results.partialScan,
      error: job.error,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Error in checkScanStatus controller:', error);
    
    return res.status(500).json({
      status: 'error',
      error: `Server error: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get a human-readable message for a job status
 */
function getMessageForStatus(job) {
  switch (job.status) {
    case 'pending':
      return 'Scan job created and waiting to start';
    case 'running':
      return `Scanning subnet ${job.subnet}, ${job.progress}% complete`;
    case 'completed':
      if (job.results.devices.length === 0) {
        return 'Scan completed, no devices found';
      }
      return `Scan completed, found ${job.results.devices.length} devices`;
    case 'error':
      return `Scan failed: ${job.error}`;
    default:
      return 'Unknown job status';
  }
}

/**
 * Process devices to check if they exist in the database
 * @param {Array} devices - Array of discovered devices
 * @returns {Array} - Processed devices with existence info
 */
async function processDevicesForResponse(devices) {
  try {
    // Check if devices already exist in the database by MAC address
    const macAddresses = devices.map(device => device.macAddress).filter(mac => mac);
    
    if (macAddresses.length > 0) {
      const existingRouters = await Router.findAll({
        where: {
          macAddress: {
            [Op.in]: macAddresses
          }
        },
        attributes: ['id', 'name', 'hostname', 'ipAddress', 'macAddress']
      });
      
      // Mark devices that already exist in the database
      const existingMacs = existingRouters.map(router => router.macAddress);
      
      return devices.map(device => ({
        ...device,
        status: device.status || 'online',
        exists: existingMacs.includes(device.macAddress)
      }));
    } else {
      return devices.map(device => ({
        ...device,
        status: device.status || 'online',
        exists: false
      }));
    }
  } catch (error) {
    console.error('Error checking devices in database:', error);
    // Return devices without checking existence
    return devices.map(device => ({
      ...device,
      status: device.status || 'online',
      exists: false
    }));
  }
}

/**
 * Adds a discovered router to the database
 */
const addDiscoveredRouter = async (req, res) => {
  try {
    // Add CORS headers for direct connections
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Scanner-Request');
    
    // Handle OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    
    // Extract parameters
    const { ipAddress, hostname, macAddress, username, password, name } = req.body;
    
    // Validate input
    if (!ipAddress || !username || !password) {
      return res.status(400).json({ error: 'IP address and SSH credentials are required' });
    }
    
    logger.info(`Adding single router: ${ipAddress}`);
    
    // If MAC address starts with 'auto-', generate a consistent MAC based on IP
    let finalMacAddress = macAddress;
    if (macAddress && macAddress.startsWith('auto-')) {
      // Generate a deterministic MAC address based on IP if none provided
      // This ensures the same router always gets the same MAC
      const segments = ipAddress.split('.');
      const macSegments = segments.map(s => parseInt(s).toString(16).padStart(2, '0'));
      finalMacAddress = `02:${macSegments.join(':')}:ff`;
      logger.info(`Generated MAC address ${finalMacAddress} for ${ipAddress}`);
    }
    
    // Check if the router already exists by MAC address
    let existingRouter = null;
    
    if (finalMacAddress) {
      existingRouter = await Router.findOne({
        where: { macAddress: finalMacAddress }
      });
    }
    
    if (!existingRouter) {
      // Also check by hostname and IP to avoid duplicates
      existingRouter = await Router.findOne({
        where: {
          [Op.or]: [
            { hostname: hostname || '' },
            { ipAddress }
          ]
        }
      });
    }
    
    if (existingRouter) {
      // Update the existing router
      logger.info(`Updating existing router: ${existingRouter.name || existingRouter.ipAddress}`);
      await existingRouter.update({
        ipAddress,
        hostname: hostname || existingRouter.hostname,
        macAddress: finalMacAddress || existingRouter.macAddress,
        username,
        password,
        name: name || existingRouter.name
      });
      
      return res.status(200).json({
        message: 'Router updated successfully',
        router: {
          id: existingRouter.id,
          name: existingRouter.name,
          hostname: existingRouter.hostname,
          ipAddress: existingRouter.ipAddress,
          macAddress: existingRouter.macAddress
        }
      });
    } else {
      // Create a new router
      logger.info(`Creating new router: ${name || hostname || ipAddress}`);
      const newRouter = await Router.create({
        name: name || hostname || ipAddress,
        hostname: hostname || '',
        ipAddress,
        macAddress: finalMacAddress || null,
        username,
        password,
        status: 'active'
      });
      
      return res.status(201).json({
        message: 'Router added successfully',
        router: {
          id: newRouter.id,
          name: newRouter.name,
          hostname: newRouter.hostname,
          ipAddress: newRouter.ipAddress,
          macAddress: newRouter.macAddress
        }
      });
    }
  } catch (error) {
    logger.error('Error adding router:', error);
    return res.status(500).json({
      error: `Error adding router: ${error.message}`
    });
  }
};

/**
 * Adds multiple discovered routers
 */
const addMultipleRouters = async (req, res) => {
  try {
    // Add CORS headers for direct connections
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Scanner-Request');
    
    // Handle OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    
    // Extract parameters
    const { devices } = req.body;
    
    // Validate input
    if (!devices || !Array.isArray(devices) || devices.length === 0) {
      return res.status(400).json({ error: 'Devices array is required' });
    }
    
    logger.info(`Adding multiple routers: ${devices.length} devices`);
    
    // Process each device
    const results = {
      added: [],
      updated: [],
      failed: []
    };
    
    for (const device of devices) {
      try {
        logger.info(`Processing device: ${device.ipAddress}`);
        
        // Ensure we have either IP address or hostname - one must be present
        if (!device.ipAddress && !device.hostname) {
          results.failed.push({
            ipAddress: device.ipAddress || 'unknown',
            error: 'Either IP address or hostname is required'
          });
          logger.warn(`Missing required fields for device`);
          continue;
        }
        
        // Check if the router already exists by MAC address if available
        let existingRouter = null;
        
        if (device.macAddress) {
          logger.info(`Checking for existing router with MAC: ${device.macAddress}`);
          existingRouter = await Router.findOne({
            where: { macAddress: device.macAddress }
          });
        }
        
        // If no MAC or not found by MAC, check by IP or hostname
        if (!existingRouter) {
          logger.info(`Checking for existing router by IP or hostname`);
          const whereClause = {};
          
          if (device.ipAddress) {
            whereClause.ipAddress = device.ipAddress;
          }
          
          if (device.hostname) {
            whereClause.hostname = device.hostname;
          }
          
          if (Object.keys(whereClause).length > 0) {
            existingRouter = await Router.findOne({
              where: whereClause
            });
          }
        }
        
        if (existingRouter) {
          // Update the existing router
          logger.info(`Updating existing router: ${existingRouter.name || existingRouter.ipAddress}`);
          await existingRouter.update({
            ipAddress: device.ipAddress || existingRouter.ipAddress,
            hostname: device.hostname || existingRouter.hostname,
            macAddress: device.macAddress || existingRouter.macAddress,
            username: device.username || existingRouter.username,
            password: device.password || existingRouter.password
          });
          
          results.updated.push({
            id: existingRouter.id,
            name: existingRouter.name,
            hostname: existingRouter.hostname,
            ipAddress: existingRouter.ipAddress,
            macAddress: existingRouter.macAddress || 'Unknown'
          });
        } else {
          // Create a new router
          logger.info(`Creating new router: ${device.name || device.hostname || device.ipAddress}`);
          const newRouter = await Router.create({
            name: device.name || device.hostname || device.ipAddress,
            hostname: device.hostname || '',
            ipAddress: device.ipAddress,
            macAddress: device.macAddress || null,
            username: device.username,
            password: device.password,
            status: 'active'
          });
          
          results.added.push({
            id: newRouter.id,
            name: newRouter.name,
            hostname: newRouter.hostname,
            ipAddress: newRouter.ipAddress,
            macAddress: newRouter.macAddress || 'Unknown'
          });
        }
      } catch (error) {
        logger.error(`Error processing device ${device.ipAddress}:`, error);
        results.failed.push({
          ipAddress: device.ipAddress || 'unknown',
          macAddress: device.macAddress,
          error: error.message
        });
      }
    }
    
    const summary = {
      added: results.added.length,
      updated: results.updated.length,
      failed: results.failed.length,
      total: devices.length
    };
    
    logger.info(`Done processing devices. Summary: `, summary);
    
    return res.status(200).json({
      message: `Processed ${devices.length} devices`,
      summary: summary,
      added: results.added,
      updated: results.updated,
      failed: results.failed
    });
  } catch (error) {
    logger.error('Error adding multiple routers:', error);
    return res.status(500).json({
      error: `Error adding multiple routers: ${error.message}`
    });
  }
};

module.exports = {
  scanSubnet,
  checkScanStatus,
  addDiscoveredRouter,
  addMultipleRouters
}; 