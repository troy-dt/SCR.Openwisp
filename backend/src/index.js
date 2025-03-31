const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const routerRoutes = require('./routes/router.routes');
const cronJobs = require('./utils/cron');
const logger = require('./utils/logger');
const { sequelize } = require('./models');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/routers', routerRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Connect to database and start server
sequelize.authenticate()
  .then(() => {
    logger.info('Connected to PostgreSQL database');
    
    // Start the server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
    
    // Start cron jobs
    cronJobs.startAll();
  })
  .catch(err => {
    logger.error(`Database connection error: ${err.message}`);
    process.exit(1);
  }); 