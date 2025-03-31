import React from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  IconButton, 
  Box,
  Button,
  useMediaQuery
} from '@mui/material';
import { styled, useTheme as useMuiTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import RouterIcon from '@mui/icons-material/Router';
import { useNavigate } from 'react-router-dom';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { useTheme as useAppTheme } from '../context/ThemeContext';

function Navbar({ onDrawerToggle }) {
  const theme = useMuiTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const { themeMode, toggleTheme } = useAppTheme();

  return (
    <AppBar 
      position="fixed" 
      sx={{ 
        zIndex: (theme) => theme.zIndex.drawer + 1,
        background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={onDrawerToggle}
          sx={{ mr: 2, display: { sm: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        
        <Box display="flex" alignItems="center" sx={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <RouterIcon sx={{ mr: 1 }} />
          <Typography variant="h6" noWrap component="div">
            OpenWrt Monitor
          </Typography>
        </Box>
        
        <Box sx={{ flexGrow: 1 }} />
        
        {!isMobile && (
          <Box display="flex" gap={2}>
            <Button color="inherit" onClick={() => navigate('/routers')}>
              Routers
            </Button>
            <Button color="inherit" onClick={() => navigate('/routers/add')}>
              Add Router
            </Button>
            <Button color="inherit" onClick={() => navigate('/metrics')}>
              Metrics
            </Button>
            <Button color="inherit" onClick={() => navigate('/settings')}>
              Settings
            </Button>
          </Box>
        )}
        
        <IconButton color="inherit" onClick={toggleTheme} aria-label="toggle theme">
          {themeMode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}

export default Navbar; 