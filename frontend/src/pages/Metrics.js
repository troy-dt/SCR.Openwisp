import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Divider,
  CircularProgress,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert
} from '@mui/material';
import { useRouters } from '../context/RouterContext';
import axios from 'axios';
import RefreshIcon from '@mui/icons-material/Refresh';
import RouterIcon from '@mui/icons-material/Router';
import MemoryIcon from '@mui/icons-material/Memory';
import DnsIcon from '@mui/icons-material/Dns';
import WifiIcon from '@mui/icons-material/Wifi';
import DevicesIcon from '@mui/icons-material/Devices';
import SpeedIcon from '@mui/icons-material/Speed';
import StorageIcon from '@mui/icons-material/Storage';
import { Line, Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Create axios instance with proper base URL
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  }
});

const Metrics = () => {
  const { routers, loading, fetchRouters, collectMetrics, fetchRouterMetrics } = useRouters();
  const [selectedRouter, setSelectedRouter] = useState('');
  const [metrics, setMetrics] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [collectingMetrics, setCollectingMetrics] = useState(false);
  const [error, setError] = useState(null);
  const [metricsConfig, setMetricsConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [timespan, setTimespan] = useState('day'); // Default to day view
  const [limit, setLimit] = useState(24); // Default to 24 data points

  // Time period options
  const timespanOptions = [
    { value: 'hour', label: 'Last Hour', defaultLimit: 60 },
    { value: 'day', label: 'Last 24 Hours', defaultLimit: 24 },
    { value: 'week', label: 'Last Week', defaultLimit: 168 },
    { value: 'month', label: 'Last Month', defaultLimit: 720 }
  ];

  // Fetch metrics configuration
  useEffect(() => {
    const fetchMetricsConfig = async () => {
      try {
        setLoadingConfig(true);
        const response = await api.get('/routers/metrics/config');
        setMetricsConfig(response.data);
      } catch (err) {
        console.error('Error fetching metrics config:', err);
      } finally {
        setLoadingConfig(false);
      }
    };

    fetchMetricsConfig();
  }, []);

  // Fetch latest metrics when selected router or timespan changes
  useEffect(() => {
    const fetchMetrics = async () => {
      if (selectedRouter) {
        try {
          setRefreshing(true);
          const router = routers.find(r => r.id === selectedRouter);
          if (router) {
            const metricsData = await fetchRouterMetrics(selectedRouter, { 
              limit: limit,
              timespan: timespan 
            });
            setMetrics(metricsData);
          }
          setError(null);
        } catch (err) {
          setError('Failed to fetch metrics. Please try again later.');
          console.error('Error fetching metrics:', err);
        } finally {
          setRefreshing(false);
        }
      }
    };

    fetchMetrics();
  }, [selectedRouter, timespan, limit, fetchRouterMetrics]);

  // Set first router as selected when routers are loaded
  useEffect(() => {
    if (routers.length > 0 && !selectedRouter) {
      setSelectedRouter(routers[0].id);
    }
  }, [routers, selectedRouter]);

  const handleRouterChange = (event) => {
    setSelectedRouter(event.target.value);
  };

  const handleTimespanChange = (event) => {
    const newTimespan = event.target.value;
    setTimespan(newTimespan);
    
    // Update limit based on selected timespan
    const option = timespanOptions.find(opt => opt.value === newTimespan);
    if (option) {
      setLimit(option.defaultLimit);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchRouters();
      if (selectedRouter) {
        const metricsData = await fetchRouterMetrics(selectedRouter, { 
          limit: limit,
          timespan: timespan 
        });
        setMetrics(metricsData);
      }
      setError(null);
    } catch (err) {
      setError('Failed to refresh data. Please try again later.');
      console.error('Error refreshing data:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCollectMetrics = async () => {
    if (selectedRouter) {
      try {
        setCollectingMetrics(true);
        await collectMetrics(selectedRouter);
        // Refresh metrics after collection
        const metricsData = await fetchRouterMetrics(selectedRouter, { 
          limit: limit,
          timespan: timespan 
        });
        setMetrics(metricsData);
        setError(null);
      } catch (err) {
        setError('Failed to collect metrics. Please try again later.');
        console.error('Error collecting metrics:', err);
      } finally {
        setCollectingMetrics(false);
      }
    }
  };

  // Update metrics collection interval
  const handleUpdateCollectionInterval = async (interval) => {
    try {
      setLoadingConfig(true);
      const response = await api.post('/routers/metrics/config', { interval });
      
      if (response.status === 200) {
        setMetricsConfig(prevConfig => ({
          ...prevConfig,
          currentInterval: response.data.currentInterval
        }));
      } else {
        setError(response.data.message || 'Failed to update collection interval');
      }
    } catch (err) {
      console.error('Error updating metrics config:', err);
      setError('Failed to update collection interval');
    } finally {
      setLoadingConfig(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  // Prepare CPU chart data
  const cpuChartData = {
    labels: metrics.map(m => new Date(m.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'CPU Load',
        data: metrics.map(m => m.cpuLoad),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        fill: true,
      }
    ],
  };

  // Prepare memory chart data
  const memoryChartData = {
    labels: metrics.map(m => new Date(m.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'Memory Usage (%)',
        data: metrics.map(m => m.memoryUsage?.percentage || 0),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        fill: true,
      }
    ],
  };

  // Prepare disk usage chart data
  const diskChartData = {
    labels: ['Used', 'Free'],
    datasets: [
      {
        data: metrics.length > 0 
          ? [metrics[0].diskUsage?.percentage || 0, 100 - (metrics[0].diskUsage?.percentage || 0)] 
          : [0, 100],
        backgroundColor: ['rgba(255, 99, 132, 0.5)', 'rgba(75, 192, 192, 0.5)'],
        borderColor: ['rgb(255, 99, 132)', 'rgb(75, 192, 192)'],
      }
    ],
  };

  // Prepare network chart data
  const networkChartData = {
    labels: metrics.map(m => new Date(m.timestamp).toLocaleTimeString()),
    datasets: metrics.length > 0 && metrics[0].networkInterfaces 
      ? metrics[0].networkInterfaces.map((iface, index) => {
          const colors = [
            { border: 'rgb(75, 192, 192)', background: 'rgba(75, 192, 192, 0.5)' },
            { border: 'rgb(255, 99, 132)', background: 'rgba(255, 99, 132, 0.5)' },
            { border: 'rgb(255, 205, 86)', background: 'rgba(255, 205, 86, 0.5)' },
            { border: 'rgb(54, 162, 235)', background: 'rgba(54, 162, 235, 0.5)' },
          ];
          const colorIndex = index % colors.length;
          
          return {
            label: `${iface.name} RX/TX`,
            data: metrics.map(m => {
              const netIface = m.networkInterfaces?.find(ni => ni.name === iface.name);
              return netIface ? (netIface.rxBytes + netIface.txBytes) / 1024 / 1024 : 0;
            }),
            borderColor: colors[colorIndex].border,
            backgroundColor: colors[colorIndex].background,
          };
        })
      : [],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Router Metrics',
      },
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Disk Usage',
      },
    }
  };

  const latestMetrics = metrics.length > 0 ? metrics[0] : null;

  return (
    <Box mt={4}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Metrics
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel id="router-select-label">Router</InputLabel>
              <Select
                labelId="router-select-label"
                id="router-select"
                value={selectedRouter}
                label="Router"
                onChange={handleRouterChange}
                disabled={loading}
              >
                {routers.map((router) => (
                  <MenuItem key={router.id} value={router.id}>
                    {router.name} ({router.ipAddress})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={3}>
            <FormControl fullWidth>
              <InputLabel id="timespan-select-label">Time Period</InputLabel>
              <Select
                labelId="timespan-select-label"
                id="timespan-select"
                value={timespan}
                label="Time Period"
                onChange={handleTimespanChange}
                disabled={loading || refreshing}
              >
                {timespanOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={5} container spacing={1} justifyContent="flex-end">
            <Grid item>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleRefresh}
                disabled={loading || refreshing}
              >
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="contained"
                color="primary"
                onClick={handleCollectMetrics}
                disabled={loading || collectingMetrics}
              >
                {collectingMetrics ? 'Collecting...' : 'Collect Metrics Now'}
              </Button>
            </Grid>
          </Grid>
        </Grid>
      </Paper>

      {metricsConfig && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap">
            <Box>
              <Typography variant="subtitle1">
                Automatic Collection Schedule: 
                <Typography component="span" fontWeight="bold" ml={1}>
                  {metricsConfig.currentInterval}
                </Typography>
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Next collection: {metricsConfig.status?.metricsCollection?.nextDate ? new Date(metricsConfig.status.metricsCollection.nextDate).toLocaleString() : 'N/A'}
              </Typography>
            </Box>
            
            <FormControl sx={{ minWidth: 200, mt: { xs: 2, md: 0 } }}>
              <InputLabel id="interval-select-label">Collection Interval</InputLabel>
              <Select
                labelId="interval-select-label"
                id="interval-select"
                value=""
                label="Collection Interval"
                onChange={(e) => handleUpdateCollectionInterval(e.target.value)}
                disabled={loadingConfig}
              >
                {metricsConfig.availableIntervals && Object.entries(metricsConfig.availableIntervals).map(([key, value]) => (
                  <MenuItem key={key} value={key}>
                    {key.replace(/_/g, ' ').toLowerCase()} ({value})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Paper>
      )}

      {routers.length === 0 ? (
        <Paper sx={{ p: 3 }}>
          <Typography align="center">
            No routers found. Add a router to see metrics.
          </Typography>
        </Paper>
      ) : (
        <>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab icon={<SpeedIcon />} label="Performance" />
              <Tab icon={<WifiIcon />} label="Network" />
              <Tab icon={<DevicesIcon />} label="Clients" />
              <Tab icon={<StorageIcon />} label="Storage" />
            </Tabs>
          </Box>

          {refreshing ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : !latestMetrics ? (
            <Paper sx={{ p: 3 }}>
              <Typography align="center">
                No metrics available. Click "Collect New Metrics" to get started.
              </Typography>
            </Paper>
          ) : (
            <>
              {/* Performance Tab */}
              {tabValue === 0 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6} lg={4}>
                    <Card>
                      <CardContent>
                        <Box display="flex" alignItems="center" mb={1}>
                          <MemoryIcon color="primary" sx={{ mr: 1 }} />
                          <Typography variant="h6">CPU Information</Typography>
                        </Box>
                        <Divider sx={{ mb: 2 }} />
                        
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body1" fontWeight="bold">
                            Current Load Average:
                          </Typography>
                          <Typography variant="h4" color="primary" align="center" sx={{ my: 2 }}>
                            {latestMetrics.cpuLoad?.toFixed(2) || 'N/A'}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Uptime: {latestMetrics.uptime || 'N/A'}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} md={6} lg={4}>
                    <Card>
                      <CardContent>
                        <Box display="flex" alignItems="center" mb={1}>
                          <RouterIcon color="primary" sx={{ mr: 1 }} />
                          <Typography variant="h6">Memory Usage</Typography>
                        </Box>
                        <Divider sx={{ mb: 2 }} />
                        
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body1" fontWeight="bold">
                            Current Memory Usage:
                          </Typography>
                          <Typography variant="h4" color="primary" align="center" sx={{ my: 2 }}>
                            {latestMetrics.memoryUsage?.percentage || 0}%
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {latestMetrics.memoryUsage?.used?.toLocaleString() || 0} KB used of {latestMetrics.memoryUsage?.total?.toLocaleString() || 0} KB
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {latestMetrics.memoryUsage?.free?.toLocaleString() || 0} KB free
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} md={6} lg={4}>
                    <Card>
                      <CardContent>
                        <Box display="flex" alignItems="center" mb={1}>
                          <DnsIcon color="primary" sx={{ mr: 1 }} />
                          <Typography variant="h6">System Status</Typography>
                        </Box>
                        <Divider sx={{ mb: 2 }} />
                        
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2">
                            <strong>Last Update:</strong> {new Date(latestMetrics.timestamp).toLocaleString()}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Wireless Clients:</strong> {latestMetrics.wirelessClients || 0}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Network Interfaces:</strong> {latestMetrics.networkInterfaces?.length || 0}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Disk Usage:</strong> {latestMetrics.diskUsage?.percentage || 0}%
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>CPU Load History</Typography>
                        <Box height={300}>
                          <Line options={chartOptions} data={cpuChartData} />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>Memory Usage History</Typography>
                        <Box height={300}>
                          <Line options={chartOptions} data={memoryChartData} />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
              
              {/* Network Tab */}
              {tabValue === 1 && (
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>Network Interfaces</Typography>
                        <TableContainer>
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableCell>Interface</TableCell>
                                <TableCell>IP Address</TableCell>
                                <TableCell>MAC Address</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>RX</TableCell>
                                <TableCell>TX</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {latestMetrics.networkInterfaces?.map((iface, index) => (
                                <TableRow key={index}>
                                  <TableCell><strong>{iface.name}</strong></TableCell>
                                  <TableCell>{iface.ipAddress || 'N/A'}</TableCell>
                                  <TableCell>{iface.macAddress || 'N/A'}</TableCell>
                                  <TableCell>{iface.status || 'Unknown'}</TableCell>
                                  <TableCell>{iface.rxBytes ? `${(iface.rxBytes / 1024 / 1024).toFixed(2)} MB` : 'N/A'}</TableCell>
                                  <TableCell>{iface.txBytes ? `${(iface.txBytes / 1024 / 1024).toFixed(2)} MB` : 'N/A'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>Network Traffic</Typography>
                        <Box height={400}>
                          <Line options={chartOptions} data={networkChartData} />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
              
              {/* Clients Tab */}
              {tabValue === 2 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Box display="flex" alignItems="center" mb={1}>
                          <WifiIcon color="primary" sx={{ mr: 1 }} />
                          <Typography variant="h6">Wireless Clients</Typography>
                        </Box>
                        <Divider sx={{ mb: 2 }} />
                        
                        <Typography variant="h2" align="center" sx={{ my: 5 }}>
                          {latestMetrics.wirelessClients || 0}
                        </Typography>
                        <Typography variant="body2" color="textSecondary" align="center">
                          Connected wireless devices
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Box display="flex" alignItems="center" mb={1}>
                          <DevicesIcon color="primary" sx={{ mr: 1 }} />
                          <Typography variant="h6">Interface Client Distribution</Typography>
                        </Box>
                        <Divider sx={{ mb: 2 }} />
                        
                        <Box height={300} display="flex" justifyContent="center" alignItems="center">
                          {latestMetrics.networkInterfaces && latestMetrics.networkInterfaces.length > 0 ? (
                            <Typography variant="body2" color="textSecondary" align="center">
                              Client distribution by interface is not available in the current metrics data.
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="textSecondary" align="center">
                              No network interfaces available.
                            </Typography>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
              
              {/* Storage Tab */}
              {tabValue === 3 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Box display="flex" alignItems="center" mb={1}>
                          <StorageIcon color="primary" sx={{ mr: 1 }} />
                          <Typography variant="h6">Disk Usage</Typography>
                        </Box>
                        <Divider sx={{ mb: 2 }} />
                        
                        <Box height={300}>
                          <Pie options={pieChartOptions} data={diskChartData} />
                        </Box>
                        
                        <Box mt={2}>
                          <Typography variant="body2" align="center">
                            <strong>Total:</strong> {latestMetrics.diskUsage?.totalRaw || latestMetrics.diskUsage?.total || 'N/A'}
                          </Typography>
                          <Typography variant="body2" align="center">
                            <strong>Used:</strong> {latestMetrics.diskUsage?.usedRaw || latestMetrics.diskUsage?.used || 'N/A'} ({latestMetrics.diskUsage?.percentage || 0}%)
                          </Typography>
                          <Typography variant="body2" align="center">
                            <strong>Free:</strong> {latestMetrics.diskUsage?.freeRaw || latestMetrics.diskUsage?.free || 'N/A'}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Box display="flex" alignItems="center" mb={1}>
                          <StorageIcon color="primary" sx={{ mr: 1 }} />
                          <Typography variant="h6">Storage Information</Typography>
                        </Box>
                        <Divider sx={{ mb: 2 }} />
                        
                        <Box p={2}>
                          <Typography variant="body1" gutterBottom>
                            <strong>File System:</strong> root (/)
                          </Typography>
                          <Typography variant="body1" gutterBottom>
                            <strong>Usage:</strong> {latestMetrics.diskUsage?.percentage || 0}% used
                          </Typography>
                          <Typography variant="body1" gutterBottom>
                            <strong>Total Space:</strong> {latestMetrics.diskUsage?.totalRaw || latestMetrics.diskUsage?.total || 'N/A'}
                          </Typography>
                          <Typography variant="body1" gutterBottom>
                            <strong>Used Space:</strong> {latestMetrics.diskUsage?.usedRaw || latestMetrics.diskUsage?.used || 'N/A'}
                          </Typography>
                          <Typography variant="body1" gutterBottom>
                            <strong>Free Space:</strong> {latestMetrics.diskUsage?.freeRaw || latestMetrics.diskUsage?.free || 'N/A'}
                          </Typography>
                          <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                            Last updated: {latestMetrics ? new Date(latestMetrics.timestamp).toLocaleString() : 'N/A'}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
            </>
          )}
        </>
      )}
    </Box>
  );
};

export default Metrics; 