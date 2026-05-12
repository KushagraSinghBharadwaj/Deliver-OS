/**
 * DELIVER OS — Socket.IO Initialization
 * Real-time event handlers for fleet, orders, incidents, AI logs
 */

'use strict';

const { Server } = require('socket.io');
const logger = require('../../utils/logger');

let io = null;

/**
 * Initialize Socket.IO server
 * @param {http.Server} server
 * @returns {Server} io instance
 */
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // ── Namespaces ──────────────────────────────────────────────

  // Dashboard namespace — admin/manager real-time views
  const dashboard = io.of('/dashboard');
  dashboard.on('connection', (socket) => {
    logger.info(`[SOCKET] Dashboard client connected: ${socket.id}`);

    socket.on('subscribe:zone', (zone) => {
      socket.join(`zone:${zone}`);
      logger.info(`[SOCKET] Dashboard ${socket.id} subscribed to zone: ${zone}`);
    });

    socket.on('subscribe:warehouse', (warehouseId) => {
      socket.join(`warehouse:${warehouseId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`[SOCKET] Dashboard client disconnected: ${socket.id}`);
    });
  });

  // Rider namespace — mobile app connections
  const riders = io.of('/riders');
  riders.on('connection', (socket) => {
    const { riderId } = socket.handshake.query;
    if (riderId) {
      socket.join(`rider:${riderId}`);
      logger.info(`[SOCKET] Rider connected: ${riderId}`);
    }

    // Rider sends GPS ping
    socket.on('rider:location', (data) => {
      // { riderId, lat, lng, speed, battery }
      io.of('/dashboard').emit('fleet:location_update', data);
    });

    // Rider acknowledges order pickup
    socket.on('rider:picked_up', (data) => {
      io.of('/dashboard').emit('order:status_change', {
        orderId: data.orderId,
        status: 'out_for_delivery',
        riderId: data.riderId,
        ts: Date.now()
      });
    });

    // Rider confirms delivery
    socket.on('rider:delivered', (data) => {
      io.of('/dashboard').emit('order:status_change', {
        orderId: data.orderId,
        status: 'delivered',
        riderId: data.riderId,
        ts: Date.now()
      });
    });

    socket.on('disconnect', () => {
      if (riderId) logger.info(`[SOCKET] Rider disconnected: ${riderId}`);
    });
  });

  // Default namespace — general clients
  io.on('connection', (socket) => {
    logger.info(`[SOCKET] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      logger.info(`[SOCKET] Client disconnected: ${socket.id}`);
    });
  });

  logger.info('[SOCKET] Socket.IO initialized — namespaces: /dashboard, /riders');
  return io;
}

/**
 * Get io instance (after initSocket called)
 */
function getIO() {
  if (!io) throw new Error('[SOCKET] io not initialized — call initSocket first');
  return io;
}

// ── Emit Helpers (used by simulators/controllers) ─────────────

function emitToAll(event, data) {
  if (!io) return;
  io.emit(event, data);
}

function emitToDashboard(event, data) {
  if (!io) return;
  io.of('/dashboard').emit(event, data);
}

function emitToRider(riderId, event, data) {
  if (!io) return;
  io.of('/riders').to(`rider:${riderId}`).emit(event, data);
}

function emitToZone(zone, event, data) {
  if (!io) return;
  io.of('/dashboard').to(`zone:${zone}`).emit(event, data);
}

function emitToWarehouse(warehouseId, event, data) {
  if (!io) return;
  io.of('/dashboard').to(`warehouse:${warehouseId}`).emit(event, data);
}

module.exports = {
  initSocket,
  getIO,
  emitToAll,
  emitToDashboard,
  emitToRider,
  emitToZone,
  emitToWarehouse
};
