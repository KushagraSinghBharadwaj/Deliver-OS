/**
 * MongoDB Connection Config
 * Auto-reconnect, connection pooling, production-ready
 */

'use strict';

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/deliver_os';

const options = {
  maxPoolSize: parseInt(process.env.MONGO_POOL_SIZE) || 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4, // Use IPv4
};

let isConnected = false;

async function connectMongo() {
  if (isConnected) return;

  mongoose.set('strictQuery', true);

  // Connection event listeners
  mongoose.connection.on('connected', () => {
    isConnected = true;
    logger.info(`[MONGO] Connected to: ${MONGO_URI}`);
  });

  mongoose.connection.on('error', (err) => {
    logger.error(`[MONGO] Connection error: ${err.message}`);
    isConnected = false;
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('[MONGO] Disconnected — attempting auto-reconnect...');
    isConnected = false;
    // Auto-reconnect after 3 seconds
    setTimeout(() => {
      connectMongo().catch(err =>
        logger.error(`[MONGO] Reconnect failed: ${err.message}`)
      );
    }, 3000);
  });

  await mongoose.connect(MONGO_URI, options);
}

async function disconnectMongo() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info('[MONGO] Disconnected cleanly');
}

function getConnectionStatus() {
  return {
    isConnected,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    name: mongoose.connection.name
  };
}

module.exports = { connectMongo, disconnectMongo, getConnectionStatus };