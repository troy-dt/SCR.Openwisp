const mongoose = require('mongoose');

const RouterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  hostname: {
    type: String,
    required: true,
    trim: true
  },
  ipAddress: {
    type: String,
    required: true,
    trim: true
  },
  port: {
    type: Number,
    default: 22
  },
  username: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  sshKey: {
    type: String,
    default: ''
  },
  monitoringEnabled: {
    type: Boolean,
    default: true
  },
  metricsRetentionDays: {
    type: Number,
    default: 30,
    min: 1,
    max: 365
  },
  lastSeen: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'unknown'],
    default: 'unknown'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Router', RouterSchema); 