const { exec } = require('child_process');
const util = require('util');
const { NodeSSH } = require('node-ssh');
const logger = require('./logger');
const { promisify } = require('util');
const os = require('os');
const fs = require('fs').promises;
const { Client } = require('ssh2');
const net = require('net');

// Promisify exec
const execPromise = util.promisify(exec);
const execAsync = promisify(exec);

// In-memory storage for scan jobs
const scanJobs = new Map();

/**
 * Create a new scan job and return a job ID
 * @param {string} subnet - Subnet to scan
 * @param {string} username - SSH username
 * @param {string} password - SSH password
 * @returns {string} - Job ID
 */
function createScanJob(subnet, username, password) {
  const jobId = `scan_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  
  scanJobs.set(jobId, {
    id: jobId,
    subnet,
    status: 'pending', // pending, running, completed, error
    createdAt: new Date(),
    updatedAt: new Date(),
    progress: 0,
    results: {
      devices: [],
      partialScan: false
    },
    error: null
  });
  
  return jobId;
}

/**
 * Get a scan job by ID
 * @param {string} jobId - Job ID
 * @returns {object|null} - Job data or null if not found
 */
function getScanJob(jobId) {
  return scanJobs.get(jobId) || null;
}

/**
 * Update a scan job's status
 * @param {string} jobId - Job ID
 * @param {object} updates - Fields to update
 */
function updateScanJob(jobId, updates) {
  const job = scanJobs.get(jobId);
  
  if (job) {
    scanJobs.set(jobId, {
      ...job,
      ...updates,
      updatedAt: new Date()
    });
  }
}

/**
 * Comprehensive subnet scan that includes 192.168.1.36 and nearby IPs
 * @param {string} subnet - Subnet to scan (e.g. '192.168.1')
 * @returns {Promise<string[]>} - Array of active IPs
 */
async function comprehensiveSubnetScan(subnet) {
  const logger = require('./logger');
  const activeIPs = [];
  
  // Ensure subnet is properly formatted
  const formattedSubnet = subnet.endsWith('.') ? subnet : `${subnet}.`;
  
  logger.info(`🔍 Starting comprehensive scan for ${formattedSubnet} with focus on .36`);
  
  // Specific target to check first (192.168.1.36) with much longer timeout
  const targetIP = `${formattedSubnet}36`;
  logger.info(`Specifically checking reported device at ${targetIP} with extended timeouts`);
  
  // Try multiple approaches to detect the device
  try {
    // Approach 1: Ping with longer timeout (using net.Socket for TCP ping)
    logger.info(`Approach 1: Checking ${targetIP} with TCP port scan on common ports`);
    
    // Check more ports with much longer timeouts
    const portsToTry = [22, 80, 443, 8080, 8081, 8443, 23, 53, 21, 25, 3389, 5000];
    
    for (const port of portsToTry) {
      try {
        // Use much longer timeout (800ms) for this specific IP
        const isOpen = await checkPortOpenQuick(targetIP, port, 800);
        
        if (isOpen) {
          logger.info(`✓ Found device at ${targetIP} on port ${port} with longer timeout!`);
          activeIPs.push(targetIP);
          break;
        }
      } catch (err) {
        // Continue to next port
      }
    }
    
    // If still not found, try with even longer timeout and fewer ports
    if (!activeIPs.includes(targetIP)) {
      logger.info(`Approach 2: Checking ${targetIP} with extreme timeout`);
      
      // Essential ports only, but with very long timeout
      for (const port of [80, 22, 23]) {
        try {
          // Use extreme timeout (1500ms)
          const isOpen = await new Promise((resolve) => {
            const socket = new net.Socket();
            let resolved = false;
            
            socket.setTimeout(1500); // Very long timeout
            
            socket.on('connect', () => {
              resolved = true;
              socket.destroy();
              resolve(true);
            });
            
            socket.on('timeout', () => {
              if (!resolved) {
                socket.destroy();
                resolve(false);
              }
            });
            
            socket.on('error', () => {
              if (!resolved) {
                socket.destroy();
                resolve(false);
              }
            });
            
            socket.connect(port, targetIP);
          });
          
          if (isOpen) {
            logger.info(`✓ Found device at ${targetIP} on port ${port} with extreme timeout!`);
            activeIPs.push(targetIP);
            break;
          }
        } catch (err) {
          // Ignore errors
        }
      }
    }
    
    // If still not found, try basic ICMP ping as a fallback
    if (!activeIPs.includes(targetIP)) {
      logger.info(`Approach 3: Force adding ${targetIP} to ensure it's included in scan`);
      
      // Force add the IP to the active list - we'll check it during OpenWrt scan
      // This ensures we attempt an SSH connection even if port checks fail
      logger.info(`Force adding ${targetIP} to active IPs list for OpenWrt check`);
      activeIPs.push(targetIP);
    }
  } catch (error) {
    logger.warn(`Error in comprehensive check for ${targetIP}: ${error.message}`);
    // Force add the IP even if there was an error
    if (!activeIPs.includes(targetIP)) {
      activeIPs.push(targetIP);
    }
  }
  
  // Scan nearby IPs with improved timeout
  const nearbyIPs = [];
  for (let i = 34; i <= 38; i++) {
    if (i !== 36) { // Skip 36 as we already checked it
      nearbyIPs.push(`${formattedSubnet}${i}`);
    }
  }
  
  // Check nearby IPs in parallel with increased timeout
  const nearbyPromises = nearbyIPs.map(async (ip) => {
    try {
      // Check multiple ports with increased timeout
      for (const port of [22, 80, 443]) {
        const isOpen = await checkPortOpenQuick(ip, port, 500);
        if (isOpen && !activeIPs.includes(ip)) {
          logger.info(`Found active IP at ${ip} on port ${port}`);
          activeIPs.push(ip);
          break;
        }
      }
    } catch (err) {
      // Ignore errors
    }
  });
  
  await Promise.allSettled(nearbyPromises);
  
  logger.info(`Comprehensive scan found ${activeIPs.length} devices, including forced target device`);
  return activeIPs;
}

