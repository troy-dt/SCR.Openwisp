require('dotenv').config();

const parseDbUrl = (dbUrl) => {
  if (!dbUrl) {
    return null;
  }
  
  // Parse PostgreSQL connection URL
  // Format: postgres://username:password@host:port/database
  const regex = /postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
  const matches = dbUrl.match(regex);
  
  if (!matches || matches.length !== 6) {
    throw new Error('Invalid DATABASE_URL format. Expected: postgres://username:password@host:port/database');
  }
  
  return {
    username: matches[1],
    password: matches[2],
    host: matches[3],
    port: parseInt(matches[4], 10),
    database: matches[5],
    dialect: 'postgres'
  };
};

// Default config
const defaultConfig = {
  username: 'postgres',
  password: 'postgres',
  database: 'openwisp',
  host: 'postgres',
  port: 5432,
  dialect: 'postgres',
  logging: false
};

// Parse from DATABASE_URL if available
const dbConfig = parseDbUrl(process.env.DATABASE_URL) || defaultConfig;

module.exports = {
  development: {
    ...dbConfig,
    dialect: 'postgres',
    logging: console.log
  },
  test: {
    ...dbConfig,
    dialect: 'postgres',
    database: 'openwisp_test',
    logging: false
  },
  production: {
    ...dbConfig,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
}; 