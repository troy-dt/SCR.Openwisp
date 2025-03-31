import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';

// Components
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';

// Pages
import Dashboard from './pages/Dashboard';
import RouterList from './pages/RouterList';
import RouterDetail from './pages/RouterDetail';
import AddRouter from './pages/AddRouter';
import Settings from './pages/Settings';
import Metrics from './pages/Metrics';

function App() {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Router>
      <Box sx={{ display: 'flex' }}>
        <Navbar onDrawerToggle={handleDrawerToggle} />
        <Sidebar 
          mobileOpen={mobileOpen}
          onDrawerToggle={handleDrawerToggle}
        />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            width: { sm: `calc(100% - 240px)` },
            ml: { sm: '240px' },
            mt: '64px'
          }}
        >
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/routers" element={<RouterList />} />
            <Route path="/routers/:id" element={<RouterDetail />} />
            <Route path="/routers/add" element={<AddRouter />} />
            <Route path="/metrics" element={<Metrics />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Box>
      </Box>
    </Router>
  );
}

export default App; 