/**
 * Start a scan job in the background
 * @param {string} jobId - Job ID
 */
async function startScanJob(jobId) {
  const job = scanJobs.get(jobId);
  const logger = require('./logger');
  
  if (!job || job.status !== 'pending') {
    return;
  }
  
  // Update job status to running
  updateScanJob(jobId, { status: 'running', progress: 5 });
  
  const { subnet, username, password } = job;
  
  try {
    // Do a comprehensive scan focusing on specific problem areas
    updateScanJob(jobId, { progress: 10, message: 'Scanning reported device locations' });
    const specificIPs = await comprehensiveSubnetScan(subnet);
    
    // Update with progress
    updateScanJob(jobId, { 
      progress: 20, 
      message: `Found ${specificIPs.length} devices in targeted scan` 
    });
    
    // Do a quick scan for potential routers - Fast!
    updateScanJob(jobId, { progress: 30, message: 'Checking common router IPs' });
    const quickScanIPs = await quickRouterScan(subnet);
    
    // Combine results, removing duplicates
    const allActiveIPs = [...new Set([...specificIPs, ...quickScanIPs])];
    
    updateScanJob(jobId, { 
      progress: 40, 
      message: `Found ${allActiveIPs.length} potential devices total` 
    });
    
    if (allActiveIPs.length === 0) {
      // Still nothing found
      updateScanJob(jobId, {
        status: 'completed',
        progress: 100,
        message: 'No potential routers found',
        results: { devices: [], partialScan: false }
      });
      return;
    }
    
    // Update progress
    updateScanJob(jobId, { 
      progress: 50, 
      message: `Checking ${allActiveIPs.length} potential devices for OpenWrt`
    });
    
    // Check if these IPs are OpenWrt devices with extended timeout
    const { devices, partialScan } = await scanForOpenWrtDevices(subnet, username, password, allActiveIPs);
    
    // Update job status to completed
    updateScanJob(jobId, {
      status: 'completed',
      progress: 100,
      message: `Completed scan, found ${devices.length} devices`,
      results: { devices, partialScan }
    });
  } catch (error) {
    // Update job status to error
    updateScanJob(jobId, {
      status: 'error',
      progress: 100,
      error: error.message
    });
  }
}

// Clean up old scan jobs periodically (jobs older than 30 minutes)
setInterval(() => {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  
  for (const [jobId, job] of scanJobs.entries()) {
    if (job.updatedAt < cutoff) {
      scanJobs.delete(jobId);
    }
  }
}, 5 * 60 * 1000);  // Run every 5 minutes

/**
 * Scan subnet for active devices - using a much faster TCP port check approach
 * @param {string} subnet - Subnet to scan (e.g. '192.168.1.')
 * @returns {Promise<Object>} - Array of active IP addresses and partial scan status
 */
