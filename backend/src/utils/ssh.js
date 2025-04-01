const { NodeSSH } = require('node-ssh');
const logger = require('./logger');
const net = require('net');

// Create a new SSH client with improved robustness
const createSSHClient = async (router) => {
  const ssh = new NodeSSH();
  
  try {
    logger.info(`Attempting SSH connection to router at ${router.ipAddress || router.hostname}`);
    
    // Connection options with extended algorithms for compatibility with older devices
    const sshOptions = {
      host: router.ipAddress || router.hostname,
      port: router.port || 22,
      username: router.username,
      password: router.password,
      // Longer timeout for slow networks
      readyTimeout: 8000,
      // Support older algorithms for better compatibility
      algorithms: {
        kex: [
          'diffie-hellman-group1-sha1',
          'diffie-hellman-group14-sha1',
          'diffie-hellman-group-exchange-sha1',
          'diffie-hellman-group-exchange-sha256',
          'ecdh-sha2-nistp256',
          'ecdh-sha2-nistp384',
          'ecdh-sha2-nistp521',
          'curve25519-sha256'
        ],
        cipher: [
          'aes128-ctr',
          'aes192-ctr',
          'aes256-ctr',
          'aes128-gcm',
          'aes256-gcm',
          'aes128-cbc',
          'aes192-cbc',
          'aes256-cbc',
          '3des-cbc',
          'blowfish-cbc',
          'arcfour256',
          'arcfour128',
          'cast128-cbc',
          'arcfour'
        ],
        serverHostKey: [
          'ssh-rsa',
          'ssh-dss',
          'ecdsa-sha2-nistp256',
          'ecdsa-sha2-nistp384',
          'ecdsa-sha2-nistp521'
        ],
        hmac: [
          'hmac-sha2-256',
          'hmac-sha2-512',
          'hmac-sha1',
          'hmac-md5',
          'hmac-sha2-256-96',
          'hmac-sha2-512-96',
          'hmac-sha1-96',
          'hmac-md5-96'
        ]
      }
    };
    
    // Use SSH key if available
    if (router.sshKey) {
      sshOptions.privateKey = router.sshKey;
      delete sshOptions.password;
    }
    
    logger.info(`Connecting to ${sshOptions.host} with user ${sshOptions.username}`);
    
    // Connect to the router
    await ssh.connect(sshOptions);
    logger.info(`Successfully connected to ${sshOptions.host}`);
    
    return ssh;
  } catch (error) {
    logger.error(`SSH connection error for router ${router.ipAddress}: ${error.message}`);
    return null;
  }
};

// Test if a port is open using direct socket connection
exports.checkPortOpen = async (host, port, timeoutMs = 2000) => {
  logger.info(`Testing if port ${port} is open on ${host} with timeout ${timeoutMs}ms`);
  
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;
    
    socket.setTimeout(timeoutMs);
    
    socket.on('connect', () => {
      if (!resolved) {
        resolved = true;
        logger.info(`✓ Port ${port} is open on ${host}`);
        socket.destroy();
        resolve(true);
      }
    });
    
    socket.on('timeout', () => {
      if (!resolved) {
        resolved = true;
        logger.warn(`Timeout connecting to ${host}:${port}`);
        socket.destroy();
        resolve(false);
      }
    });
    
    socket.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        logger.warn(`Error connecting to ${host}:${port}: ${err.message}`);
        socket.destroy();
        resolve(false);
      }
    });
    
    logger.info(`Attempting to connect to ${host}:${port}`);
    socket.connect(port, host);
  });
};

