// Simple script to log all registered routes in the Express app
const express = require('express');
const app = express();

// Mock dependencies for minimalistic testing
app.use(express.json());

// Import our routes
const routerRoutes = require('./src/routes/router.routes');
const scannerRoutes = require('./src/routes/scanner.routes');

// Register routes as the application would
app.use('/api/routers', routerRoutes);
app.use('/api/scanner', scannerRoutes);

// Print all registered routes
const listRoutes = () => {
  // Helper function to get all registered routes
  const getRoutes = (stack, basePath = '') => {
    const routes = [];
    stack.forEach((middleware) => {
      if (middleware.route) {
        // This is a route middleware
        const methods = Object.keys(middleware.route.methods).map(m => m.toUpperCase()).join(',');
        routes.push({
          path: basePath + middleware.route.path,
          methods: methods
        });
      } else if (middleware.name === 'router') {
        // This is a router middleware
        const routerBasePath = basePath + (middleware.regexp.toString().indexOf('\\/') === 1 
          ? middleware.regexp.toString().slice(1, -2).replace(/\\\\/g, '/')
          : '');
        routes.push(...getRoutes(middleware.handle.stack, routerBasePath));
      }
    });
    return routes;
  };

  const routes = getRoutes(app._router.stack);
  console.log('Registered routes:');
  routes.forEach((route) => {
    console.log(`${route.methods} ${route.path}`);
  });
};

listRoutes(); 