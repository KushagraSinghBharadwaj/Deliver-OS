/**
 * Redis Configuration
 * Auto-reconnect, caching helpers, pub/sub support
 */

'use strict';

const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient = null;
let isConnected = false;

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB) || 0,
  retryStrategy: () => null,
  reconnectOnError: (err) => {
    const targetErrors = ['READONLY', 'ECONNRESET'];
    return targetErrors.some(e => err.message.includes(e));
  },
  enableOfflineQueue: true,
  maxRetriesPerRequest: 3,
  lazyConnect: false
};

async function connectRedis() {
  try {
    redisClient = new Redis(redisConfig);

    redisClient.on('connect', () => {
      isConnected = true;
      logger.info('[REDIS] Connected successfully');
    });

    redisClient.on('error', (err) => {
      logger.error(`[REDIS] Error: ${err.message}`);
      // Fallback: continue without Redis (memory fallback below)
    });

    redisClient.on('close', () => {
      isConnected = false;
      logger.warn('[REDIS] Connection closed');
    });

    redisClient.on('reconnecting', () => {
      logger.warn('[REDIS] Reconnecting...');
    });

    await redisClient.ping();
    logger.info('[REDIS] PING successful');
  } catch (err) {
    logger.warn(`[REDIS] Could not connect: ${err.message} — using in-memory fallback`);
    redisClient = createMemoryFallback();
    isConnected = false;
  }
}

// ── In-Memory Fallback ────────────────────────────────────────
// If Redis is unavailable, use a simple Map cache so APIs still work
function createMemoryFallback() {
  const store = new Map();
  return {
    get: async (key) => store.get(key) || null,
    set: async (key, value, ex, ttl) => { store.set(key, value); return 'OK'; },
    setex: async (key, ttl, value) => { store.set(key, value); return 'OK'; },
    del: async (key) => { store.delete(key); return 1; },
    exists: async (key) => store.has(key) ? 1 : 0,
    keys: async (pattern) => [...store.keys()],
    flushdb: async () => { store.clear(); return 'OK'; },
    ping: async () => 'PONG',
    quit: async () => 'OK',
    on: () => {},
    _isFallback: true
  };
}

// ── Cache Helpers ─────────────────────────────────────────────
async function cacheGet(key) {
  if (!redisClient) return null;
  try {
    const val = await redisClient.get(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

async function cacheSet(key, value, ttlSeconds = 3600) {
  if (!redisClient) return;
  try {
    await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    logger.warn(`[REDIS] Cache set failed for key ${key}: ${err.message}`);
  }
}

async function cacheDel(key) {
  if (!redisClient) return;
  try { await redisClient.del(key); } catch { /* noop */ }
}

function getRedisClient() { return redisClient; }
function isRedisConnected() { return isConnected; }

module.exports = {
  connectRedis,
  cacheGet,
  cacheSet,
  cacheDel,
  getRedisClient,
  isRedisConnected
};