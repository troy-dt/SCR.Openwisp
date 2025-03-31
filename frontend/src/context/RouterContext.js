import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

// Create context
const RouterContext = createContext();

// API base URL - ensure this is always localhost for browser access
const API_URL = 'http://localhost:5000/api';

// Create axios instance with proper base URL
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  }
});

export function RouterProvider({ children }) {
  const [routers, setRouters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState({
    totalRouters: 0,
    onlineRouters: 0,
    offlineRouters: 0,
    unknownRouters: 0,
    totalClients: 0
  });

  // Fetch all routers
  const fetchRouters = async () => {
    try {
      setLoading(true);
      const response = await api.get('/routers');
      setRouters(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch routers. Please try again later.');
      console.error('Error fetching routers:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch dashboard summary
  const fetchSummary = async () => {
    try {
      const response = await api.get('/routers/metrics/summary');
      setSummary(response.data);
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  };

  // Add a router
  const addRouter = async (routerData) => {
    try {
      setLoading(true);
      const response = await api.post('/routers', routerData);
      setRouters([...routers, response.data]);
      setError(null);
      return response.data;
    } catch (err) {
      setError('Failed to add router. Please check your inputs and try again.');
      console.error('Error adding router:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update a router
  const updateRouter = async (id, routerData) => {
    try {
      setLoading(true);
      const response = await api.put(`/routers/${id}`, routerData);
      setRouters(routers.map(router => 
        router.id === id ? response.data : router
      ));
      setError(null);
      return response.data;
    } catch (err) {
      setError('Failed to update router. Please try again later.');
      console.error('Error updating router:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Delete a router
  const deleteRouter = async (id) => {
    try {
      setLoading(true);
      await api.delete(`/routers/${id}`);
      setRouters(routers.filter(router => router.id !== id));
      setError(null);
    } catch (err) {
      setError('Failed to delete router. Please try again later.');
      console.error('Error deleting router:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Test router connection
  const testConnection = async (id) => {
    try {
      const response = await api.post(`/routers/${id}/test-connection`);
      // Update router status in the local state
      setRouters(routers.map(router => {
        if (router.id === id) {
          return {
            ...router,
            status: response.data.success ? 'online' : 'offline',
            lastSeen: response.data.success ? new Date() : router.lastSeen
          };
        }
        return router;
      }));
      return response.data;
    } catch (err) {
      console.error('Error testing connection:', err);
      throw err;
    }
  };

  // Collect metrics for a router
  const collectMetrics = async (id) => {
    try {
      const response = await api.post(`/routers/${id}/collect-metrics`);
      return response.data;
    } catch (err) {
      console.error('Error collecting metrics:', err);
      throw err;
    }
  };

  // Fetch metrics for a router
  const fetchRouterMetrics = async (id, params = {}) => {
    try {
      const response = await api.get(`/routers/${id}/metrics`, { params });
      return response.data;
    } catch (err) {
      console.error('Error fetching router metrics:', err);
      throw err;
    }
  };

  // Load initial data
  useEffect(() => {
    fetchRouters();
    fetchSummary();
    
    // Poll for updates every minute
    const intervalId = setInterval(() => {
      fetchRouters();
      fetchSummary();
    }, 60000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Value to be provided to consumers
  const value = {
    routers,
    loading,
    error,
    summary,
    fetchRouters,
    fetchSummary,
    addRouter,
    updateRouter,
    deleteRouter,
    testConnection,
    collectMetrics,
    fetchRouterMetrics
  };

  return (
    <RouterContext.Provider value={value}>
      {children}
    </RouterContext.Provider>
  );
}

// Custom hook to use the RouterContext
export function useRouters() {
  const context = useContext(RouterContext);
  if (context === undefined) {
    throw new Error('useRouters must be used within a RouterProvider');
  }
  return context;
} 