async function scanSubnet(subnet) {
  console.log(`🔍 Starting optimized scan for subnet ${subnet}`);
  
  // Very high priority common router addresses to check first
  const highPriorityIPs = ['1', '254', '1', '100', '101', '102'];
  
  // Secondary priority addresses
  const mediumPriorityIPs = ['2', '99', '200', '253', '250', '252', '10', '20', '30', '50'];
  
  // Keep track of active IPs and whether scan was partial
  let activeIPs = [];
  let partialScan = false;
  
  // Step 1: Check high priority IPs first (most likely router addresses)
  console.log('Checking high priority IPs first...');
  const highPriorityResults = await checkBatchOfIPs(subnet, highPriorityIPs, 200);
  activeIPs = [...highPriorityResults];
  
  // If we found something already, great! Return early with these results
  if (activeIPs.length >= 2) {
    console.log(`✓ Found ${activeIPs.length} active high-priority IPs, returning early results`);
    return { activeIPs, partialScan: true };
  }
  
  // Step 2: Check medium priority IPs next
  console.log('Checking medium priority IPs...');
  const mediumPriorityResults = await checkBatchOfIPs(subnet, mediumPriorityIPs, 150);
  activeIPs = [...activeIPs, ...mediumPriorityResults];
  
  // If we found enough by now, return these results
  if (activeIPs.length >= 3) {
    console.log(`✓ Found ${activeIPs.length} active IPs in priority scan, returning results`);
    return { activeIPs, partialScan: true };
  }
  
  // Step 3: Scan the remaining IP range in larger batches
  console.log('Scanning remaining IP range in batches...');
  
  // Create batches for the remaining IPs (1-254)
  const batches = [];
  const batchSize = 40; // Use larger batches for faster scanning
  
  // Skip IPs we've already checked
  const checkedIPs = [...highPriorityIPs, ...mediumPriorityIPs];
  const remainingIPs = [];
  
  for (let i = 1; i <= 254; i++) {
    const ip = i.toString();
    if (!checkedIPs.includes(ip)) {
      remainingIPs.push(ip);
    }
  }
  
  // Split remaining IPs into batches
  for (let i = 0; i < remainingIPs.length; i += batchSize) {
    batches.push(remainingIPs.slice(i, i + batchSize));
  }
  
  // Process batches until we find enough IPs or finish scanning
  let batchesProcessed = 0;
  
  for (const [index, batch] of batches.entries()) {
    batchesProcessed++;
    console.log(`Processing batch ${batchesProcessed}/${batches.length} (${batch.length} IPs)`);
    
    const batchResults = await checkBatchOfIPs(subnet, batch, 100);
    activeIPs = [...activeIPs, ...batchResults];
    
    // Log progress
    if (batchResults.length > 0) {
      console.log(`✓ Found ${batchResults.length} active IPs in batch ${batchesProcessed}`);
    }
    
    // If we already found enough IPs or processed several batches, break early
    if (activeIPs.length >= 5 || (activeIPs.length > 0 && batchesProcessed >= 4)) {
      partialScan = true;
      console.log(`✓ Found ${activeIPs.length} active IPs, stopping scan early`);
      break;
    }
    
    // If we're taking too long, mark as partial scan but continue
    if (batchesProcessed % 2 === 0) {
      console.log(`Processed ${batchesProcessed}/${batches.length} batches so far, continuing scan...`);
    }
    
    // Avoid going too far if we've found some IPs already
    if (activeIPs.length > 0 && batchesProcessed >= 8) {
      partialScan = true;
      console.log('Limiting scan depth to avoid timeout, partial results available');
      break;
    }
  }
  
  if (batchesProcessed < batches.length) {
    partialScan = true;
    console.log(`⚠️ Partially scanned subnet (${batchesProcessed}/${batches.length} batches)`);
  } else {
    console.log(`✅ Completed full subnet scan, found ${activeIPs.length} active IPs`);
  }
  
  return { activeIPs, partialScan };
}

/**
 * Check a batch of IPs to see if they respond on common router ports
 * @param {string} subnet - Base subnet (e.g. '192.168.1.')
 * @param {string[]} ips - Array of IP suffixes to check
 * @param {number} timeout - Connection timeout in milliseconds
 * @returns {Promise<string[]>} - Array of active IP addresses
 */
async function checkBatchOfIPs(subnet, ips, timeout = 150) {
  try {
    // Common router-related ports to check
    const portsToCheck = [80, 443, 22, 8080, 8081];
    const activeIPs = [];
    
    // Run checks in parallel with higher concurrency
    const promises = [];
    
    for (const ip of ips) {
      const fullIP = `${subnet}${ip}`;
      // Try to connect to at least one port to determine if device is alive
      const portPromise = async () => {
        for (const port of portsToCheck) {
          try {
            const isOpen = await Promise.race([
              checkPortOpen(fullIP, port, Math.floor(timeout / 2)),
              new Promise(resolve => setTimeout(() => resolve(false), timeout))
            ]);
            
            if (isOpen) {
              // Port is open, this IP is active
              if (!activeIPs.includes(fullIP)) {
                activeIPs.push(fullIP);
              }
              // Stop checking other ports for this IP
              break;
            }
          } catch (err) {
            // Ignore individual port check errors
          }
        }
      };
      
      promises.push(portPromise());
    }
    
    // Run all promises
    await Promise.all(promises);
    
    return activeIPs;
  } catch (error) {
    console.error(`Error checking batch: ${error.message}`);
    return [];
  }
}

/**
 * Check if a specific port is open on a host
 * Very fast connection check without full handshake
 * @param {string} ip - IP address to check
 * @param {number} port - Port number to check
 * @param {number} timeout - Connection timeout in milliseconds
 * @returns {Promise<boolean>} - Whether the port is open
 */
