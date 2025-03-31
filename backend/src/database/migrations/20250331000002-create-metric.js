'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Metrics', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      routerId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Routers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      uptime: {
        type: Sequelize.STRING,
        allowNull: true
      },
      memoryUsage: {
        type: Sequelize.JSONB,
        defaultValue: {
          total: 0,
          free: 0,
          used: 0,
          percentage: 0
        }
      },
      cpuLoad: {
        type: Sequelize.FLOAT,
        defaultValue: 0
      },
      diskUsage: {
        type: Sequelize.JSONB,
        defaultValue: {
          total: 0,
          free: 0,
          used: 0,
          percentage: 0,
          totalRaw: '',
          freeRaw: '',
          usedRaw: ''
        }
      },
      networkInterfaces: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      wirelessClients: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
    
    // Add index for faster querying by routerId and timestamp
    await queryInterface.addIndex('Metrics', ['routerId', 'timestamp']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Metrics');
  }
}; 