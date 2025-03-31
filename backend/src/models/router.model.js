'use strict';

module.exports = (sequelize, DataTypes) => {
  const Router = sequelize.define('Router', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true
      }
    },
    hostname: {
      type: DataTypes.STRING,
      allowNull: true
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    port: {
      type: DataTypes.INTEGER,
      defaultValue: 22
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    sshKey: {
      type: DataTypes.TEXT,
      defaultValue: ''
    },
    monitoringEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    metricsRetentionDays: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
      validate: {
        min: 1,
        max: 365
      }
    },
    lastSeen: {
      type: DataTypes.DATE,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('online', 'offline', 'unknown'),
      defaultValue: 'unknown'
    }
  }, {
    timestamps: true
  });

  Router.associate = (models) => {
    Router.hasMany(models.Metric, {
      foreignKey: 'routerId',
      as: 'metrics',
      onDelete: 'CASCADE'
    });
  };

  return Router;
}; 