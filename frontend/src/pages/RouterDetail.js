import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Divider,
  Button,
  CircularProgress,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText
} from '@mui/material';
import { useRouters } from '../context/RouterContext';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HelpIcon from '@mui/icons-material/Help';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend
);

const RouterDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { routers, loading, collectMetrics, fetchRouterMetrics, testConnection, updateRouter } = useRouters();
  const [router, setRouter] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [collectingMetrics, setCollectingMetrics] = useState(false);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (routers.length > 0) {
      const foundRouter = routers.find(r => r._id === id);
      setRouter(foundRouter || null);
    }
  }, [id, routers]);

  useEffect(() => {
    const loadMetrics = async () => {
      if (id) {
        try {
          setRefreshing(true);
          const data = await fetchRouterMetrics(id, { limit: 24 });
          setMetrics(data);
          setError(null);
        } catch (err) {
          setError('Failed to load metrics. Please try again later.');
          console.error('Error loading metrics:', err);
        } finally {
          setRefreshing(false);
        }
      }
    };

    loadMetrics();
  }, [id, fetchRouterMetrics]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleTestConnection = async () => {
    if (!id) return;
    
    try {
      setTestingConnection(true);
      const result = await testConnection(id);
      setError(null);
    } catch (err) {
      setError('Failed to test connection. Please try again later.');
      console.error('Error testing connection:', err);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleCollectMetrics = async () => {
    if (!id) return;
    
    try {
      setCollectingMetrics(true);
      await collectMetrics(id);
      // Refresh metrics after collection
      const data = await fetchRouterMetrics(id, { limit: 24 });
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError('Failed to collect metrics. Please try again later.');
      console.error('Error collecting metrics:', err);
    } finally {
      setCollectingMetrics(false);
    }
  };

  // Handle form field changes for router updates
  const handleEditFormChange = async (e) => {
    try {
      const { name, value } = e.target;
      
      if (!router || !id) return;
      
      // Show updating indicator
      setUpdating(true);
      
      // Create updated router data with just the changed field
      const updatedRouter = {
        ...router,
        [name]: value
      };
      
      // Update the router in the backend
      const result = await updateRouter(id, updatedRouter);
      
      // Update local state
      setRouter(result);
      
      // Show success message
      setError(null);
    } catch (err) {
      setError('Failed to update router settings. Please try again.');
      console.error('Error updating router:', err);
    } finally {
      setUpdating(false);
    }
  };

  if (loading && !router) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!router) {
    return (
      <Box mt={4}>
        <Typography color="error" variant="h6">
          Router not found
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/routers')}
          sx={{ mt: 2 }}
        >
          Back to Routers
        </Button>
      </Box>
    );
  }

  // Prepare chart data for CPU load
  const cpuChartData = {
    labels: metrics.map(m => new Date(m.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'CPU Load',
        data: metrics.map(m => m.cpuLoad),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      }
    ],
  };

  // Prepare chart data for memory usage
  const memoryChartData = {
    labels: metrics.map(m => new Date(m.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'Memory Usage (%)',
        data: metrics.map(m => m.memoryUsage?.percentage || 0),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
      }
    ],
  };

  const chartOptions = {
    responsive: true,
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

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online':
        return <CheckCircleIcon fontSize="small" color="success" />;
      case 'offline':
        return <CancelIcon fontSize="small" color="error" />;
      default:
        return <HelpIcon fontSize="small" color="warning" />;
    }
  };

  return (
    <Box mt={4}>
      <Box display="flex" alignItems="center" mb={3}>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/routers')}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <Typography variant="h4">
          Router Details
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h5">{router.name}</Typography>
            <Box display="flex" alignItems="center" mt={1}>
              {getStatusIcon(router.status)}
              <Typography variant="body1" sx={{ ml: 1 }}>
                Status: {router.status.charAt(0).toUpperCase() + router.status.slice(1)}
              </Typography>
            </Box>
            <Typography variant="body1" color="textSecondary" mt={1}>
              IP Address: {router.ipAddress}
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Hostname: {router.hostname}
            </Typography>
            {router.lastSeen && (
              <Typography variant="body1" color="textSecondary">
                Last Seen: {new Date(router.lastSeen).toLocaleString()}
              </Typography>
            )}
          </Box>
          <Box>
            <Button 
              variant="outlined" 
              color="primary" 
              startIcon={<EditIcon />}
              onClick={() => navigate(`/routers/${id}/edit`)}
              sx={{ mr: 1 }}
            >
              Edit
            </Button>
            <Button 
              variant="outlined" 
              color="error" 
              startIcon={<DeleteIcon />}
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete router "${router.name}"?`)) {
                  // Delete router and navigate back
                  navigate('/routers');
                }
              }}
            >
              Delete
            </Button>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box display="flex" justifyContent="flex-start" gap={2}>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<RefreshIcon />}
            onClick={handleTestConnection}
            disabled={testingConnection}
          >
            {testingConnection ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button 
            variant="contained" 
            color="secondary" 
            startIcon={<RefreshIcon />}
            onClick={handleCollectMetrics}
            disabled={collectingMetrics}
          >
            {collectingMetrics ? 'Collecting...' : 'Collect Metrics Now'}
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Overview" />
            <Tab label="Performance" />
            <Tab label="Network" />
          </Tabs>
        </Box>

        {/* Overview Tab */}
        {tabValue === 0 && (
          <Box mt={3}>
            {refreshing ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : metrics.length === 0 ? (
              <Typography variant="body1" color="textSecondary" align="center">
                No metrics available. Click "Collect Metrics Now" to get started.
              </Typography>
            ) : (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        System Information
                      </Typography>
                      <List dense>
                        <ListItem>
                          <ListItemText 
                            primary="Uptime" 
                            secondary={metrics[0]?.uptime || 'N/A'} 
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="CPU Load" 
                            secondary={`${metrics[0]?.cpuLoad?.toFixed(2) || 'N/A'}`} 
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Memory Usage" 
                            secondary={`${metrics[0]?.memoryUsage?.percentage || 0}% (${metrics[0]?.memoryUsage?.used || 0}KB / ${metrics[0]?.memoryUsage?.total || 0}KB)`} 
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Disk Usage" 
                            secondary={`${metrics[0]?.diskUsage?.percentage || 0}% (${metrics[0]?.diskUsage?.used || 'N/A'} / ${metrics[0]?.diskUsage?.total || 'N/A'})`} 
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Wireless Clients" 
                            secondary={metrics[0]?.wirelessClients || 0} 
                          />
                        </ListItem>
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Latest Metrics
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Last Updated: {metrics[0] ? new Date(metrics[0].timestamp).toLocaleString() : 'N/A'}
                      </Typography>
                      <Box mt={2}>
                        {metrics[0]?.networkInterfaces && metrics[0].networkInterfaces.length > 0 ? (
                          <div>
                            <Typography variant="subtitle1">Network Interfaces:</Typography>
                            <List dense>
                              {metrics[0].networkInterfaces.map((iface, idx) => (
                                <ListItem key={idx}>
                                  <ListItemText 
                                    primary={iface.name} 
                                    secondary={`IP: ${iface.ipAddress || 'N/A'}, MAC: ${iface.macAddress || 'N/A'}`}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </div>
                        ) : (
                          <Typography variant="body2">No network interfaces information available</Typography>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </Box>
        )}

        {/* Performance Tab */}
        {tabValue === 1 && (
          <Box mt={3}>
            {refreshing ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : metrics.length === 0 ? (
              <Typography variant="body1" color="textSecondary" align="center">
                No metrics available. Click "Collect Metrics Now" to get started.
              </Typography>
            ) : (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        CPU Load Over Time
                      </Typography>
                      <Box height={300}>
                        <Line options={chartOptions} data={cpuChartData} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Memory Usage Over Time
                      </Typography>
                      <Box height={300}>
                        <Line options={chartOptions} data={memoryChartData} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </Box>
        )}

        {/* Network Tab */}
        {tabValue === 2 && (
          <Box mt={3}>
            {refreshing ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : metrics.length === 0 ? (
              <Typography variant="body1" color="textSecondary" align="center">
                No metrics available. Click "Collect Metrics Now" to get started.
              </Typography>
            ) : (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Network Interfaces
                      </Typography>
                      
                      {metrics[0]?.networkInterfaces && metrics[0].networkInterfaces.length > 0 ? (
                        <List>
                          {metrics[0].networkInterfaces.map((iface, idx) => (
                            <ListItem key={idx} divider={idx < metrics[0].networkInterfaces.length - 1}>
                              <ListItemText 
                                primary={
                                  <Box display="flex" alignItems="center">
                                    <Typography variant="subtitle1">{iface.name}</Typography>
                                    <Typography 
                                      variant="body2" 
                                      color="textSecondary"
                                      sx={{ ml: 2 }}
                                    >
                                      ({iface.status})
                                    </Typography>
                                  </Box>
                                }
                                secondary={
                                  <>
                                    <Typography variant="body2">IP Address: {iface.ipAddress || 'N/A'}</Typography>
                                    <Typography variant="body2">MAC Address: {iface.macAddress || 'N/A'}</Typography>
                                    <Typography variant="body2">
                                      RX: {iface.rxBytes ? `${(iface.rxBytes / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
                                      {' | '}
                                      TX: {iface.txBytes ? `${(iface.txBytes / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
                                    </Typography>
                                  </>
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                      ) : (
                        <Typography variant="body1" color="textSecondary" align="center">
                          No network interfaces information available
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Wireless Clients
                      </Typography>
                      <Typography variant="h4" align="center" my={3}>
                        {metrics[0]?.wirelessClients || 0}
                      </Typography>
                      <Typography variant="body2" color="textSecondary" align="center">
                        Connected devices
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 3, mt: 3 }}>
        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel id="retention-label">Metrics Retention Period</InputLabel>
          <Select
            labelId="retention-label"
            id="metricsRetentionDays"
            name="metricsRetentionDays"
            value={router?.metricsRetentionDays || 30}
            label="Metrics Retention Period"
            onChange={(e) => handleEditFormChange(e)}
            disabled={updating}
          >
            <MenuItem value={7}>7 days</MenuItem>
            <MenuItem value={14}>14 days</MenuItem>
            <MenuItem value={30}>30 days</MenuItem>
            <MenuItem value={60}>60 days</MenuItem>
            <MenuItem value={90}>90 days</MenuItem>
            <MenuItem value={180}>180 days</MenuItem>
            <MenuItem value={365}>365 days</MenuItem>
          </Select>
          <FormHelperText>
            {updating 
              ? 'Updating retention period...'
              : 'How long to keep metrics data for this router'
            }
          </FormHelperText>
        </FormControl>
      </Paper>
    </Box>
  );
};

export default RouterDetail; 