// Test the SSH connection with improved error handling
exports.testConnection = async (router) => {
  logger.info(`Testing connection to router ${router.name} (${router.ipAddress})`);
  
  if (!router.ipAddress) {
    logger.error(`Missing IP address for router ${router.name}`);
    return false;
  }
  
  try {
    // First try a direct socket connection to port 22
    const portOpen = await exports.checkPortOpen(router.ipAddress, 22);
    
    if (!portOpen) {
      logger.warn(`Port 22 is not open on ${router.ipAddress}. Device may be offline or firewall is blocking SSH.`);
      return false;
    }
    
    logger.info(`Port 22 is open on ${router.ipAddress}. Attempting SSH handshake.`);
    
    const ssh = await createSSHClient(router);
    
    if (!ssh) {
      logger.error(`Could not establish SSH connection to ${router.ipAddress}`);
      // If direct socket connection was successful but SSH handshake failed,
      // the device might be reachable but using a non-standard SSH configuration
      logger.info(`Device at ${router.ipAddress} may be reachable but SSH handshake failed. Marking as online but with limited functionality.`);
      return true; // Mark as online since we could reach the device
    }
    
    // Execute multiple simple commands to test the connection
    // We try several because some commands might not be available on all devices
    let success = false;
    
    try {
      // Try a very basic echo command first
      const echoResult = await ssh.execCommand('echo "Connection test"');
      if (echoResult.code === 0) {
        logger.info(`Echo test successful for ${router.ipAddress}`);
        success = true;
      }
    } catch (err) {
      logger.warn(`Echo test failed for ${router.ipAddress}: ${err.message}`);
    }
    
    // If echo didn't work, try hostname
    if (!success) {
      try {
        const hostnameResult = await ssh.execCommand('hostname');
        if (hostnameResult.code === 0) {
          logger.info(`Hostname test successful for ${router.ipAddress}`);
          success = true;
        }
      } catch (err) {
        logger.warn(`Hostname test failed for ${router.ipAddress}: ${err.message}`);
      }
    }
    
    // If hostname didn't work, try cat /proc/version
    if (!success) {
      try {
        const versionResult = await ssh.execCommand('cat /proc/version');
        if (versionResult.code === 0) {
          logger.info(`Version test successful for ${router.ipAddress}`);
          success = true;
        }
      } catch (err) {
        logger.warn(`Version test failed for ${router.ipAddress}: ${err.message}`);
      }
    }
    
    // Disconnect
    ssh.dispose();
    logger.info(`Connection test for ${router.ipAddress}: ${success ? 'SUCCESS' : 'FAILED'}`);
    
    return success || portOpen; // Return true if either the command test or port test succeeded
  } catch (error) {
    logger.error(`Connection test error for router ${router.name}: ${error.message}`);
    return false;
  }
};

