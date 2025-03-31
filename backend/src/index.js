const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const routerRoutes = require('./routes/router.routes');
const cronJobs = require('./utils/cron');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://db:27017/openwisp';

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/routers', routerRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Connect to MongoDB
mongoose.connect(DATABASE_URL)
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
    
    // Start cron jobs
    cronJobs.startAll();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  }); 