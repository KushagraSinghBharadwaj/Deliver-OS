/**
 * DELIVER OS — Cron Jobs
 * Scheduled tasks: daily stats reset, stale order cleanup,
 * rider shift management, report generation
 */

'use strict';

const cron = require('node-cron');
const { Rider, Order, Warehouse, AiLog } = require('../models');
const logger = require('../utils/logger');

function startCronJobs(io) {
  // ── Reset rider daily stats at midnight ─────────────────────
  cron.schedule('0 0 * * *', async () => {
    try {
      await Rider.updateMany({}, { $set: { 'stats.todayDeliveries': 0 } });
      logger.info('[CRON] Daily rider stats reset');
    } catch (err) {
      logger.error(`[CRON] Daily reset failed: ${err.message}`);
    }
  });

  // ── Reset warehouse daily order count at midnight ───────────
  cron.schedule('0 0 * * *', async () => {
    try {
      await Warehouse.updateMany({}, { $set: { 'stats.ordersToday': 0 } });
      logger.info('[CRON] Warehouse daily stats reset');
    } catch (err) {
      logger.error(`[CRON] Warehouse reset failed: ${err.message}`);
    }
  });

  // ── Clean up stale pending orders (older than 2 hours) ──────
  cron.schedule('*/30 * * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = await Order.updateMany(
        { status: 'pending', createdAt: { $lt: cutoff } },
        { $set: { status: 'cancelled' } }
      );
      if (result.modifiedCount > 0) {
        logger.info(`[CRON] Cancelled ${result.modifiedCount} stale orders`);
        io.of('/dashboard').emit('cron:stale_orders_cleared', {
          count: result.modifiedCount,
          ts: Date.now()
        });
      }
    } catch (err) {
      logger.error(`[CRON] Stale order cleanup failed: ${err.message}`);
    }
  });

  // ── Mark offline riders who haven't pinged in 10+ minutes ───
  cron.schedule('*/10 * * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 10 * 60 * 1000);
      const result = await Rider.updateMany(
        { isOnline: true, 'location.updatedAt': { $lt: cutoff } },
        { $set: { isOnline: false, status: 'offline' } }
      );
      if (result.modifiedCount > 0) {
        logger.info(`[CRON] Marked ${result.modifiedCount} riders offline (no GPS ping)`);
      }
    } catch (err) {
      logger.error(`[CRON] Rider offline sweep failed: ${err.message}`);
    }
  });

  // ── Purge AI logs older than 7 days ─────────────────────────
  cron.schedule('0 3 * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const result = await AiLog.deleteMany({ createdAt: { $lt: cutoff } });
      logger.info(`[CRON] Purged ${result.deletedCount} old AI logs`);
    } catch (err) {
      logger.error(`[CRON] AI log purge failed: ${err.message}`);
    }
  });

  // ── Hourly system health broadcast ──────────────────────────
  cron.schedule('0 * * * *', async () => {
    try {
      const [totalOrders, activeRiders, pendingOrders] = await Promise.all([
        Order.countDocuments(),
        Rider.countDocuments({ isOnline: true }),
        Order.countDocuments({ status: { $in: ['pending', 'confirmed', 'preparing', 'dispatched', 'out_for_delivery'] } })
      ]);

      io.of('/dashboard').emit('system:health_report', {
        totalOrders,
        activeRiders,
        pendingOrders,
        uptime: process.uptime(),
        ts: Date.now()
      });

      logger.info(`[CRON] Health report — Orders: ${totalOrders}, Riders online: ${activeRiders}, Active: ${pendingOrders}`);
    } catch (err) {
      logger.error(`[CRON] Health report failed: ${err.message}`);
    }
  });

  logger.info('[CRON] All scheduled jobs registered');
}

module.exports = { startCronJobs };