// Collect metrics from a router
exports.collectMetrics = async (router) => {
  try {
    const logger = require('./logger');
    logger.info(`Collecting metrics for router ${router.name} (${router.ipAddress})`);
    
    // First, check if the device is reachable
    const portOpen = await exports.checkPortOpen(router.ipAddress, 22);
    if (!portOpen) {
      logger.warn(`Router ${router.ipAddress} is not reachable - SSH port closed`);
      return {
        error: 'Device not reachable',
        uptime: null,
        memoryUsage: { total: 0, free: 0, used: 0, percentage: 0 },
        cpuLoad: 0,
        diskUsage: { total: 0, free: 0, used: 0, percentage: 0 },
        networkInterfaces: [],
        wirelessClients: 0
      };
    }
    
    // Try to establish SSH connection
    const ssh = await createSSHClient(router);
    
    if (!ssh) {
      logger.warn(`Failed to establish SSH connection to router ${router.ipAddress}`);
      return {
        error: 'SSH connection failed',
        uptime: null,
        memoryUsage: { total: 0, free: 0, used: 0, percentage: 0 },
        cpuLoad: 0,
        diskUsage: { total: 0, free: 0, used: 0, percentage: 0 },
        networkInterfaces: [],
        wirelessClients: 0
      };
    }
    
    logger.info(`SSH connection successful for metrics collection on ${router.ipAddress}`);
    
    // Collect each metric individually with error handling
    let results = {};
    
    try {
      results.uptime = await collectUptime(ssh);
      logger.info(`Collected uptime from ${router.ipAddress}: ${results.uptime}`);
    } catch (err) {
      logger.error(`Error collecting uptime: ${err.message}`);
      results.uptime = null;
    }
    
    try {
      results.memoryUsage = await collectMemoryInfo(ssh);
      logger.info(`Collected memory info from ${router.ipAddress}: ${JSON.stringify(results.memoryUsage)}`);
    } catch (err) {
      logger.error(`Error collecting memory info: ${err.message}`);
      results.memoryUsage = { total: 0, free: 0, used: 0, percentage: 0 };
    }
    
    try {
      results.cpuLoad = await collectCpuLoad(ssh);
      logger.info(`Collected CPU load from ${router.ipAddress}: ${results.cpuLoad}`);
    } catch (err) {
      logger.error(`Error collecting CPU load: ${err.message}`);
      results.cpuLoad = 0;
    }
    
    try {
      results.diskUsage = await collectDiskUsage(ssh);
      logger.info(`Collected disk usage from ${router.ipAddress}: ${JSON.stringify(results.diskUsage)}`);
    } catch (err) {
      logger.error(`Error collecting disk usage: ${err.message}`);
      results.diskUsage = { total: 0, free: 0, used: 0, percentage: 0 };
    }
    
    try {
      results.networkInterfaces = await collectNetworkInfo(ssh);
      logger.info(`Collected network info from ${router.ipAddress}: ${results.networkInterfaces.length} interfaces`);
    } catch (err) {
      logger.error(`Error collecting network interfaces: ${err.message}`);
      results.networkInterfaces = [];
    }
    
    try {
      results.wirelessClients = await collectWirelessInfo(ssh);
      logger.info(`Collected wireless clients from ${router.ipAddress}: ${results.wirelessClients}`);
    } catch (err) {
      logger.error(`Error collecting wireless clients: ${err.message}`);
      results.wirelessClients = 0;
    }
    
    // Disconnect
    ssh.dispose();
    logger.info(`Successfully collected all available metrics from ${router.ipAddress}`);
    
    return results;
  } catch (error) {
    logger.error(`Error collecting metrics for router ${router.name}: ${error.message}`);
    // Return a default structure with empty values rather than null
    return {
      error: error.message,
      uptime: null,
      memoryUsage: { total: 0, free: 0, used: 0, percentage: 0 },
      cpuLoad: 0,
      diskUsage: { total: 0, free: 0, used: 0, percentage: 0 },
      networkInterfaces: [],
      wirelessClients: 0
    };
  }
};

// Helper functions to collect specific metrics

// Collect uptime
const collectUptime = async (ssh) => {
  try {
    const result = await ssh.execCommand('uptime');
    return result.stdout.trim();
  } catch (error) {
    logger.error(`Error collecting uptime: ${error.message}`);
    return null;
  }
};

// Collect memory information
const collectMemoryInfo = async (ssh) => {
  try {
    // Try standard Linux memory info command
    const result = await ssh.execCommand('cat /proc/meminfo');
    
    if (result.stderr) {
      throw new Error(result.stderr);
    }
    
    if (result.stdout) {
      // Regular Linux format parsing
      const memTotal = parseInt(result.stdout.match(/MemTotal:\s+(\d+)/)?.[1] || 0);
      const memFree = parseInt(result.stdout.match(/MemFree:\s+(\d+)/)?.[1] || 0);
      const memAvailable = parseInt(result.stdout.match(/MemAvailable:\s+(\d+)/)?.[1] || 0);
      const buffers = parseInt(result.stdout.match(/Buffers:\s+(\d+)/)?.[1] || 0);
      const cached = parseInt(result.stdout.match(/Cached:\s+(\d+)/)?.[1] || 0);
      
      // Use MemAvailable if present, otherwise calculate based on free + buffers + cached
      const effectiveFree = memAvailable || (memFree + buffers + cached);
      const used = memTotal - effectiveFree;
      const percentage = Math.round((used / memTotal) * 100) || 0;
      
      return {
        total: memTotal,
        free: effectiveFree,
        used: used,
        percentage: percentage
      };
    }
    
    // If standard command failed or returned empty, try alternative methods
    // Try 'free' command as fallback
    const freeResult = await ssh.execCommand('free | grep Mem');
    if (freeResult.stdout && !freeResult.stderr) {
      const parts = freeResult.stdout.trim().split(/\s+/);
      if (parts.length >= 3) {
        // Format varies but we typically need the 2nd value (total) and 4th (free)
        const total = parseInt(parts[1]);
        const free = parseInt(parts[3]);
        const used = total - free;
        const percentage = Math.round((used / total) * 100) || 0;
        
        return {
          total: total,
          free: free,
          used: used,
          percentage: percentage
        };
      }
    }
    
    // Final fallback if nothing works
    return {
      total: 0,
      free: 0, 
      used: 0,
      percentage: 0
    };
  } catch (error) {
    logger.error(`Error in collectMemoryInfo: ${error.message}`);
    return {
      total: 0,
      free: 0,
      used: 0,
      percentage: 0
    };
  }
};

