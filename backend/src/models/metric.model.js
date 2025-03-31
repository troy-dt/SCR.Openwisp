const mongoose = require('mongoose');

const MetricSchema = new mongoose.Schema({
  routerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Router',
    required: true
  },
  uptime: {
    type: String,
    default: null
  },
  memoryUsage: {
    total: {
      type: Number,
      default: 0
    },
    free: {
      type: Number,
      default: 0
    },
    used: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    }
  },
  cpuLoad: {
    type: Number,
    default: 0
  },
  diskUsage: {
    total: {
      type: Number,
      default: 0
    },
    free: {
      type: Number,
      default: 0
    },
    used: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    },
    // Raw string values for display purposes
    totalRaw: {
      type: String,
      default: ''
    },
    freeRaw: {
      type: String,
      default: ''
    },
    usedRaw: {
      type: String,
      default: ''
    }
  },
  networkInterfaces: [{
    name: String,
    ipAddress: String,
    macAddress: String,
    rxBytes: Number,
    txBytes: Number,
    status: String
  }],
  wirelessClients: {
    type: Number,
    default: 0
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Metric', MetricSchema); 