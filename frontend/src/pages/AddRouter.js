import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment
} from '@mui/material';
import { useRouters } from '../context/RouterContext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

const AddRouter = () => {
  const { addRouter } = useRouters();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    hostname: '',
    ipAddress: '',
    port: 22,
    username: 'root',
    password: '',
    sshKey: '',
    monitoringEnabled: true
  });

  const [formErrors, setFormErrors] = useState({
    name: '',
    hostname: '',
    ipAddress: '',
    port: '',
    username: '',
    password: ''
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
    
    // Clear error when field is edited
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: ''
      });
    }
  };

  const validateForm = () => {
    let isValid = true;
    const errors = {};

    // Validate name
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
      isValid = false;
    }

    // Validate hostname
    if (!formData.hostname.trim()) {
      errors.hostname = 'Hostname is required';
      isValid = false;
    }

    // Validate IP address
    if (!formData.ipAddress.trim()) {
      errors.ipAddress = 'IP address is required';
      isValid = false;
    } else {
      // Simple IP validation
      const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
      if (!ipRegex.test(formData.ipAddress)) {
        errors.ipAddress = 'Invalid IP address format';
        isValid = false;
      }
    }

    // Validate port
    if (!formData.port) {
      errors.port = 'Port is required';
      isValid = false;
    } else if (formData.port < 1 || formData.port > 65535) {
      errors.port = 'Port must be between 1 and 65535';
      isValid = false;
    }

    // Validate username
    if (!formData.username.trim()) {
      errors.username = 'Username is required';
      isValid = false;
    }

    // Validate password (required if SSH key is not provided)
    if (!formData.password && !formData.sshKey) {
      errors.password = 'Either password or SSH key is required';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await addRouter(formData);
      navigate('/routers');
    } catch (error) {
      setError('Failed to add router. Please check your inputs and try again.');
      console.error('Error adding router:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
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
          Add Router
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper component="form" onSubmit={handleSubmit} sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="h6">Router Information</Typography>
            <Divider sx={{ my: 1 }} />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              name="name"
              label="Router Name"
              fullWidth
              required
              value={formData.name}
              onChange={handleChange}
              error={!!formErrors.name}
              helperText={formErrors.name}
              disabled={loading}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              name="hostname"
              label="Hostname"
              fullWidth
              required
              value={formData.hostname}
              onChange={handleChange}
              error={!!formErrors.hostname}
              helperText={formErrors.hostname}
              disabled={loading}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              name="ipAddress"
              label="IP Address"
              fullWidth
              required
              value={formData.ipAddress}
              onChange={handleChange}
              error={!!formErrors.ipAddress}
              helperText={formErrors.ipAddress}
              disabled={loading}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              name="port"
              label="SSH Port"
              type="number"
              fullWidth
              required
              value={formData.port}
              onChange={handleChange}
              error={!!formErrors.port}
              helperText={formErrors.port || 'Default: 22'}
              disabled={loading}
              InputProps={{
                inputProps: { min: 1, max: 65535 }
              }}
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mt: 2 }}>Authentication</Typography>
            <Divider sx={{ my: 1 }} />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              name="username"
              label="Username"
              fullWidth
              required
              value={formData.username}
              onChange={handleChange}
              error={!!formErrors.username}
              helperText={formErrors.username || 'Default: root'}
              disabled={loading}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              value={formData.password}
              onChange={handleChange}
              error={!!formErrors.password}
              helperText={formErrors.password || 'Required if SSH key is not provided'}
              disabled={loading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={togglePasswordVisibility}
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              name="sshKey"
              label="SSH Private Key (Optional)"
              multiline
              rows={4}
              fullWidth
              value={formData.sshKey}
              onChange={handleChange}
              disabled={loading}
              helperText="Paste your private key here (optional). If provided, password will be ignored."
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mt: 2 }}>Monitoring Settings</Typography>
            <Divider sx={{ my: 1 }} />
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  name="monitoringEnabled"
                  checked={formData.monitoringEnabled}
                  onChange={handleChange}
                  disabled={loading}
                  color="primary"
                />
              }
              label="Enable Monitoring"
            />
          </Grid>

          <Grid item xs={12} sx={{ mt: 3 }}>
            <Box display="flex" justifyContent="space-between">
              <Button
                variant="outlined"
                onClick={() => navigate('/routers')}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                startIcon={loading ? <CircularProgress size={24} /> : <SaveIcon />}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Router'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default AddRouter; 