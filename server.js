/**
 * DELIVER OS — META-AI CEO
 * Main Server Entry Point
 * Production-Grade Autonomous Logistics Backend
 */

'use strict';

require('dotenv').config();
require('express-async-errors');

const http = require('http');
const path = require('path');
const app = require('./app');
const { connectMongo } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { initSocket } = require('./core/socket');
const { startAllSimulators } = require('./core/simulators');
const { startCronJobs } = require('./cron');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Serve frontend HTML files from /public folder
app.use(require('express').static(path.join(__dirname, '../public')));

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = initSocket(server);

// Make io accessible app-wide
app.set('io', io);

/**
 * Boot sequence — connects all systems in order
 */
async function boot() {
  try {
    logger.info('🚀 [META-AI CEO] Boot sequence initiated...');

    // 1. Connect MongoDB
    await connectMongo();
    logger.info('✅ [MONGO] Database connected');

    // 2. Connect Redis
    await connectRedis();
    logger.info('✅ [REDIS] Cache layer connected');

    // 3. Start HTTP server
    server.listen(PORT, HOST, () => {
      logger.info(`✅ [SERVER] Listening on http://${HOST}:${PORT}`);
      logger.info(`✅ [ENV] Mode: ${process.env.NODE_ENV || 'development'}`);
    });

    // 4. Start AI simulators (real-time event engines)
    startAllSimulators(io);
    logger.info('✅ [AI-ENGINE] All 6 AI simulators online');

    // 5. Start cron jobs
    startCronJobs(io);
    logger.info('✅ [CRON] Scheduled jobs active');

    logger.info('🧠 [META-AI CEO] All systems ONLINE — Autonomous operations active');
  } catch (err) {
    logger.error(`❌ [BOOT] Fatal error: ${err.message}`);
    process.exit(1);
  }
}

// ── Graceful Shutdown ─────────────────────────────────────────
const shutdown = (signal) => {
  logger.warn(`⚠️  [SHUTDOWN] ${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info('✅ [SERVER] HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('❌ [SHUTDOWN] Forced exit after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error(`❌ [UNCAUGHT] ${err.message}\n${err.stack}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`❌ [UNHANDLED] ${reason}`);
  process.exit(1);
});

// Boot the system
boot();