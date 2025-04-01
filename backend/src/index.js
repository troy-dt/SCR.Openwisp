const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const logger = require('./utils/logger');
const { sequelize } = require('./models');
const routerRoutes = require('./routes/router.routes');
const scannerRoutes = require('./routes/scanner.routes');

// Load environment variables
dotenv.config();

// Initialize the Express application
const app = express();

// Set up CORS middleware - allow all origins for development
app.use(cors({
  origin: true, // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'X-Scanner-Request', 
    'X-Direct-Connection',
    'Accept',
    'Authorization'
  ],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  credentials: false,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Add CORS headers to all responses for maximum compatibility
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Scanner-Request, X-Direct-Connection, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Parse JSON request body
app.use(express.json());

// Log all incoming requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API Routes
app.use('/api/routers', routerRoutes);
app.use('/api/scanner', scannerRoutes);

// Debug: Log all registered routes
logger.info('Registered Routes:');
const printRoutes = (stack, basePath = '') => {
  stack.forEach(layer => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase()).join(',');
      logger.info(`${methods} ${basePath}${layer.route.path}`);
    } else if (layer.name === 'router' && layer.handle.stack) {
      const newBase = basePath + (layer.regexp.toString().indexOf('/api') > -1 ? '/api' : '');
      printRoutes(layer.handle.stack, newBase);
    }
  });
};
printRoutes(app._router.stack);

// Connect to database and start server
sequelize.sync()
  .then(() => {
    logger.info('Database synchronized successfully');
    
    // Start the Express server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    logger.error(`Database synchronization error: ${err.message}`);
    process.exit(1);
  }); 