// Collect CPU load
const collectCpuLoad = async (ssh) => {
  const logger = require('./logger');
  try {
    // Try standard Linux load average
    const loadResult = await ssh.execCommand('cat /proc/loadavg');
    if (loadResult.stdout && !loadResult.stderr) {
      const loadParts = loadResult.stdout.trim().split(' ');
      if (loadParts.length >= 1) {
        // Use 1-minute load average
        const loadAvg = parseFloat(loadParts[0]);
        return loadAvg;
      }
    }
    
    // Try alternative method - use uptime command
    const uptimeResult = await ssh.execCommand('uptime');
    if (uptimeResult.stdout && !uptimeResult.stderr) {
      // Extract load average from uptime output
      const loadMatch = uptimeResult.stdout.match(/load average: ([0-9.]+)/);
      if (loadMatch && loadMatch[1]) {
        return parseFloat(loadMatch[1]);
      }
    }
    
    // Try another alternative - CPU usage percentage
    const cpuUsageResult = await ssh.execCommand("top -bn1 | grep '%Cpu' | awk '{print $2}'");
    if (cpuUsageResult.stdout && !cpuUsageResult.stderr) {
      const cpuUsage = parseFloat(cpuUsageResult.stdout.trim());
      if (!isNaN(cpuUsage)) {
        // Convert percentage to a load-like number (0-100 to 0-1)
        return cpuUsage / 100;
      }
    }
    
    // One more attempt with a different format of top
    const topResult = await ssh.execCommand("top -bn1 | head -n 3");
    if (topResult.stdout) {
      // Try to find CPU usage information in the output
      const cpuLine = topResult.stdout.split('\n').find(line => line.includes('Cpu'));
      if (cpuLine) {
        const usageMatch = cpuLine.match(/([0-9.]+)\s*%us/);
        if (usageMatch && usageMatch[1]) {
          return parseFloat(usageMatch[1]) / 100;
        }
      }
    }
    
    logger.warn('All CPU load collection methods failed, returning 0');
    return 0;
  } catch (error) {
    logger.error(`Error in collectCpuLoad: ${error.message}`);
    return 0;
  }
};

// Collect disk usage
const collectDiskUsage = async (ssh) => {
  try {
    const result = await ssh.execCommand('df -h / | tail -n 1');
    
    if (result.code !== 0) {
      return {
        total: 0,
        free: 0,
        used: 0,
        percentage: 0
      };
    }
    
    // Parse the output
    const parts = result.stdout.trim().split(/\s+/);
    
    // Format: Filesystem Size Used Avail Use% Mounted on
    const total = parts[1];
    const used = parts[2];
    const free = parts[3];
    const percentageStr = parts[4].replace('%', '');
    const percentage = parseInt(percentageStr);
    
    // Convert size strings like '98.3M' to bytes
    const convertToBytes = (sizeStr) => {
      if (!sizeStr) return 0;
      
      // Remove any non-numeric characters at the end for parsing
      const numericPart = parseFloat(sizeStr.replace(/[^0-9.]/g, ''));
      const unit = sizeStr.replace(/[0-9.]/g, '').toUpperCase();
      
      if (isNaN(numericPart)) return 0;
      
      switch (unit) {
        case 'K':
        case 'KB':
          return Math.round(numericPart * 1024);
        case 'M':
        case 'MB':
          return Math.round(numericPart * 1024 * 1024);
        case 'G':
        case 'GB':
          return Math.round(numericPart * 1024 * 1024 * 1024);
        case 'T':
        case 'TB':
          return Math.round(numericPart * 1024 * 1024 * 1024 * 1024);
        default:
          return Math.round(numericPart);
      }
    };
    
    return {
      total: convertToBytes(total),
      free: convertToBytes(free),
      used: convertToBytes(used),
      percentage,
      totalRaw: total, // Keep original value for display
      freeRaw: free,
      usedRaw: used
    };
  } catch (error) {
    logger.error(`Error collecting disk usage: ${error.message}`);
    return {
      total: 0,
      free: 0,
      used: 0,
      percentage: 0
    };
  }
};

