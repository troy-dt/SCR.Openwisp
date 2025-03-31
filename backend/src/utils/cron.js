const { CronJob } = require('cron');
const Router = require('../models/router.model');
const Metric = require('../models/metric.model');
const sshClient = require('./ssh');
const logger = require('./logger');

// Available collection intervals (in cron syntax)
const COLLECTION_INTERVALS = {
  EVERY_MINUTE: '* * * * *',        // Every minute (for testing/development)
  EVERY_5_MINUTES: '*/5 * * * *',   // Every 5 minutes
  EVERY_15_MINUTES: '*/15 * * * *', // Every 15 minutes
  EVERY_30_MINUTES: '*/30 * * * *', // Every 30 minutes
  HOURLY: '0 * * * *',              // Every hour
  DAILY: '0 0 * * *'                // Once a day at midnight
};

// Default collection interval
const DEFAULT_INTERVAL = COLLECTION_INTERVALS.EVERY_5_MINUTES;

// Current collection interval (can be changed at runtime)
let currentInterval = process.env.METRICS_COLLECTION_INTERVAL || DEFAULT_INTERVAL;

// Collect metrics for all routers
const collectAllMetrics = async () => {
  try {
    logger.info('Starting scheduled metrics collection for all routers');
    
    // Get all routers with monitoring enabled
    const routers = await Router.find({ monitoringEnabled: true });
    
    if (routers.length === 0) {
      logger.info('No routers found for monitoring');
      return;
    }
    
    // Collect metrics for each router
    const results = await Promise.allSettled(
      routers.map(async (router) => {
        try {
          // Collect metrics
          const metrics = await sshClient.collectMetrics(router);
          
          if (!metrics) {
            // Update router status to offline
            router.status = 'offline';
            await router.save();
            
            logger.warn(`Failed to collect metrics for router ${router.name}`);
            return;
          }
          
          // Update router status to online
          router.status = 'online';
          router.lastSeen = new Date();
          await router.save();
          
          // Save the metrics
          const metric = new Metric({
            routerId: router._id,
            ...metrics,
            timestamp: new Date()
          });
          
          await metric.save();
          
          logger.info(`Successfully collected metrics for router ${router.name}`);
        } catch (error) {
          logger.error(`Error in metrics collection for router ${router.name}: ${error.message}`);
        }
      })
    );
    
    // Log summary
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    logger.info(`Metrics collection complete. Success: ${successful}, Failed: ${failed}`);
  } catch (error) {
    logger.error(`Error in scheduled metrics collection: ${error.message}`);
  }
};

// Cleanup old metrics data based on retention settings
const cleanupOldMetrics = async () => {
  try {
    logger.info('Starting scheduled cleanup of old metrics');
    
    // Get all routers
    const routers = await Router.find();
    
    if (routers.length === 0) {
      logger.info('No routers found for metrics cleanup');
      return;
    }
    
    // Clean up metrics for each router based on retention period
    const results = await Promise.allSettled(
      routers.map(async (router) => {
        try {
          const retentionDays = router.metricsRetentionDays || 30;
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
          
          // Delete metrics older than the retention period
          const deleteResult = await Metric.deleteMany({
            routerId: router._id,
            timestamp: { $lt: cutoffDate }
          });
          
          logger.info(`Cleaned up ${deleteResult.deletedCount} old metrics for router ${router.name} (retention: ${retentionDays} days)`);
          return deleteResult.deletedCount;
        } catch (error) {
          logger.error(`Error cleaning up metrics for router ${router.name}: ${error.message}`);
          throw error;
        }
      })
    );
    
    // Log summary
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const totalDeleted = results
      .filter(r => r.status === 'fulfilled')
      .reduce((sum, r) => sum + r.value, 0);
    
    logger.info(`Metrics cleanup complete. Success: ${successful}, Failed: ${failed}, Total deleted: ${totalDeleted}`);
  } catch (error) {
    logger.error(`Error in scheduled metrics cleanup: ${error.message}`);
  }
};

// Define cron jobs
let metricsCollectionJob = new CronJob(currentInterval, collectAllMetrics, null, false);
let metricsCleanupJob = new CronJob('0 1 * * *', cleanupOldMetrics, null, false); // Run daily at 1 AM

// Start all cron jobs
exports.startAll = () => {
  if (!metricsCollectionJob.running) {
    metricsCollectionJob.start();
  }
  
  if (!metricsCleanupJob.running) {
    metricsCleanupJob.start();
  }
  
  logger.info(`All cron jobs started. Metrics collection scheduled: ${currentInterval}`);
};

// Stop all cron jobs
exports.stopAll = () => {
  if (metricsCollectionJob.running) {
    metricsCollectionJob.stop();
  }
  
  if (metricsCleanupJob.running) {
    metricsCleanupJob.stop();
  }
  
  logger.info('All cron jobs stopped');
};

// Update metrics collection interval
exports.updateCollectionInterval = (interval) => {
  if (!COLLECTION_INTERVALS[interval] && !Object.values(COLLECTION_INTERVALS).includes(interval)) {
    logger.error(`Invalid collection interval: ${interval}`);
    return false;
  }
  
  // Stop current job
  if (metricsCollectionJob.running) {
    metricsCollectionJob.stop();
  }
  
  // Update interval
  currentInterval = COLLECTION_INTERVALS[interval] || interval;
  
  // Create new job with updated interval
  metricsCollectionJob = new CronJob(currentInterval, collectAllMetrics, null, false);
  
  // Start new job
  metricsCollectionJob.start();
  
  logger.info(`Metrics collection interval updated to: ${currentInterval}`);
  return true;
};

// Get collection interval
exports.getCollectionInterval = () => currentInterval;

// Get available intervals
exports.getAvailableIntervals = () => COLLECTION_INTERVALS;

// Get status of all cron jobs
exports.getStatus = () => {
  return {
    metricsCollection: {
      running: metricsCollectionJob.running,
      cronTime: metricsCollectionJob.cronTime.source,
      nextDate: metricsCollectionJob.nextDate()
    },
    metricsCleanup: {
      running: metricsCleanupJob.running,
      cronTime: metricsCleanupJob.cronTime.source,
      nextDate: metricsCleanupJob.nextDate()
    }
  };
}; 