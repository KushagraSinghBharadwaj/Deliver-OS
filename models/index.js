/**
 * MongoDB Models — Deliver OS Meta-AI CEO
 * All schemas: Users, Riders, Orders, Deliveries, AI Logs, etc.
 */

'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ── USER MODEL ────────────────────────────────────────────────
const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'manager', 'rider', 'customer', 'viewer'], default: 'customer' },
  phone: { type: String, trim: true },
  avatar: String,
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  refreshToken: { type: String, select: false },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

userSchema.index({ email: 1 });
userSchema.index({ role: 1, isActive: 1 });

// ── RIDER MODEL ───────────────────────────────────────────────
const riderSchema = new Schema({
  riderId: { type: String, unique: true, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  status: {
    type: String,
    enum: ['available', 'assigned', 'delivering', 'returning', 'offline', 'incident'],
    default: 'available'
  },
  location: {
    lat: { type: Number, default: 12.9716 },
    lng: { type: Number, default: 77.5946 },
    updatedAt: { type: Date, default: Date.now }
  },
  vehicleType: { type: String, enum: ['bike', 'scooter', 'cycle', 'electric'], default: 'bike' },
  vehicleNumber: String,
  currentOrder: { type: Schema.Types.ObjectId, ref: 'Order' },
  zone: String,
  warehouse: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
  stats: {
    totalDeliveries: { type: Number, default: 0 },
    successRate: { type: Number, default: 100 },
    avgTime: { type: Number, default: 22 }, // minutes
    todayDeliveries: { type: Number, default: 0 },
    earnings: { type: Number, default: 0 }
  },
  deviceId: String,
  batteryLevel: { type: Number, default: 100 },
  isOnline: { type: Boolean, default: false }
}, { timestamps: true });

riderSchema.index({ riderId: 1 });
riderSchema.index({ status: 1 });
riderSchema.index({ 'location.lat': 1, 'location.lng': 1 });

// ── ORDER MODEL ───────────────────────────────────────────────
const orderSchema = new Schema({
  orderId: { type: String, unique: true, required: true },
  customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  rider: { type: Schema.Types.ObjectId, ref: 'Rider' },
  warehouse: { type: Schema.Types.ObjectId, ref: 'Warehouse' },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'dispatched', 'out_for_delivery', 'delivered', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  items: [{
    name: String,
    quantity: Number,
    price: Number,
    sku: String
  }],
  totalAmount: { type: Number, required: true },
  deliveryAddress: {
    street: String,
    area: String,
    city: String,
    pincode: String,
    lat: Number,
    lng: Number
  },
  payment: {
    method: { type: String, enum: ['upi', 'card', 'crypto', 'cod', 'wallet'], default: 'upi' },
    status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    transactionId: String,
    blockchainHash: String
  },
  eta: Date,
  deliveredAt: Date,
  aiFlags: {
    fraudRisk: { type: Number, default: 0 }, // 0-1
    demandZone: String,
    routeOptimized: { type: Boolean, default: false },
    autoResolved: { type: Boolean, default: false }
  },
  notes: String
}, { timestamps: true });

orderSchema.index({ orderId: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ customer: 1, status: 1 });

// ── WAREHOUSE MODEL ───────────────────────────────────────────
const warehouseSchema = new Schema({
  warehouseId: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['dark-store', 'hub', 'micro-hub', 'distribution'], default: 'dark-store' },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: String,
    zone: String
  },
  inventory: { type: Number, default: 1000 }, // units
  capacity: { type: Number, default: 2000 },
  activeRiders: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'low-stock', 'restocking', 'offline'], default: 'active' },
  stats: {
    ordersToday: { type: Number, default: 0 },
    dispatchRate: { type: Number, default: 98.5 },
    avgPickTime: { type: Number, default: 3 } // minutes
  }
}, { timestamps: true });

// ── AI LOG MODEL ──────────────────────────────────────────────
const aiLogSchema = new Schema({
  source: {
    type: String,
    enum: ['META-AI CEO', 'GTI FLEET AI', 'CUSTOMER AI', 'INFRA AI', 'SCALE AI', 'DEMAND AI', 'PAYMENT AI'],
    required: true
  },
  level: { type: String, enum: ['info', 'warning', 'critical', 'success', 'action'], default: 'info' },
  message: { type: String, required: true },
  category: String, // e.g. 'route-optimization', 'fraud-detection', etc.
  relatedId: String, // orderId, riderId, etc.
  metadata: Schema.Types.Mixed,
  resolved: { type: Boolean, default: false },
  resolutionTime: Number // milliseconds
}, { timestamps: true });

aiLogSchema.index({ source: 1, createdAt: -1 });
aiLogSchema.index({ level: 1, createdAt: -1 });

// ── INCIDENT MODEL ────────────────────────────────────────────
const incidentSchema = new Schema({
  incidentId: { type: String, unique: true, required: true },
  type: {
    type: String,
    enum: ['traffic-jam', 'rider-crash', 'device-failure', 'fraud-attempt', 'stock-mismatch', 'weather-disruption', 'route-failure', 'payment-failure'],
    required: true
  },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  location: { lat: Number, lng: Number, zone: String },
  description: String,
  affectedEntities: {
    orderId: String,
    riderId: String,
    warehouseId: String,
    customerId: String
  },
  aiResponse: {
    action: String,
    executedIn: Number, // ms
    success: Boolean,
    savingsAmount: Number
  },
  status: { type: String, enum: ['detected', 'resolving', 'resolved', 'escalated'], default: 'detected' },
  resolvedAt: Date,
  humanInterventions: { type: Number, default: 0 }
}, { timestamps: true });

