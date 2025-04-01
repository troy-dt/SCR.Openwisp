import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  TextField, 
  Button, 
  Grid, 
  CircularProgress, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Checkbox,
  Chip,
  LinearProgress,
  Snackbar,
  Alert,
  Card,
  CardContent,
  CardActions,
  Divider,
  IconButton,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import ScannerIcon from '@mui/icons-material/Scanner';
import DoneIcon from '@mui/icons-material/Done';
import ErrorIcon from '@mui/icons-material/Error';
import api, { scannerApi, directScannerApi } from '../services/api';

const SubnetScanner = () => {
  const [subnet, setSubnet] = useState('192.168.1');
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanStep, setScanStep] = useState('');
  const [discoveredDevices, setDiscoveredDevices] = useState([]);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [alert, setAlert] = useState({ open: false, message: '', severity: 'info' });
  const [isPartialResult, setIsPartialResult] = useState(false);
  const [addingRouters, setAddingRouters] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(0);
  
  const scanSteps = ['Preparing', 'Discovering devices', 'Checking OpenWrt', 'Gathering data'];
  
  // Progress animation
  React.useEffect(() => {
    let timer;
    if (loading && activeStep < scanSteps.length) {
      timer = setInterval(() => {
        // Increment progress and step based on time elapsed
        setProgress((oldProgress) => {
          const newProgress = Math.min(oldProgress + 1, 100);
          
          // Update step if progress reaches certain thresholds
          if (newProgress > 25 && activeStep === 0) {
            setActiveStep(1);
          } else if (newProgress > 50 && activeStep === 1) {
            setActiveStep(2);
          } else if (newProgress > 75 && activeStep === 2) {
            setActiveStep(3);
          }
          
          return newProgress;
        });
      }, 300);
    }
    
    return () => {
      clearInterval(timer);
    };
  }, [loading, activeStep]);
  
  const handleSubnetChange = (e) => {
    setSubnet(e.target.value);
  };
  
  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
  };
  
  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
  };
  
  const resetScan = () => {
    setActiveStep(0);
    setProgress(0);
    setErrorMessage('');
    setIsPartialResult(false);
  };
  
  const handleScanSubnet = async () => {
    if (!subnet || !username || !password) {
      setAlert({
        open: true,
        message: 'Please fill all required fields',
        severity: 'error'
      });
      return;
    }
    
    resetScan();
    setLoading(true);
    setDiscoveredDevices([]);
    setSelectedDevices([]);
    setScanStep('ping');
    
    console.log('Attempting to scan subnet:', subnet);
    
    try {
      // Try direct connection first, with built-in fallback to proxy
      console.log('Using direct connection to backend for scan');
      
      let response;
      try {
        // Try direct API first
        response = await directScannerApi.post('/api/scanner/scan', {
          subnet,
          username,
          password
        });
        console.log('Direct connection succeeded');
      } catch (directError) {
        // If direct connection fails, try the proxy
        console.error('Direct connection failed, trying proxy:', directError);
        console.log('Falling back to proxy');
        
        response = await scannerApi.post('/api/scanner/scan', {
          subnet,
          username,
          password
        });
        console.log('Proxy connection succeeded');
      }
      
      console.log('Scan job created successfully:', response.data);
      
      const jobId = response.data.jobId;
      
      if (!jobId) {
        throw new Error('No job ID received from server');
      }
      
      console.log(`Started scan job: ${jobId}`);
      
      // Start polling for job status
      pollJobStatus(jobId);
    } catch (error) {
      console.error('Error starting scan job (both direct and proxy failed):', error);
      
      // Get the error message
      let errorMsg = 'Failed to start scan. Check browser console for details.';
      
      if (error.response) {
        errorMsg = error.response.data?.error || error.response.data?.message || `Server error: ${error.response.status}`;
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      setErrorMessage(errorMsg);
      setAlert({
        open: true,
        message: errorMsg,
        severity: 'error'
      });
      
      setLoading(false);
      setScanStep('');
    }
  };
  
  // Poll for job status updates with fallback mechanism
  const pollJobStatus = (jobId) => {
    console.log(`Starting to poll for job status: ${jobId}`);
    
    // Start with a short polling interval that increases over time
    let pollInterval = 1000; // 1 second initially
    let pollCount = 0;
    let maxPolls = 60; // Maximum number of polls (increased for longer operations)
    let useDirectConnection = true; // Start with direct connection
    
    const pollTimer = setInterval(async () => {
      try {
        pollCount++;
        
        // Adjust poll interval to reduce server load over time
        if (pollCount === 5) pollInterval = 2000;
        if (pollCount === 10) pollInterval = 3000;
        if (pollCount === 20) pollInterval = 5000;
        
        // Stop polling if we've reached the maximum number of polls
        if (pollCount > maxPolls) {
          clearInterval(pollTimer);
          
          // If we're still loading, show a timeout message
          if (loading) {
            setLoading(false);
            setScanStep('');
            setErrorMessage('Scan is taking longer than expected. The scan continues in the background. Try clicking "Scan Again" in a moment to check for results.');
            setAlert({
              open: true,
              message: 'Scan timeout reached. The scan continues in the background.',
              severity: 'warning'
            });
          }
          
          return;
        }
        
        let response;
        
        if (useDirectConnection) {
          try {
            // Try direct connection first
            response = await directScannerApi.get(`/api/scanner/scan/${jobId}`);
          } catch (directError) {
            console.log('Direct poll failed, switching to proxy');
            useDirectConnection = false; // Switch to proxy for future polls
            // Try proxy as fallback
            response = await scannerApi.get(`/api/scanner/scan/${jobId}`);
          }
        } else {
          // Use proxy if direct connection failed before
          response = await scannerApi.get(`/api/scanner/scan/${jobId}`);
        }
        
        console.log(`Poll ${pollCount}: Job status = ${response.data.status}, Progress = ${response.data.progress}%`);
        
        // Update UI based on job status
        updateScanProgress(response.data);
        
        // If job is completed or failed, stop polling
        if (response.data.status === 'completed' || response.data.status === 'error') {
          console.log('Job finished with status:', response.data.status);
          clearInterval(pollTimer);
          
          if (response.data.status === 'completed') {
            handleScanResults(response.data);
          } else {
            setLoading(false);
            setScanStep('');
            setErrorMessage(response.data.error || 'Scan failed');
            setAlert({
              open: true,
              message: response.data.error || 'Scan failed',
              severity: 'error'
            });
          }
        }
      } catch (error) {
        console.error('Error polling job status:', error);
        
        // After a few failed attempts, give up
        if (pollCount > 3) {
          clearInterval(pollTimer);
          setLoading(false);
          setScanStep('');
          setErrorMessage('Error checking scan status. The scan may still be running in the background.');
          setAlert({
            open: true,
            message: 'Error checking scan status',
            severity: 'error'
          });
        }
      }
    }, pollInterval);
    
    // Set a timeout to clear the interval after a maximum time
    // This prevents memory leaks if the component unmounts
    setTimeout(() => {
      clearInterval(pollTimer);
    }, 10 * 60 * 1000); // 10 minutes max
  };
  
  // Update UI during scan based on job progress
  const updateScanProgress = (data) => {
    // Update progress bar based on job progress
    setProgress(data.progress || 0);
    
    // Update step based on progress
    if (data.progress < 25) {
      setActiveStep(0); // Preparing
    } else if (data.progress < 50) {
      setActiveStep(1); // Discovering devices
    } else if (data.progress < 75) {
      setActiveStep(2); // Checking OpenWrt
    } else {
      setActiveStep(3); // Gathering data
    }
    
    // Update scan step text
    if (data.message) {
      setScanStep(data.message);
    }
  };
  
  // Process scan results
  const handleScanResults = (data) => {
    // Complete progress animation
    setProgress(100);
    setActiveStep(3);
    
    // Check if this is a partial result
    setIsPartialResult(!!data.partialResults || !!data.isPartialResult);
    
    if (data.devices && data.devices.length > 0) {
      setDiscoveredDevices(data.devices);
      // Select all devices by default
      setSelectedDevices(data.devices.map(device => device.macAddress).filter(mac => mac));
      
      let message = `Found ${data.devices.length} device(s)`;
      if (data.isPartialResult) {
        message += ' (partial results due to timeout)';
        setErrorMessage('Partial results - scan timed out before completion. Try scanning a smaller range or a specific IP.');
      }
      
      setAlert({
        open: true,
        message,
        severity: 'success'
      });
    } else {
      setAlert({
        open: true,
        message: 'No OpenWrt devices found in the subnet',
        severity: 'info'
      });
    }
  };
  
  /**
   * Create unique identifier for device when MAC is unavailable
   * @param {Object} device - The device object
   * @returns {String} - Device identifier
   */
  const getDeviceIdentifier = (device) => {
    return device.macAddress || `ip-${device.ipAddress}`;
  };
  
  const handleToggleDevice = (device) => {
    // Use the identifier instead of just macAddress
    const identifier = getDeviceIdentifier(device);
    
    setSelectedDevices(prev => {
      if (prev.includes(identifier)) {
        return prev.filter(id => id !== identifier);
      } else {
        return [...prev, identifier];
      }
    });
  };
  
  const handleToggleAll = () => {
    if (selectedDevices.length === discoveredDevices.length) {
      // If all are selected, deselect all
      setSelectedDevices([]);
    } else {
      // Otherwise, select all
      setSelectedDevices(discoveredDevices.map(device => getDeviceIdentifier(device)));
    }
  };
  
  const handleAddSelected = async () => {
    if (selectedDevices.length === 0) {
      setAlert({
        open: true,
        message: 'Please select at least one device',
        severity: 'error'
      });
      return;
    }
    
    setLoading(true);
    setScanStep('adding');
    setAddingRouters(true);
    setErrorMessage('');
    
    try {
      // Filter devices that are selected using the identifiers
      const devicesToAdd = discoveredDevices.filter(device => 
        selectedDevices.includes(getDeviceIdentifier(device))
      );
      
      // Add credentials to each device
      const devicesWithCredentials = devicesToAdd.map(device => ({
        ...device,
        username,
        password,
        name: device.hostname || device.ipAddress
      }));
      
      // Try direct connection first with fallback to proxy
      let response;
      try {
        console.log('Using direct connection to add routers');
        console.log('Devices to add:', devicesWithCredentials);
        
        response = await directScannerApi.post('/api/scanner/add-multiple', {
          devices: devicesWithCredentials
        });
        console.log('Direct connection succeeded for adding routers');
      } catch (directError) {
        console.error('Direct connection failed for adding routers, trying proxy:', directError);
        
        response = await scannerApi.post('/api/scanner/add-multiple', {
          devices: devicesWithCredentials
        });
        console.log('Proxy connection succeeded for adding routers');
      }
      
      console.log('Add multiple response:', response.data);
      
      setAlert({
        open: true,
        message: `Added ${response.data.added?.length || 0} device(s), updated ${response.data.updated?.length || 0} device(s)`,
        severity: 'success'
      });
      
      // Clear selection after adding
      setSelectedDevices([]);
      // Also clear devices list to encourage user to scan again
      setDiscoveredDevices([]);
    } catch (err) {
      console.error('Error adding devices (both direct and proxy failed):', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Error adding devices';
      setErrorMessage(errorMsg);
      setAlert({
        open: true,
        message: errorMsg,
        severity: 'error'
      });
    } finally {
      setLoading(false);
      setScanStep('');
      setAddingRouters(false);
    }
  };
  
  const handleCloseAlert = () => {
    setAlert({ ...alert, open: false });
  };
  
  const getScanStepText = () => {
    switch(scanStep) {
      case 'ping': return 'Pinging devices on subnet...';
      case 'adding': return 'Adding selected devices...';
      default: return 'Scanning...';
    }
  };
  
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Subnet Scanner
      </Typography>
      
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Scan Settings
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Subnet (x.x.x)"
              fullWidth
              value={subnet}
              onChange={handleSubnetChange}
              placeholder="e.g. 192.168.1"
              helperText="Enter the first 3 octets of your subnet"
              disabled={loading}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="SSH Username"
              fullWidth
              value={username}
              onChange={handleUsernameChange}
              disabled={loading}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="SSH Password"
              fullWidth
              type="password"
              value={password}
              onChange={handlePasswordChange}
              disabled={loading}
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              startIcon={loading ? <CircularProgress size={24} color="inherit" /> : <ScannerIcon />}
              onClick={handleScanSubnet}
              disabled={loading}
            >
              {loading ? getScanStepText() : 'Scan Subnet'}
            </Button>
          </Grid>
          {loading && (
            <Grid item xs={12}>
              <Box sx={{ width: '100%', mt: 1 }}>
                <Stepper activeStep={activeStep} alternativeLabel>
                  {scanSteps.map((label, index) => (
                    <Step key={label}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
                <LinearProgress variant="determinate" value={progress} sx={{ mt: 2 }} />
              </Box>
            </Grid>
          )}
          {errorMessage && (
            <Grid item xs={12}>
              <Alert severity="warning" sx={{ mt: 1 }}>
                {errorMessage}
              </Alert>
            </Grid>
          )}
        </Grid>
      </Paper>
      
      {discoveredDevices.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center">
              <Typography variant="h6" sx={{ mr: 1 }}>
                Discovered Devices ({discoveredDevices.length})
              </Typography>
              {isPartialResult && (
                <Chip 
                  label="Partial Results" 
                  color="warning" 
                  size="small"
                  title="Some devices may not be shown due to timeout during scanning"
                />
              )}
            </Box>
            <Box>
              <Button
                variant="contained"
                color="secondary"
                startIcon={loading && scanStep === 'adding' ? <CircularProgress size={24} color="inherit" /> : <AddIcon />}
                onClick={handleAddSelected}
                disabled={loading || selectedDevices.length === 0}
                sx={{ mr: 1 }}
              >
                {loading && scanStep === 'adding' ? 'Adding...' : 'Add Selected'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleScanSubnet}
                disabled={loading}
              >
                Scan Again
              </Button>
            </Box>
          </Box>
          
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selectedDevices.length > 0 && selectedDevices.length < discoveredDevices.length}
                      checked={selectedDevices.length === discoveredDevices.length}
                      onChange={handleToggleAll}
                    />
                  </TableCell>
                  <TableCell>Hostname</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>MAC Address</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {discoveredDevices.map((device) => (
                  <TableRow key={device.macAddress || device.ipAddress} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedDevices.includes(getDeviceIdentifier(device))}
                        onChange={() => handleToggleDevice(device)}
                      />
                    </TableCell>
                    <TableCell>{device.hostname || 'Unknown'}</TableCell>
                    <TableCell>{device.ipAddress}</TableCell>
                    <TableCell>{device.macAddress || 'Unknown'}</TableCell>
                    <TableCell>
                      <Chip 
                        color={device.exists ? "secondary" : "success"}
                        size="small"
                        label={device.exists ? "Exists in database" : "New device"}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        disabled={loading}
                        onClick={() => {
                          // Use a simpler approach - make a direct API call to the backend
                          setLoading(true);
                          
                          // Prepare device data
                          const data = {
                            ipAddress: device.ipAddress,
                            hostname: device.hostname || 'Unknown Router',
                            macAddress: device.macAddress || `auto-${device.ipAddress.replace(/\./g, '-')}`,
                            username,
                            password
                          };
                          
                          console.log('API call: /api/routers', data);
                          
                          // Use the main API instance instead of the scanner API
                          api.post('/api/routers', data)
                            .then(response => {
                              console.log('Success adding router:', response.data);
                              
                              setAlert({
                                open: true,
                                message: 'Device added successfully!',
                                severity: 'success'
                              });
                              
                              // Clear the device list
                              setDiscoveredDevices([]);
                            })
                            .catch(err => {
                              console.error('Error adding router:', err);
                              console.log('Error details:', {
                                message: err.message,
                                response: err.response?.data,
                                status: err.response?.status
                              });
                              
                              setAlert({
                                open: true,
                                message: `Failed to add device: ${err.response?.data?.error || err.message}`,
                                severity: 'error'
                              });
                            })
                            .finally(() => {
                              setLoading(false);
                            });
                        }}
                      >
                        {device.exists ? 'Update' : 'Add'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
      
      <Snackbar
        open={alert.open}
        autoHideDuration={6000}
        onClose={handleCloseAlert}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseAlert} severity={alert.severity}>
          {alert.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SubnetScanner; 