import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Grid, 
  Paper, 
  Typography, 
  Card, 
  CardContent,
  CircularProgress,
  Divider
} from '@mui/material';
import { useRouters } from '../context/RouterContext';
import RouterIcon from '@mui/icons-material/Router';
import SignalWifiStatusbar4BarIcon from '@mui/icons-material/SignalWifiStatusbar4Bar';
import SignalWifiOffIcon from '@mui/icons-material/SignalWifiOff';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import DevicesIcon from '@mui/icons-material/Devices';

const Dashboard = () => {
  const { routers, loading, error, summary, fetchSummary } = useRouters();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setRefreshing(true);
      try {
        await fetchSummary();
      } catch (error) {
        console.error('Error fetching summary:', error);
      } finally {
        setRefreshing(false);
      }
    };

    fetchData();
  }, [fetchSummary]);

  if (loading && !refreshing) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box mt={4}>
        <Typography color="error" variant="h6">
          {error}
        </Typography>
      </Box>
    );
  }

  return (
    <Box mt={4}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={3} mt={1}>
        {/* Summary Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <RouterIcon fontSize="large" color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h5">{summary.totalRouters}</Typography>
                  <Typography variant="body2" color="textSecondary">Total Routers</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <SignalWifiStatusbar4BarIcon fontSize="large" color="success" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h5">{summary.onlineRouters}</Typography>
                  <Typography variant="body2" color="textSecondary">Online Routers</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <SignalWifiOffIcon fontSize="large" color="error" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h5">{summary.offlineRouters}</Typography>
                  <Typography variant="body2" color="textSecondary">Offline Routers</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <DevicesIcon fontSize="large" color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h5">{summary.totalClients || 0}</Typography>
                  <Typography variant="body2" color="textSecondary">Connected Clients</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Router Status Overview */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Router Status Overview
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              {routers.map((router) => (
                <Grid item xs={12} sm={6} md={4} key={router._id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" alignItems="center">
                        {router.status === 'online' ? (
                          <SignalWifiStatusbar4BarIcon color="success" sx={{ mr: 1 }} />
                        ) : router.status === 'offline' ? (
                          <SignalWifiOffIcon color="error" sx={{ mr: 1 }} />
                        ) : (
                          <QuestionMarkIcon color="warning" sx={{ mr: 1 }} />
                        )}
                        <Typography variant="h6">{router.name}</Typography>
                      </Box>
                      <Typography variant="body2" color="textSecondary">
                        {router.ipAddress}
                      </Typography>
                      <Typography variant="body2">
                        Status: {router.status.charAt(0).toUpperCase() + router.status.slice(1)}
                      </Typography>
                      {router.lastSeen && (
                        <Typography variant="body2" color="textSecondary">
                          Last seen: {new Date(router.lastSeen).toLocaleString()}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              
              {routers.length === 0 && (
                <Grid item xs={12}>
                  <Typography variant="body1" color="textSecondary" align="center">
                    No routers found. Add a router to start monitoring.
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard; 