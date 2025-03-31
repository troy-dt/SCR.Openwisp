import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Divider,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { useTheme } from '../context/ThemeContext';

const Settings = () => {
  const { themeMode, toggleTheme } = useTheme();
  const [settings, setSettings] = useState({
    pollingInterval: 5,
    enableNotifications: true,
    notificationEmail: '',
    retentionPeriod: 30,
    connectionTimeout: 10
  });

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const handleSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings({
      ...settings,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSaveSettings = () => {
    // In a real app, this would save to the backend
    setSnackbar({
      open: true,
      message: 'Settings saved successfully',
      severity: 'success'
    });
  };

  const handleSnackbarClose = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };

  return (
    <Box mt={4}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Appearance Settings
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} sm={4}>
                <Typography variant="body1">Theme Mode</Typography>
              </Grid>
              <Grid item xs={12} sm={8}>
                <Box display="flex" alignItems="center">
                  <Brightness7Icon sx={{ color: 'warning.main', mr: 1 }} />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={themeMode === 'dark'}
                        onChange={toggleTheme}
                        color="primary"
                      />
                    }
                    label={themeMode === 'dark' ? 'Dark Mode' : 'Light Mode'}
                  />
                  <Brightness4Icon sx={{ color: 'text.secondary', ml: 1 }} />
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Monitoring Settings
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  name="pollingInterval"
                  label="Polling Interval (minutes)"
                  type="number"
                  fullWidth
                  value={settings.pollingInterval}
                  onChange={handleSettingsChange}
                  InputProps={{
                    inputProps: { min: 1, max: 60 }
                  }}
                  helperText="How often to collect metrics from routers (1-60 minutes)"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  name="connectionTimeout"
                  label="Connection Timeout (seconds)"
                  type="number"
                  fullWidth
                  value={settings.connectionTimeout}
                  onChange={handleSettingsChange}
                  InputProps={{
                    inputProps: { min: 5, max: 60 }
                  }}
                  helperText="Timeout for router connections (5-60 seconds)"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  name="retentionPeriod"
                  label="Data Retention Period (days)"
                  type="number"
                  fullWidth
                  value={settings.retentionPeriod}
                  onChange={handleSettingsChange}
                  InputProps={{
                    inputProps: { min: 1, max: 365 }
                  }}
                  helperText="How long to keep historical data (1-365 days)"
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Notification Settings
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      name="enableNotifications"
                      checked={settings.enableNotifications}
                      onChange={handleSettingsChange}
                      color="primary"
                    />
                  }
                  label="Enable Email Notifications"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  name="notificationEmail"
                  label="Notification Email"
                  type="email"
                  fullWidth
                  value={settings.notificationEmail}
                  onChange={handleSettingsChange}
                  helperText="Email address for router notifications"
                  disabled={!settings.enableNotifications}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="body2" color="textSecondary">
                  Notifications will be sent when:
                </Typography>
                <ul>
                  <li>A router goes offline</li>
                  <li>CPU usage exceeds 90%</li>
                  <li>Memory usage exceeds 90%</li>
                  <li>Disk usage exceeds 90%</li>
                </ul>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Actions
              </Typography>
              <Divider sx={{ mb: 3 }} />

              <Box display="flex" gap={2}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveSettings}
                >
                  Save Settings
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<RefreshIcon />}
                >
                  Update All Routers Now
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings; 