/**
 * DELIVER OS — Simulation Engine
 * Core AI brain: random event generation, state mutation helpers,
 * Bangalore zone/warehouse seed data, and shared utilities
 * used by all 6 AI simulators.
 */

'use strict';

const { AiLog, Incident } = require('../models');
const logger = require('../utils/logger');

// ── Bangalore Seed Data ───────────────────────────────────────

const ZONES = [
  'Koramangala', 'Indiranagar', 'Whitefield', 'HSR Layout',
  'Jayanagar', 'Marathahalli', 'Electronic City', 'BTM Layout',
  'Banashankari', 'Yelahanka'
];

const WAREHOUSES = [
  { id: 'WH-001', name: 'Koramangala Dark Store', lat: 12.9352, lng: 77.6245, zone: 'Koramangala' },
  { id: 'WH-002', name: 'Indiranagar Hub',        lat: 12.9784, lng: 77.6408, zone: 'Indiranagar' },
  { id: 'WH-003', name: 'Whitefield Micro-Hub',   lat: 12.9698, lng: 77.7500, zone: 'Whitefield' },
  { id: 'WH-004', name: 'HSR Dark Store',          lat: 12.9081, lng: 77.6476, zone: 'HSR Layout' },
  { id: 'WH-005', name: 'Electronic City Hub',     lat: 12.8399, lng: 77.6770, zone: 'Electronic City' }
];

const VEHICLE_TYPES = ['bike', 'scooter', 'cycle', 'electric'];
const PAYMENT_METHODS = ['upi', 'card', 'crypto', 'cod', 'wallet'];

const ORDER_ITEMS_POOL = [
  { name: 'Fresh Milk 1L',      price: 68,  sku: 'GRC001' },
  { name: 'Whole Wheat Bread',  price: 45,  sku: 'GRC002' },
  { name: 'Eggs (12)',          price: 96,  sku: 'GRC003' },
  { name: 'Basmati Rice 5kg',   price: 380, sku: 'GRC004' },
  { name: 'Turmeric Powder',    price: 55,  sku: 'GRC005' },
  { name: 'Tomatoes 1kg',       price: 42,  sku: 'VEG001' },
  { name: 'Onions 2kg',         price: 60,  sku: 'VEG002' },
  { name: 'Spinach Bunch',      price: 30,  sku: 'VEG003' },
  { name: 'Coconut Oil 1L',     price: 175, sku: 'GRC006' },
  { name: 'Packaged Paneer',    price: 88,  sku: 'DRY001' }
];

const INCIDENT_TYPES = [
  'traffic-jam', 'rider-crash', 'device-failure', 'fraud-attempt',
  'stock-mismatch', 'weather-disruption', 'route-failure', 'payment-failure'
];

const AI_SOURCES = [
  'META-AI CEO', 'GTI FLEET AI', 'CUSTOMER AI',
  'INFRA AI', 'SCALE AI', 'DEMAND AI', 'PAYMENT AI'
];

// ── Random Utility Functions ──────────────────────────────────

/**
 * Random integer between min and max (inclusive)
 */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Random float, rounded to given decimals
 */
function randFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

/**
 * Pick a random element from an array
 */
function randFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Random boolean with probability p (0–1) of being true
 */
function randBool(p = 0.5) {
  return Math.random() < p;
}

/**
 * Generate a unique ID with given prefix
 */
function genId(prefix = 'ID') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

/**
 * Jitter a lat/lng coordinate slightly (simulate movement)
 * @param {number} base - base coordinate
 * @param {number} delta - max jitter in degrees (default ~50m)
 */
function jitterCoord(base, delta = 0.0005) {
  return parseFloat((base + (Math.random() - 0.5) * 2 * delta).toFixed(6));
}

/**
 * Generate a random Bangalore GPS coordinate near a warehouse
 */
function randLocationNearWarehouse(warehouse, radiusDeg = 0.02) {
  return {
    lat: jitterCoord(warehouse.lat, radiusDeg),
    lng: jitterCoord(warehouse.lng, radiusDeg)
  };
}

/**
 * Pick a random warehouse
 */
function randWarehouse() {
  return randFrom(WAREHOUSES);
}

/**
 * Pick a random zone
 */
function randZone() {
  return randFrom(ZONES);
}

/**
 * Generate a random order item basket (1–4 items)
 */
function randOrderItems() {
  const count = randInt(1, 4);
  const shuffled = [...ORDER_ITEMS_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(item => ({
    ...item,
    quantity: randInt(1, 3)
  }));
}

/**
 * Calculate total from items array
 */
function calcTotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// ── AI Decision Engine ────────────────────────────────────────

/**
 * Simulate AI making a decision with execution time
 * Returns { action, executedIn, success, savingsAmount }
 */
function simulateAIDecision(actionPool) {
  const action = randFrom(actionPool);
  const executedIn = randInt(80, 420); // ms — AI is fast
  const success = randBool(0.92);      // 92% AI success rate
  const savingsAmount = success ? randInt(50, 2000) : 0;
  return { action, executedIn, success, savingsAmount };
}

// ── DB Write Helpers ──────────────────────────────────────────

/**
 * Persist an AI log entry (fire-and-forget, won't crash simulator on failure)
 */
async function logAIEvent({ source, level = 'info', message, category, relatedId, metadata }) {
  try {
    await AiLog.create({ source, level, message, category, relatedId, metadata });
  } catch (err) {
    // Don't let DB write errors kill the simulator loop
    logger.warn(`[SIM-ENGINE] AiLog write failed: ${err.message}`);
  }
}

/**
 * Persist an incident and return it
 */
async function createIncident({ type, severity, zone, description, affectedEntities, aiResponse }) {
  try {
    const incident = await Incident.create({
      incidentId: genId('INC'),
      type,
      severity,
      location: { ...randLocationNearWarehouse(randWarehouse()), zone },
      description,
      affectedEntities,
      aiResponse,
      status: aiResponse?.success ? 'resolved' : 'resolving',
      resolvedAt: aiResponse?.success ? new Date() : undefined
    });
    return incident;
  } catch (err) {
    logger.warn(`[SIM-ENGINE] Incident write failed: ${err.message}`);
    return null;
  }
}

// ── Throttle Helper ───────────────────────────────────────────

/**
 * Wrap a simulator tick function so it catches errors without crashing
 */
function safeInterval(fn, intervalMs, label) {
  return setInterval(async () => {
    try {
      await fn();
    } catch (err) {
      logger.error(`[SIM-ENGINE] ${label} tick error: ${err.message}`);
    }
  }, intervalMs);
}

// ── Exports ───────────────────────────────────────────────────

module.exports = {
  // Data pools
  ZONES,
  WAREHOUSES,
  VEHICLE_TYPES,
  PAYMENT_METHODS,
  ORDER_ITEMS_POOL,
  INCIDENT_TYPES,
  AI_SOURCES,

  // Utils
  randInt,
  randFloat,
  randFrom,
  randBool,
  genId,
  jitterCoord,
  randLocationNearWarehouse,
  randWarehouse,
  randZone,
  randOrderItems,
  calcTotal,

  // AI helpers
  simulateAIDecision,
  logAIEvent,
  createIncident,
  safeInterval
};