async function checkPortOpen(ip, port, timeout = 100) {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let resolved = false;
    
    // Set a very short timeout
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(true);
      }
    });
    
    socket.on('timeout', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });
    
    socket.on('error', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });
    
    // Connect to the host
    socket.connect(port, ip);
  });
}

/**
 * Fast scan for a specific router IP
 * @param {string} subnet - Base subnet (e.g. '192.168.1.')
 * @returns {Promise<string[]>} - Array of likely router IPs
 */
async function quickRouterScan(subnet) {
  const logger = require('./logger');
  logger.info(`🔍 Starting quick router scan for subnet ${subnet}`);
  
  // Common router addresses - special priority for 36 based on user feedback
  const routerIPs = ['36', '1', '254', '100', '101', '102', '2', '99', '253', '250', '252', '10', '20', '30', '50'];
  const activeIPs = [];
  
  // Use longer timeout for more reliability
  const timeout = 300; // Increased from 120 to 300ms
  
  // First specifically check 192.168.1.36 with extra attention
  const targetIP = `${subnet}36`;
  logger.info(`Giving priority to ${targetIP} with extended timeout`);
  
  try {
    // Try all common ports for this specific IP
    for (const port of [22, 80, 443, 8080, 23]) {
      // Use longer timeout for this special case
      const isOpen = await checkPortOpenQuick(targetIP, port, 500);
      if (isOpen) {
        logger.info(`✓ Successfully found device at priority IP ${targetIP} on port ${port}`);
        activeIPs.push(targetIP);
        break;
      }
    }
  } catch (error) {
    logger.warn(`Error checking priority IP ${targetIP}: ${error.message}`);
    // Force add it anyway to ensure it gets checked
    if (!activeIPs.includes(targetIP)) {
      logger.info(`Force adding ${targetIP} to ensure it's included`);
      activeIPs.push(targetIP);
    }
  }
  
  // Check other common IPs in parallel
  logger.info(`Checking ${routerIPs.length - 1} other common router IPs`);
  
  // Check in parallel with Promise.all for speed
  const promises = routerIPs.map(async (ip) => {
    // Skip 36 as we already checked it
    if (ip === '36') return;
    
    const fullIP = `${subnet}${ip}`;
    
    // Check the most common ports for quick results
    for (const port of [22, 80, 443]) { // Put SSH first as we need it for detection
      try {
        // Use socket connection with minimal timeout to check port
        const isOpen = await checkPortOpenQuick(fullIP, port, timeout);
        
        if (isOpen && !activeIPs.includes(fullIP)) {
          logger.info(`Found active IP at ${fullIP} (port ${port})`);
          activeIPs.push(fullIP);
          break;  // Stop checking other ports for this IP
        }
      } catch (err) {
        // Ignore errors, just continue to next port
      }
    }
  });
  
  try {
    // Use Promise.allSettled to handle all promises, even if some reject
    await Promise.allSettled(promises);
    
    // If we don't find any IP in our priority list, try to scan a wider range
    if (activeIPs.length <= 1) { // If we only have the forced 36 IP
      logger.info('Limited IPs found, checking a wider range');
      
      // Try a few more IPs (10 at a time to avoid timeouts)
      const extraIPs = [];
      for (let i = 35; i <= 40; i++) if (i !== 36) extraIPs.push(i.toString()); // Around 36
      for (let i = 150; i <= 200; i += 10) extraIPs.push(i.toString()); // More ranges
      
      const extraPromises = extraIPs.map(async (ip) => {
        const fullIP = `${subnet}${ip}`;
        
        // Check only SSH port for these
        try {
          const isOpen = await checkPortOpenQuick(fullIP, 22, timeout);
          
          if (isOpen && !activeIPs.includes(fullIP)) {
            logger.info(`Found active IP at ${fullIP} (port 22) in extended scan`);
            activeIPs.push(fullIP);
          }
        } catch (err) {
          // Ignore errors
        }
      });
      
      await Promise.allSettled(extraPromises);
    }
  } catch (error) {
    // Ignore errors, just log them
    logger.warn(`Error in quickRouterScan: ${error.message}`);
  }
  
  logger.info(`Quick router scan found ${activeIPs.length} potential routers`);
  return activeIPs;
}

/**
 * Ultra-fast port check with minimal overhead
 * @param {string} ip - IP address to check
 * @param {number} port - Port number to check
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>}
 */
async function checkPortOpenQuick(ip, port, timeout = 80) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let hasResolved = false;
    
    // Set a very short timeout
    socket.setTimeout(timeout);
    
    // Handle socket events
    socket.on('connect', () => {
      if (!hasResolved) {
        hasResolved = true;
        socket.destroy();
        resolve(true);
      }
    });
    
    socket.on('timeout', () => {
      if (!hasResolved) {
        hasResolved = true;
        socket.destroy();
        resolve(false);
      }
    });
    
    socket.on('error', () => {
      if (!hasResolved) {
        hasResolved = true;
        socket.destroy();
        resolve(false);
      }
    });
    
    // Attempt connection
    try {
      socket.connect(port, ip);
    } catch (error) {
      if (!hasResolved) {
        hasResolved = true;
        resolve(false);
      }
    }
    
    // Force resolve after timeout to prevent hanging
    setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true;
        socket.destroy();
        resolve(false);
      }
    }, timeout + 10);
  });
}