incidentSchema.index({ status: 1, severity: -1 });
incidentSchema.index({ type: 1, createdAt: -1 });

// ── PAYMENT MODEL ─────────────────────────────────────────────
const paymentSchema = new Schema({
  transactionId: { type: String, unique: true, required: true },
  blockchainHash: { type: String, unique: true },
  previousHash: String,
  orderId: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  method: { type: String, enum: ['upi', 'card', 'crypto', 'cod', 'wallet'] },
  status: { type: String, enum: ['pending', 'validating', 'confirmed', 'failed', 'refunded', 'flagged'], default: 'pending' },
  fraudScore: { type: Number, default: 0 }, // 0-100
  securityFlags: [String],
  smartContractId: String,
  blockNumber: Number,
  confirmations: { type: Number, default: 0 },
  metadata: Schema.Types.Mixed
}, { timestamps: true });

paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ fraudScore: -1 });

// ── DEMAND FORECAST MODEL ─────────────────────────────────────
const demandForecastSchema = new Schema({
  zone: { type: String, required: true },
  forecastType: { type: String, enum: ['hourly', '24h', '72h', 'weekly'], default: '24h' },
  predictedDemand: Number,
  actualDemand: Number,
  accuracy: Number, // percentage
  surgeMultiplier: { type: Number, default: 1.0 },
  recommendations: [String],
  restockTriggered: { type: Boolean, default: false },
  validFrom: Date,
  validUntil: Date,
  confidence: { type: Number, default: 94 }
}, { timestamps: true });

demandForecastSchema.index({ zone: 1, createdAt: -1 });

// ── NOTIFICATION MODEL ────────────────────────────────────────
const notificationSchema = new Schema({
  recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['sms', 'whatsapp', 'push', 'email', 'voice'], default: 'sms' },
  category: { type: String, enum: ['delivery', 'otp', 'alert', 'promo', 'complaint'], default: 'delivery' },
  message: String,
  orderId: String,
  status: { type: String, enum: ['queued', 'sent', 'delivered', 'failed'], default: 'queued' },
  aiGenerated: { type: Boolean, default: true },
  sentAt: Date
}, { timestamps: true });

// ── CUSTOMER CALL MODEL ───────────────────────────────────────
const customerCallSchema = new Schema({
  callId: { type: String, unique: true, required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'User' },
  orderId: String,
  callType: { type: String, enum: ['pre-delivery', 'otp-verify', 'missed-retry', 'complaint-resolution'], required: true },
  status: { type: String, enum: ['initiated', 'answered', 'no-answer', 'failed', 'voicemail'], default: 'initiated' },
  aiVoiceScript: String,
  duration: Number, // seconds
  outcome: { type: String, enum: ['customer-available', 'unavailable', 'retry-scheduled', 'resolved'] },
  retryCount: { type: Number, default: 0 },
  nextRetryAt: Date
}, { timestamps: true });

// ── ROUTE MODEL ───────────────────────────────────────────────
const routeSchema = new Schema({
  routeId: { type: String, unique: true, required: true },
  riderId: String,
  orderId: String,
  origin: { lat: Number, lng: Number, address: String },
  destination: { lat: Number, lng: Number, address: String },
  waypoints: [{ lat: Number, lng: Number }],
  distance: Number, // km
  duration: Number, // minutes
  eta: Date,
  trafficCondition: { type: String, enum: ['clear', 'moderate', 'heavy', 'blocked'], default: 'clear' },
  optimizedAt: Date,
  optimizationMs: Number, // time taken to optimize
  fuelSavings: Number, // INR
  alternativeRoutes: { type: Number, default: 3 },
  aiScore: { type: Number, default: 98 }
}, { timestamps: true });

// ── IOT EVENT MODEL ───────────────────────────────────────────
const iotEventSchema = new Schema({
  deviceId: { type: String, required: true },
  riderId: String,
  eventType: {
    type: String,
    enum: ['gps-ping', 'battery-low', 'device-offline', 'speed-anomaly', 'stationary-alert', 'crash-detected', 'geofence-breach'],
    required: true
  },
  data: Schema.Types.Mixed,
  location: { lat: Number, lng: Number },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
  processed: { type: Boolean, default: false },
  aiAction: String
}, { timestamps: true });

iotEventSchema.index({ deviceId: 1, createdAt: -1 });
iotEventSchema.index({ eventType: 1, processed: 1 });

// ── Export all models ─────────────────────────────────────────
module.exports = {
  User: mongoose.model('User', userSchema),
  Rider: mongoose.model('Rider', riderSchema),
  Order: mongoose.model('Order', orderSchema),
  Warehouse: mongoose.model('Warehouse', warehouseSchema),
  AiLog: mongoose.model('AiLog', aiLogSchema),
  Incident: mongoose.model('Incident', incidentSchema),
  Payment: mongoose.model('Payment', paymentSchema),
  DemandForecast: mongoose.model('DemandForecast', demandForecastSchema),
  Notification: mongoose.model('Notification', notificationSchema),
  CustomerCall: mongoose.model('CustomerCall', customerCallSchema),
  Route: mongoose.model('Route', routeSchema),
  IotEvent: mongoose.model('IotEvent', iotEventSchema)
};