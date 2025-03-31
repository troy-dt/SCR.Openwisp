const { NodeSSH } = require('node-ssh');
const logger = require('./logger');

// Create a new SSH client
const createSSHClient = async (router) => {
  const ssh = new NodeSSH();
  
  try {
    // Connection options
    const sshOptions = {
      host: router.hostname || router.ipAddress,
      port: router.port || 22,
      username: router.username,
      password: router.password,
    };
    
    // Use SSH key if available
    if (router.sshKey) {
      sshOptions.privateKey = router.sshKey;
      delete sshOptions.password;
    }
    
    // Connect to the router
    await ssh.connect(sshOptions);
    
    return ssh;
  } catch (error) {
    logger.error(`SSH connection error for router ${router.name}: ${error.message}`);
    return null;
  }
};

// Test the SSH connection
exports.testConnection = async (router) => {
  try {
    const ssh = await createSSHClient(router);
    
    if (!ssh) {
      return false;
    }
    
    // Execute a simple command to test the connection
    const result = await ssh.execCommand('echo "Connection test"');
    
    // Disconnect
    ssh.dispose();
    
    return result.code === 0;
  } catch (error) {
    logger.error(`Connection test error for router ${router.name}: ${error.message}`);
    return false;
  }
};

// Collect metrics from a router
exports.collectMetrics = async (router) => {
  try {
    const ssh = await createSSHClient(router);
    
    if (!ssh) {
      return null;
    }
    
    // Collect various metrics in parallel
    const [uptime, memInfo, cpuLoad, diskUsage, networkInfo, wirelessInfo] = await Promise.all([
      collectUptime(ssh),
      collectMemoryInfo(ssh),
      collectCpuLoad(ssh),
      collectDiskUsage(ssh),
      collectNetworkInfo(ssh),
      collectWirelessInfo(ssh)
    ]);
    
    // Disconnect
    ssh.dispose();
    
    return {
      uptime,
      memoryUsage: memInfo,
      cpuLoad,
      diskUsage,
      networkInterfaces: networkInfo,
      wirelessClients: wirelessInfo
    };
  } catch (error) {
    logger.error(`Error collecting metrics for router ${router.name}: ${error.message}`);
    return null;
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
    const result = await ssh.execCommand('cat /proc/meminfo | grep -E "MemTotal|MemFree|MemAvailable"');
    
    if (result.code !== 0) {
      return {
        total: 0,
        free: 0,
        used: 0,
        percentage: 0
      };
    }
    
    // Parse the output
    const lines = result.stdout.split('\n');
    let total = 0;
    let free = 0;
    
    for (const line of lines) {
      if (line.includes('MemTotal')) {
        total = parseInt(line.split(':')[1].trim().split(' ')[0]);
      } else if (line.includes('MemFree')) {
        free = parseInt(line.split(':')[1].trim().split(' ')[0]);
      }
    }
    
    const used = total - free;
    const percentage = Math.round((used / total) * 100);
    
    return {
      total,
      free,
      used,
      percentage
    };
  } catch (error) {
    logger.error(`Error collecting memory info: ${error.message}`);
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
  try {
    const result = await ssh.execCommand('cat /proc/loadavg');
    
    if (result.code !== 0) {
      return 0;
    }
    
    // Parse the output (1 minute load average)
    const loadAvg = parseFloat(result.stdout.split(' ')[0]);
    return loadAvg;
  } catch (error) {
    logger.error(`Error collecting CPU load: ${error.message}`);
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