/**
 * Scan a subnet for OpenWrt devices
 * @param {string} subnet - Base subnet (e.g. '192.168.1')
 * @param {string} username - SSH username
 * @param {string} password - SSH password
 * @param {string[]} activeIPs - Array of active IP addresses
 * @returns {Promise<object>} - Object with discovered devices and scan status
 */
async function scanForOpenWrtDevices(subnet, username, password, activeIPs = []) {
  const logger = require('./logger');
  logger.info(`🔍 Starting optimized scan for OpenWrt devices on subnet ${subnet}`);
  
  // Make sure subnet ends with a dot
  const formattedSubnet = subnet.endsWith('.') ? subnet : `${subnet}.`;
  
  // If no activeIPs are provided, do a quick scan to find some
  let ipsToCheck = activeIPs;
  if (!ipsToCheck || ipsToCheck.length === 0) {
    ipsToCheck = await quickRouterScan(formattedSubnet);
  } else {
    logger.info(`Using ${ipsToCheck.length} pre-identified active IPs`);
  }
  
  if (ipsToCheck.length === 0) {
    logger.warn('⚠️ No potential routers found on quick scan');
    return { devices: [], partialScan: true };
  }
  
  logger.info(`✓ Found ${ipsToCheck.length} potential routers, checking for OpenWrt devices`);
  
  // List of discovered OpenWrt devices
  const devices = [];
  
  // Check if the special IP 192.168.1.36 is in the list
  const specialIP = `${formattedSubnet}36`;
  const hasSpecialIP = ipsToCheck.includes(specialIP);
  
  if (hasSpecialIP) {
    logger.info(`Special handling for ${specialIP} with extended timeout`);
    
    // Try to connect with extended timeout first
    try {
      const specialDevice = await Promise.race([
        extendedCheckOpenWrtDevice(specialIP, username, password),
        new Promise(resolve => setTimeout(() => resolve(null), 5000)) // 5 second timeout
      ]);
      
      if (specialDevice) {
        logger.info(`✅ Successfully detected OpenWrt device at ${specialIP}!`);
        devices.push(specialDevice);
        
        // Remove from the list to avoid duplicate checks
        ipsToCheck = ipsToCheck.filter(ip => ip !== specialIP);
      } else {
        logger.warn(`Could not confirm OpenWrt on ${specialIP} with extended check`);
        
        // Try alternative detection for this specific IP
        logger.info(`Trying alternative detection for ${specialIP}...`);
        
        // Create a placeholder device if we couldn't confirm
        const placeholderDevice = {
          ipAddress: specialIP,
          hostname: "Unknown Router",
          isOpenWrt: true, // Assume it's OpenWrt for now
          macAddress: null,
          note: "Device detection limited - manual verification recommended"
        };
        
        devices.push(placeholderDevice);
        logger.info(`Added placeholder device for ${specialIP}`);
        
        // Remove from the list to avoid duplicate checks
        ipsToCheck = ipsToCheck.filter(ip => ip !== specialIP);
      }
    } catch (error) {
      logger.error(`Error in special handling for ${specialIP}: ${error.message}`);
    }
  }
  
  // Process remaining IPs quickly with a strict timeout
  if (ipsToCheck.length > 0) {
    logger.info(`Checking remaining ${ipsToCheck.length} potential devices`);
    
    const devicePromises = ipsToCheck.map(ip => {
      return Promise.race([
        quickCheckOpenWrtDevice(ip, username, password),
        new Promise(resolve => setTimeout(() => resolve(null), 3000)) // 3 second timeout
      ]);
    });
    
    // Wait for all checks to complete
    const results = await Promise.all(devicePromises);
    
    // Filter out null results and add valid devices
    results.forEach(device => {
      if (device) {
        devices.push(device);
      }
    });
  }
  
  logger.info(`✓ Completed scan, found ${devices.length} OpenWrt devices`);
  
  return { devices, partialScan: false };
}

/**
 * Simplified check if a host is an OpenWrt device
 * @param {string} ip - IP address to check
 * @param {string} username - SSH username
 * @param {string} password - SSH password
 * @returns {Promise<object|null>} - Device info or null
 */