// Collect network interface information
const collectNetworkInfo = async (ssh) => {
  try {
    // Get network interfaces from ifconfig
    const ifconfigResult = await ssh.execCommand('ifconfig');
    
    if (ifconfigResult.code !== 0) {
      return [];
    }
    
    // Parse interfaces
    const interfaces = [];
    const ifBlocks = ifconfigResult.stdout.split('\n\n');
    
    for (const block of ifBlocks) {
      if (!block.trim()) continue;
      
      const lines = block.split('\n');
      if (lines.length === 0) continue;
      
      const ifNameParts = lines[0].split(' ');
      if (ifNameParts.length === 0) continue;
      
      const ifName = ifNameParts[0].split(':')[0].trim();
      
      let ipAddress = '';
      let macAddress = '';
      let rxBytes = 0;
      let txBytes = 0;
      let status = 'up'; // Assuming up if it appears in ifconfig
      
      // Extract IP and MAC addresses
      for (const line of lines) {
        // Enhanced IP address detection - IPv4
        const ipv4Formats = [
          /inet\s+addr:?(\d+\.\d+\.\d+\.\d+)/i,             // inet addr:192.168.1.1
          /inet\s+(\d+\.\d+\.\d+\.\d+)/i,                   // inet 192.168.1.1
          /ipv4\s+address:\s+(\d+\.\d+\.\d+\.\d+)/i,        // ipv4 address: 192.168.1.1
          /address:\s+(\d+\.\d+\.\d+\.\d+)/i,               // address: 192.168.1.1
          /ip\s+(\d+\.\d+\.\d+\.\d+)/i                      // ip 192.168.1.1
        ];
        
        for (const regex of ipv4Formats) {
          const match = line.match(regex);
          if (match && match.length > 1) {
            ipAddress = match[1];
            break;
          }
        }
        
        // More comprehensive regex for MAC address matching - supports multiple formats
        const macFormats = [
          /ether\s+([0-9a-f:]{17})/i,                 // ether 00:11:22:33:44:55
          /HWaddr\s+([0-9a-f:]{17})/i,                // HWaddr 00:11:22:33:44:55
          /link\/ether\s+([0-9a-f:]{17})/i,           // link/ether 00:11:22:33:44:55
          /address:\s+([0-9a-f:]{17})/i,              // address: 00:11:22:33:44:55
          /([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/i  // Just the MAC format
        ];
        
        for (const regex of macFormats) {
          const match = line.match(regex);
          if (match && match.length > 1) {
            macAddress = match[1].toLowerCase();
            break;
          }
        }
        
        // Extract RX bytes
        if (line.includes('RX packets') || line.includes('RX bytes')) {
          const rxMatch = line.match(/RX\s+bytes[:=]\s*(\d+)/);
          if (rxMatch && rxMatch.length > 1) rxBytes = parseInt(rxMatch[1]);
        }
        
        // Extract TX bytes
        if (line.includes('TX packets') || line.includes('TX bytes')) {
          const txMatch = line.match(/TX\s+bytes[:=]\s*(\d+)/);
          if (txMatch && txMatch.length > 1) txBytes = parseInt(txMatch[1]);
        }
        
        // Check for interface status
        if (line.toLowerCase().includes('status')) {
          if (line.toLowerCase().includes('down')) {
            status = 'down';
          }
        }
      }
      
      // For interfaces without a MAC from ifconfig, we'll try another method
      if (!macAddress) {
        // Try to get MAC from /sys/class/net
        const macResult = await ssh.execCommand(`cat /sys/class/net/${ifName}/address 2>/dev/null || echo ""`);
        if (macResult.code === 0 && macResult.stdout.trim()) {
          macAddress = macResult.stdout.trim();
        }
      }
      
      // For interfaces without an IP from ifconfig, try other methods
      if (!ipAddress) {
        // Try to get IP using ip command
        const ipResult = await ssh.execCommand(`ip addr show ${ifName} | grep -oE 'inet ([0-9]{1,3}[\.]){3}[0-9]{1,3}' | cut -d' ' -f2 2>/dev/null || echo ""`);
        if (ipResult.code === 0 && ipResult.stdout.trim()) {
          ipAddress = ipResult.stdout.trim();
        }
      }
      
      interfaces.push({
        name: ifName,
        ipAddress,
        macAddress,
        rxBytes,
        txBytes,
        status
      });
    }
    
    // Additional check for any missed interfaces
    const ipResults = await ssh.execCommand('ip link show');
    if (ipResults.code === 0) {
      const ipLines = ipResults.stdout.trim().split('\n');
      let currentIface = '';
      
      for (let i = 0; i < ipLines.length; i++) {
        const line = ipLines[i];
        
        // Match interface name and index line
        const ifaceMatch = line.match(/^\d+:\s+([^:@]+)[:@]/);
        if (ifaceMatch && ifaceMatch.length > 1) {
          currentIface = ifaceMatch[1].trim();
          
          // Check if this interface is already in our list
          const existingIface = interfaces.find(iface => iface.name === currentIface);
          if (!existingIface) {
            // If next line exists, check for MAC address
            if (i + 1 < ipLines.length) {
              const nextLine = ipLines[i + 1];
              let macAddress = '';
              
              const macMatch = nextLine.match(/link\/ether\s+([0-9a-f:]+)/i);
              if (macMatch && macMatch.length > 1) {
                macAddress = macMatch[1].toLowerCase();
              }
              
              let status = 'up';
              if (line.includes('state DOWN')) {
                status = 'down';
              }
              
              // Get IP address for this interface
              const ipAddrResult = await ssh.execCommand(`ip addr show ${currentIface} | grep -oE 'inet ([0-9]{1,3}[\.]){3}[0-9]{1,3}' | cut -d' ' -f2 2>/dev/null || echo ""`);
              let ipAddress = '';
              if (ipAddrResult.code === 0 && ipAddrResult.stdout.trim()) {
                ipAddress = ipAddrResult.stdout.trim();
              }
              
              interfaces.push({
                name: currentIface,
                ipAddress,
                macAddress,
                rxBytes: 0,
                txBytes: 0,
                status
              });
            }
          } else if (!existingIface.macAddress || !existingIface.ipAddress) {
            // Update existing interface's MAC/IP if it doesn't have one
            if (i + 1 < ipLines.length) {
              // Update MAC if missing
              if (!existingIface.macAddress) {
                const nextLine = ipLines[i + 1];
                const macMatch = nextLine.match(/link\/ether\s+([0-9a-f:]+)/i);
                if (macMatch && macMatch.length > 1) {
                  existingIface.macAddress = macMatch[1].toLowerCase();
                }
              }
              
              // Update IP if missing
              if (!existingIface.ipAddress) {
                const ipAddrResult = await ssh.execCommand(`ip addr show ${currentIface} | grep -oE 'inet ([0-9]{1,3}[\.]){3}[0-9]{1,3}' | cut -d' ' -f2 2>/dev/null || echo ""`);
                if (ipAddrResult.code === 0 && ipAddrResult.stdout.trim()) {
                  existingIface.ipAddress = ipAddrResult.stdout.trim();
                }
              }
            }
          }
        }
      }
    }
    
    // Final fallback: try to get IPs with a more direct approach for any interfaces still missing IPs
    for (const iface of interfaces) {
      if (!iface.ipAddress) {
        // Use grep on /proc/net/fib_trie for a more reliable IP lookup
        const fibResult = await ssh.execCommand(`grep -A1 "${iface.name}" /proc/net/fib_trie 2>/dev/null | grep -oE '([0-9]{1,3}[\.]){3}[0-9]{1,3}' | head -1 || echo ""`);
        if (fibResult.code === 0 && fibResult.stdout.trim()) {
          iface.ipAddress = fibResult.stdout.trim();
        }
      }
    }
    
    // Log for debugging
    logger.debug(`Collected network interface information: ${JSON.stringify(interfaces)}`);
    
    return interfaces;
  } catch (error) {
    logger.error(`Error collecting network info: ${error.message}`);
    return [];
  }
};

// Collect wireless client information
const collectWirelessInfo = async (ssh) => {
  try {
    // Check if iw command is available (for wireless info)
    const iwResult = await ssh.execCommand('which iw');
    
    if (iwResult.code !== 0) {
      return 0;
    }
    
    // Get wireless client count
    const result = await ssh.execCommand('iw dev wlan0 station dump | grep Station | wc -l');
    
    if (result.code !== 0) {
      return 0;
    }
    
    return parseInt(result.stdout.trim());
  } catch (error) {
    logger.error(`Error collecting wireless info: ${error.message}`);
    return 0;
  }
};

// Fetch the hostname of a router
exports.fetchHostname = async (router) => {
  try {
    const ssh = await createSSHClient(router);
    
    if (!ssh) {
      return null;
    }
    
    // Try different commands to get hostname
    let hostname = null;
    
    // Try standard hostname command first
    const hostnameResult = await ssh.execCommand('hostname');
    if (hostnameResult.code === 0 && hostnameResult.stdout.trim()) {
      hostname = hostnameResult.stdout.trim();
    } else {
      // Try uci command (specific to OpenWrt)
      const uciResult = await ssh.execCommand('uci get system.@system[0].hostname');
      if (uciResult.code === 0 && uciResult.stdout.trim()) {
        hostname = uciResult.stdout.trim();
      } else {
        // Try cat /proc/sys/kernel/hostname
        const catResult = await ssh.execCommand('cat /proc/sys/kernel/hostname');
        if (catResult.code === 0 && catResult.stdout.trim()) {
          hostname = catResult.stdout.trim();
        }
      }
    }
    
    // Disconnect
    ssh.dispose();
    
    return hostname;
  } catch (error) {
    logger.error(`Error fetching hostname for router ${router.name}: ${error.message}`);
    return null;
  }
};

// Fetch the MAC address of a router
exports.fetchMacAddress = async (router) => {
  try {
    const ssh = await createSSHClient(router);
    
    if (!ssh) {
      return null;
    }
    
    // Try different commands to get MAC address
    let macAddress = null;
    
    // Try to find MAC address of the main interface (br-lan for OpenWrt or eth0)
    const commands = [
      // OpenWrt specific
      'ip link show br-lan | grep -o "link/ether [0-9a-f:]\+" | cut -d" " -f2',
      // Generic fallback
      'ip link show eth0 | grep -o "link/ether [0-9a-f:]\+" | cut -d" " -f2',
      // Another fallback
      'ifconfig br-lan | grep -o -E "([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}" | head -n1',
      // Another fallback
      'ifconfig eth0 | grep -o -E "([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}" | head -n1',
      // Yet another fallback
      'cat /sys/class/net/br-lan/address 2>/dev/null || cat /sys/class/net/eth0/address 2>/dev/null'
    ];
    
    for (const command of commands) {
      if (macAddress) break; // Stop if we found a MAC address
      
      const result = await ssh.execCommand(command);
      if (result.code === 0 && result.stdout.trim().match(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)) {
        macAddress = result.stdout.trim().toLowerCase();
        break;
      }
    }
    
    // Disconnect
    ssh.dispose();
    
    return macAddress;
  } catch (error) {
    logger.error(`Error fetching MAC address for router ${router.name}: ${error.message}`);
    return null;
  }
}; 