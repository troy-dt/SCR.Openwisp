'use strict';

module.exports = (sequelize, DataTypes) => {
  const Metric = sequelize.define('Metric', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    routerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Routers',
        key: 'id'
      }
    },
    uptime: {
      type: DataTypes.STRING,
      allowNull: true
    },
    memoryUsage: {
      type: DataTypes.JSONB,
      defaultValue: {
        total: 0,
        free: 0,
        used: 0,
        percentage: 0
      },
      get() {
        return this.getDataValue('memoryUsage') || {
          total: 0,
          free: 0,
          used: 0,
          percentage: 0
        };
      }
    },
    cpuLoad: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    diskUsage: {
      type: DataTypes.JSONB,
      defaultValue: {
        total: 0,
        free: 0,
        used: 0,
        percentage: 0,
        totalRaw: '',
        freeRaw: '',
        usedRaw: ''
      },
      get() {
        return this.getDataValue('diskUsage') || {
          total: 0,
          free: 0,
          used: 0,
          percentage: 0,
          totalRaw: '',
          freeRaw: '',
          usedRaw: ''
        };
      }
    },
    networkInterfaces: {
      type: DataTypes.JSONB,
      defaultValue: [],
      get() {
        return this.getDataValue('networkInterfaces') || [];
      }
    },
    wirelessClients: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    timestamps: true,
    indexes: [
      {
        fields: ['routerId', 'timestamp']
      }
    ]
  });

  Metric.associate = (models) => {
    Metric.belongsTo(models.Router, {
      foreignKey: 'routerId',
      as: 'router'
    });
  };

  return Metric;
}; 