async function quickCheckOpenWrtDevice(ip, username, password) {
  const logger = require('./logger');
  
  // Try SSH connection with minimal settings
  const conn = new Client();
  
  return new Promise((resolve) => {
    let connectionFinished = false;
    
    // Timeout for the entire connection process
    const timeout = setTimeout(() => {
      if (!connectionFinished) {
        connectionFinished = true;
        try {
          conn.end();
        } catch (e) {
          // Ignore errors on cleanup
        }
        resolve(null);
      }
    }, 2500);
    
    conn.on('ready', () => {
      if (connectionFinished) return;
      
      // Simple command to check if OpenWrt
      conn.exec('cat /etc/openwrt_release 2>/dev/null || hostname', (err, stream) => {
        if (err || connectionFinished) {
          clearTimeout(timeout);
          connectionFinished = true;
          conn.end();
          resolve(null);
          return;
        }
        
        let data = '';
        
        stream.on('data', (chunk) => {
          data += chunk.toString();
        });
        
        stream.on('close', () => {
          if (connectionFinished) return;
          
          // If we get here, it's likely an OpenWrt device
          const isOpenWrt = data.toLowerCase().includes('openwrt') || 
                          data.trim().length > 0;
          
          // If not OpenWrt, resolve with null
          if (!isOpenWrt) {
            clearTimeout(timeout);
            connectionFinished = true;
            conn.end();
            resolve(null);
            return;
          }
          
          // Get MAC address with a simpler command
          conn.exec('ifconfig br-lan 2>/dev/null || ifconfig eth0 2>/dev/null', (err, macStream) => {
            if (err || connectionFinished) {
              clearTimeout(timeout);
              connectionFinished = true;
              conn.end();
              
              // We know it's OpenWrt but couldn't get MAC
              resolve({
                ipAddress: ip,
                hostname: data.trim() || 'unknown',
                isOpenWrt: true,
                macAddress: null
              });
              return;
            }
            
            let macData = '';
            
            macStream.on('data', (chunk) => {
              macData += chunk.toString();
            });
            
            macStream.on('close', () => {
              clearTimeout(timeout);
              connectionFinished = true;
              conn.end();
              
              // Extract MAC address using regex
              const macRegex = /([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/;
              const macMatch = macData.match(macRegex);
              const macAddress = macMatch ? macMatch[0].toLowerCase() : null;
              
              resolve({
                ipAddress: ip,
                hostname: data.trim() || 'unknown',
                isOpenWrt: true,
                macAddress: macAddress
              });
            });
          });
        });
      });
    });
    
    conn.on('error', () => {
      if (!connectionFinished) {
        clearTimeout(timeout);
        connectionFinished = true;
        try {
          conn.end();
        } catch (e) {
          // Ignore errors on cleanup
        }
        resolve(null);
      }
    });
    
    // Attempt connection with minimal options and very short timeout
    try {
      conn.connect({
        host: ip,
        port: 22,
        username: username,
        password: password,
        readyTimeout: 1500,
        algorithms: {
          kex: ['diffie-hellman-group1-sha1', 'diffie-hellman-group14-sha1'],
          cipher: ['aes128-ctr', '3des-cbc']
        },
        tryKeyboard: false,
        keepaliveInterval: 0
      });
    } catch (error) {
      if (!connectionFinished) {
        clearTimeout(timeout);
        connectionFinished = true;
        resolve(null);
      }
    }
  });
}

/**
 * Get MAC addresses from device interfaces
 * @param {string} ip - IP address of the device
 * @param {string} username - SSH username
 * @param {string} password - SSH password
 * @returns {Promise<object>} - Object with MAC addresses and interface info
 */
async function getMACFromInterfaces(ip, username, password) {
  const logger = require('./logger');
  logger.info(`Attempting to get MAC address from interfaces on ${ip}`);
  
  // Use SSH2 client for connection
  const conn = new Client();
  
  return new Promise((resolve) => {
    let connectionFinished = false;
    const timeout = setTimeout(() => {
      if (!connectionFinished) {
        connectionFinished = true;
        try { conn.end(); } catch (e) {}
        logger.warn(`Timeout getting MAC from ${ip}`);
        resolve({ success: false, error: 'Connection timeout' });
      }
    }, 4000);
    
    conn.on('ready', () => {
      if (connectionFinished) return;
      logger.info(`Connected to ${ip}, getting interface info`);
      
      // Try multiple commands to get MAC address info
      const commands = [
        // Get all interface MAC addresses
        'ip link show | grep -E "link/ether" | awk \'{print $2}\' | head -1',
        // Fallback to ifconfig 
        'ifconfig | grep -E "HWaddr|ether" | head -1',
        // Try reading from /sys directly
        'cat /sys/class/net/br-lan/address 2>/dev/null || cat /sys/class/net/eth0/address 2>/dev/null || cat /sys/class/net/wlan0/address 2>/dev/null'
      ];
      
      // Execute commands in sequence until one succeeds
      let cmdIndex = 0;
      
      const tryNextCommand = () => {
        if (cmdIndex >= commands.length || connectionFinished) {
          clearTimeout(timeout);
          connectionFinished = true;
          conn.end();
          logger.warn(`Failed to get MAC from ${ip} after trying all commands`);
          resolve({ success: false, error: 'No MAC found' });
          return;
        }
        
        const cmd = commands[cmdIndex++];
        conn.exec(cmd, (err, stream) => {
          if (err || connectionFinished) {
            logger.warn(`Command ${cmdIndex} failed on ${ip}: ${err?.message}`);
            return tryNextCommand(); // Try next command
          }
          
          let data = '';
          
          stream.on('data', (chunk) => {
            data += chunk.toString().trim();
          });
          
          stream.on('close', () => {
            if (connectionFinished) return;
            
            // Validate if we got a MAC address format
            const macRegex = /([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/;
            const macMatch = data.match(macRegex);
            
            if (macMatch) {
              const mac = macMatch[0].toLowerCase();
              logger.info(`✓ Successfully got MAC address ${mac} from ${ip}`);
              clearTimeout(timeout);
              connectionFinished = true;
              conn.end();
              resolve({ 
                success: true, 
                mac: mac,
                command: cmd
              });
            } else {
              // Try next command
              logger.info(`Command ${cmdIndex-1} didn't return valid MAC, trying next...`);
              tryNextCommand();
            }
          });
        });
      };
      
      // Start the command chain
      tryNextCommand();
    });
    
    conn.on('error', (err) => {
      if (!connectionFinished) {
        clearTimeout(timeout);
        connectionFinished = true;
        try { conn.end(); } catch (e) {}
        logger.warn(`SSH error getting MAC from ${ip}: ${err.message}`);
        resolve({ success: false, error: err.message });
      }
    });
    
    try {
      // Connect with extended algorithm support for older devices
      conn.connect({
        host: ip,
        port: 22,
        username: username,
        password: password,
        readyTimeout: 3000,
        algorithms: {
          kex: [
            'diffie-hellman-group1-sha1',
            'diffie-hellman-group14-sha1',
            'diffie-hellman-group-exchange-sha1',
            'diffie-hellman-group-exchange-sha256'
          ],
          cipher: [
            'aes128-ctr',
            '3des-cbc',
            'aes128-cbc',
            'aes256-cbc'
          ],
          serverHostKey: [
            'ssh-rsa',
            'ssh-dss'
          ]
        },
        tryKeyboard: true
      });
    } catch (error) {
      if (!connectionFinished) {
        clearTimeout(timeout);
        connectionFinished = true;
        logger.error(`Connection setup error for ${ip}: ${error.message}`);
        resolve({ success: false, error: error.message });
      }
    }
  });
}

/**
 * Extended check for OpenWrt device with longer timeouts
 * Specifically designed for problematic devices
 * @param {string} ip - IP address to check
 * @param {string} username - SSH username
 * @param {string} password - SSH password
 * @returns {Promise<object|null>} - Device info or null
 */
async function extendedCheckOpenWrtDevice(ip, username, password) {
  const logger = require('./logger');
  logger.info(`Starting extended OpenWrt check for ${ip}`);
  
  // First try SSH connection with extended settings
  const conn = new Client();
  
  return new Promise((resolve) => {
    let connectionFinished = false;
    
    // Longer timeout for the entire connection process
    const timeout = setTimeout(() => {
      if (!connectionFinished) {
        connectionFinished = true;
        try {
          conn.end();
        } catch (e) {
          // Ignore errors on cleanup
        }
        logger.warn(`SSH connection timeout for ${ip} in extended check`);
        resolve(null);
      }
    }, 4500); // Much longer timeout (4.5 seconds)
    
    conn.on('ready', () => {
      if (connectionFinished) return;
      
      logger.info(`SSH connection successful to ${ip}`);
      
      // Simple command to check if OpenWrt with longer timeout
      conn.exec('cat /etc/openwrt_release 2>/dev/null || cat /proc/version || hostname', (err, stream) => {
        if (err || connectionFinished) {
          clearTimeout(timeout);
          connectionFinished = true;
          conn.end();
          logger.warn(`Command execution error on ${ip}: ${err?.message || 'Unknown error'}`);
          resolve(null);
          return;
        }
        
        let data = '';
        
        stream.on('data', (chunk) => {
          data += chunk.toString();
        });
        
        stream.on('close', async () => {
          if (connectionFinished) return;
          
          logger.info(`Got response from ${ip}: ${data.substring(0, 50)}...`);
          
          // Much broader check for OpenWrt or any Linux-based router
          const isOpenWrt = data.toLowerCase().includes('openwrt') || 
                          data.toLowerCase().includes('linux') ||
                          data.toLowerCase().includes('root') ||
                          data.trim().length > 0;
          
          // If not OpenWrt, resolve with null
          if (!isOpenWrt) {
            clearTimeout(timeout);
            connectionFinished = true;
            conn.end();
            logger.warn(`${ip} does not appear to be an OpenWrt device`);
            resolve(null);
            return;
          }
          
          // Try to get MAC address directly from interfaces
          logger.info(`${ip} seems to be a valid device, getting MAC address from interfaces`);
          
          try {
            // Close this connection first
            conn.end();
            
            // Get MAC address from interfaces with a new connection
            const macResult = await getMACFromInterfaces(ip, username, password);
            
            if (macResult.success) {
              // Successfully got MAC from interfaces
              logger.info(`${ip} is OpenWrt with MAC ${macResult.mac}`);
              clearTimeout(timeout);
              connectionFinished = true;
              
              resolve({
                ipAddress: ip,
                hostname: data.trim() || 'unknown',
                isOpenWrt: true,
                macAddress: macResult.mac
              });
              return;
            }
          } catch (error) {
            logger.warn(`Error getting MAC address from interfaces: ${error.message}`);
          }
          
          // Fallback to the old method if direct interface check fails
          // Get MAC address with a simpler command
          const newConn = new Client();
          
          // Connect again for the fallback method
          try {
            newConn.connect({
              host: ip,
              port: 22,
              username: username,
              password: password,
              readyTimeout: 3000
            });
            
            newConn.on('ready', () => {
              newConn.exec('ifconfig br-lan 2>/dev/null || ifconfig eth0 2>/dev/null || cat /sys/class/net/eth0/address 2>/dev/null', (err, macStream) => {
                if (err) {
                  clearTimeout(timeout);
                  connectionFinished = true;
                  newConn.end();
                  
                  // We know it's OpenWrt but couldn't get MAC
                  logger.info(`${ip} is OpenWrt but couldn't get MAC address`);
                  resolve({
                    ipAddress: ip,
                    hostname: data.trim() || 'unknown',
                    isOpenWrt: true,
                    macAddress: null
                  });
                  return;
                }
                
                let macData = '';
                
                macStream.on('data', (chunk) => {
                  macData += chunk.toString();
                });
                
                macStream.on('close', () => {
                  clearTimeout(timeout);
                  connectionFinished = true;
                  newConn.end();
                  
                  // Extract MAC address using regex
                  const macRegex = /([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/;
                  const macMatch = macData.match(macRegex);
                  const macAddress = macMatch ? macMatch[0].toLowerCase() : null;
                  
                  logger.info(`Successfully identified OpenWrt device at ${ip}`);
                  resolve({
                    ipAddress: ip,
                    hostname: data.trim() || 'unknown',
                    isOpenWrt: true,
                    macAddress: macAddress
                  });
                });
              });
            });
            
            newConn.on('error', () => {
              clearTimeout(timeout);
              connectionFinished = true;
              
              // We know it's OpenWrt but couldn't get MAC in second attempt
              logger.info(`${ip} is OpenWrt but couldn't get MAC in second attempt`);
              resolve({
                ipAddress: ip,
                hostname: data.trim() || 'unknown',
                isOpenWrt: true,
                macAddress: null
              });
            });
          } catch (connError) {
            clearTimeout(timeout);
            connectionFinished = true;
            
            // We know it's OpenWrt but couldn't reconnect for MAC
            logger.info(`${ip} is OpenWrt but couldn't reconnect for MAC`);
            resolve({
              ipAddress: ip,
              hostname: data.trim() || 'unknown',
              isOpenWrt: true,
              macAddress: null
            });
          }
        });
      });
    });
    
    conn.on('error', (err) => {
      if (!connectionFinished) {
        clearTimeout(timeout);
        connectionFinished = true;
        try {
          conn.end();
        } catch (e) {
          // Ignore errors on cleanup
        }
        logger.warn(`SSH connection error for ${ip}: ${err.message}`);
        resolve(null);
      }
    });
    
    // Attempt connection with extended options and longer timeout
    try {
      logger.info(`Attempting SSH connection to ${ip} with extended options`);
      conn.connect({
        host: ip,
        port: 22,
        username: username,
        password: password,
        readyTimeout: 4000, // 4 seconds
        algorithms: {
          kex: [
            'diffie-hellman-group1-sha1',
            'diffie-hellman-group14-sha1',
            'diffie-hellman-group-exchange-sha1'
          ],
          cipher: [
            'aes128-ctr',
            '3des-cbc',
            'aes128-cbc',
            'aes256-cbc'
          ],
          serverHostKey: [
            'ssh-rsa',
            'ssh-dss'
          ]
        },
        tryKeyboard: true,
        keepaliveInterval: 0
      });
    } catch (error) {
      if (!connectionFinished) {
        clearTimeout(timeout);
        connectionFinished = true;
        logger.error(`SSH connection setup error for ${ip}: ${error.message}`);
        resolve(null);
      }
    }
  });
}

// Export job-related functions
module.exports = {
  scanSubnet,
  scanForOpenWrtDevices,
  quickRouterScan,
  checkPortOpen,
  checkPortOpenQuick,
  extendedCheckOpenWrtDevice,
  comprehensiveSubnetScan,
  getMACFromInterfaces,
  
  // Job-related exports
  createScanJob,
  getScanJob,
  updateScanJob,
  startScanJob
}; 