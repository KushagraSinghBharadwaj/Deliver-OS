/**
 * DELIVER OS — AI Simulators
 * 6 autonomous AI agents running on intervals, emitting real-time
 * events via Socket.IO and persisting state to MongoDB.
 *
 * Simulators:
 *  1. GTI Fleet AI     — rider GPS, battery, IoT anomalies
 *  2. Order AI         — order lifecycle state machine
 *  3. Demand AI        — surge detection, demand forecasting
 *  4. Infra AI         — warehouse stock, restock triggers
 *  5. Customer AI      — delivery notifications, call simulation
 *  6. Payment AI       — fraud scoring, blockchain confirmations
 */

'use strict';

const {
  Rider, Order, Warehouse, Payment,
  DemandForecast, Notification, CustomerCall, IotEvent, Route
} = require('../../models');

const {
  ZONES, WAREHOUSES, VEHICLE_TYPES, PAYMENT_METHODS,
  randInt, randFloat, randFrom, randBool, genId,
  jitterCoord, randLocationNearWarehouse, randWarehouse, randZone,
  randOrderItems, calcTotal,
  simulateAIDecision, logAIEvent, createIncident, safeInterval
} = require('../simulation.engine');

const logger = require('../../utils/logger');

// Interval constants (ms)
const FLEET_INTERVAL     = 4000;   // GPS pings every 4s
const ORDER_INTERVAL     = 7000;   // Order state machine every 7s
const DEMAND_INTERVAL    = 30000;  // Demand forecast every 30s
const INFRA_INTERVAL     = 20000;  // Warehouse health every 20s
const CUSTOMER_INTERVAL  = 15000;  // Customer comms every 15s
const PAYMENT_INTERVAL   = 10000;  // Payment validation every 10s

// ─────────────────────────────────────────────────────────────
// 1. GTI FLEET AI — rider tracking, IoT events, incidents
// ─────────────────────────────────────────────────────────────
async function fleetSimulatorTick(io) {
  const riders = await Rider.find({ isOnline: true }).limit(20).lean();

  for (const rider of riders) {
    // Simulate GPS movement
    const newLat = jitterCoord(rider.location.lat);
    const newLng = jitterCoord(rider.location.lng);
    const battery = Math.max(5, rider.batteryLevel - randInt(0, 1));

    await Rider.updateOne(
      { riderId: rider.riderId },
      {
        $set: {
          'location.lat': newLat,
          'location.lng': newLng,
          'location.updatedAt': new Date(),
          batteryLevel: battery
        }
      }
    );

    // Emit live GPS ping to dashboard
    io.of('/dashboard').emit('fleet:location_update', {
      riderId: rider.riderId,
      name: rider.name,
      lat: newLat,
      lng: newLng,
      status: rider.status,
      battery,
      vehicleType: rider.vehicleType,
      ts: Date.now()
    });

    // Simulate IoT anomaly (5% chance per rider per tick)
    if (randBool(0.05)) {
      const eventTypes = ['battery-low', 'speed-anomaly', 'stationary-alert'];
      const eventType = battery < 15 ? 'battery-low' : randFrom(eventTypes);
      const severity = battery < 10 ? 'critical' : 'warning';

      await IotEvent.create({
        deviceId: rider.deviceId || genId('DEV'),
        riderId: rider.riderId,
        eventType,
        data: { battery, speed: randInt(0, 60) },
        location: { lat: newLat, lng: newLng },
        severity,
        processed: true,
        aiAction: 'notified-dispatcher'
      });

      io.of('/dashboard').emit('iot:anomaly', {
        riderId: rider.riderId,
        eventType,
        severity,
        battery,
        ts: Date.now()
      });

      if (severity === 'critical') {
        await logAIEvent({
          source: 'GTI FLEET AI',
          level: 'critical',
          message: `Battery critical (${battery}%) for rider ${rider.riderId} — reassignment queued`,
          category: 'iot-alert',
          relatedId: rider.riderId
        });
      }
    }

    // Simulate crash incident (0.5% chance)
    if (randBool(0.005)) {
      const decision = simulateAIDecision([
        'Dispatched emergency contact', 'Alerted nearest warehouse', 'Rerouted pending orders'
      ]);

      await createIncident({
        type: 'rider-crash',
        severity: 'critical',
        zone: rider.zone || randZone(),
        description: `Crash detected for rider ${rider.riderId} via accelerometer spike`,
        affectedEntities: { riderId: rider.riderId },
        aiResponse: decision
      });

      io.of('/dashboard').emit('incident:detected', {
        type: 'rider-crash',
        severity: 'critical',
        riderId: rider.riderId,
        aiAction: decision.action,
        executedIn: decision.executedIn,
        ts: Date.now()
      });

      logger.warn(`[GTI FLEET AI] Crash incident for rider ${rider.riderId} — AI responded in ${decision.executedIn}ms`);
    }
  }

  // Periodically bring riders online/offline to simulate shift changes
  if (randBool(0.1)) {
    const allRiders = await Rider.find().limit(50).lean();
    if (allRiders.length > 0) {
      const target = randFrom(allRiders);
      const goOnline = !target.isOnline;
      await Rider.updateOne(
        { riderId: target.riderId },
        { $set: { isOnline: goOnline, status: goOnline ? 'available' : 'offline' } }
      );
      io.of('/dashboard').emit('fleet:status_change', {
        riderId: target.riderId,
        isOnline: goOnline,
        status: goOnline ? 'available' : 'offline',
        ts: Date.now()
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 2. ORDER AI — order lifecycle state machine
// ─────────────────────────────────────────────────────────────
const ORDER_FLOW = [
  'pending', 'confirmed', 'preparing', 'dispatched',
  'out_for_delivery', 'delivered'
];

async function orderSimulatorTick(io) {
  // Advance in-progress orders
  const activeOrders = await Order.find({
    status: { $in: ['pending', 'confirmed', 'preparing', 'dispatched', 'out_for_delivery'] }
  }).limit(10).lean();

  for (const order of activeOrders) {
    const currentIdx = ORDER_FLOW.indexOf(order.status);
    if (currentIdx === -1 || currentIdx === ORDER_FLOW.length - 1) continue;

    // 30% chance to advance per tick
    if (!randBool(0.3)) continue;

    const nextStatus = ORDER_FLOW[currentIdx + 1];
    const update = { status: nextStatus };

    if (nextStatus === 'delivered') {
      update.deliveredAt = new Date();
      update['aiFlags.autoResolved'] = true;
    }
    if (nextStatus === 'dispatched') {
      update.eta = new Date(Date.now() + randInt(15, 45) * 60 * 1000);
    }

    await Order.updateOne({ orderId: order.orderId }, { $set: update });

    io.of('/dashboard').emit('order:status_change', {
      orderId: order.orderId,
      prevStatus: order.status,
      status: nextStatus,
      eta: update.eta,
      ts: Date.now()
    });

    // Assign available rider when dispatching
    if (nextStatus === 'dispatched') {
      const availableRider = await Rider.findOne({ status: 'available', isOnline: true }).lean();
      if (availableRider) {
        await Rider.updateOne(
          { riderId: availableRider.riderId },
          { $set: { status: 'assigned', currentOrder: order._id } }
        );
        io.of('/dashboard').emit('fleet:rider_assigned', {
          riderId: availableRider.riderId,
          orderId: order.orderId,
          ts: Date.now()
        });
      }
    }

    await logAIEvent({
      source: 'META-AI CEO',
      level: 'action',
      message: `Order ${order.orderId} advanced: ${order.status} → ${nextStatus}`,
      category: 'order-lifecycle',
      relatedId: order.orderId
    });
  }

  // Simulate a failed order (2% chance)
  if (randBool(0.02)) {
    const targetOrder = await Order.findOne({ status: 'out_for_delivery' }).lean();
    if (targetOrder) {
      await Order.updateOne({ orderId: targetOrder.orderId }, { $set: { status: 'failed' } });
      io.of('/dashboard').emit('order:failed', {
        orderId: targetOrder.orderId,
        reason: randFrom(['Customer unavailable', 'Address not found', 'Rider incident']),
        ts: Date.now()
      });

      await createIncident({
        type: 'route-failure',
        severity: 'medium',
        zone: randZone(),
        description: `Delivery failed for order ${targetOrder.orderId}`,
        affectedEntities: { orderId: targetOrder.orderId },
        aiResponse: simulateAIDecision(['Scheduled reattempt', 'Issued refund', 'Notified customer'])
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 3. DEMAND AI — surge detection, zone demand forecasting
// ─────────────────────────────────────────────────────────────
async function demandSimulatorTick(io) {
  const zone = randZone();
  const hour = new Date().getHours();

  // Peak hours: 8–10 AM, 12–2 PM, 6–9 PM
  const isPeak = (hour >= 8 && hour <= 10) || (hour >= 12 && hour <= 14) || (hour >= 18 && hour <= 21);
  const baseDemand = isPeak ? randInt(180, 340) : randInt(40, 130);
  const surgeMultiplier = isPeak ? randFloat(1.2, 2.4) : randFloat(0.9, 1.1);
  const accuracy = randFloat(91, 98.5);

  const forecast = await DemandForecast.create({
    zone,
    forecastType: '24h',
    predictedDemand: baseDemand,
    surgeMultiplier,
    accuracy,
    recommendations: [
      surgeMultiplier > 1.5 ? `Deploy 3 extra riders to ${zone}` : `Standard coverage for ${zone}`,
      `Restock top 5 SKUs in ${zone} warehouse`,
      `Enable dynamic pricing x${surgeMultiplier.toFixed(1)}`
    ],
    restockTriggered: surgeMultiplier > 1.8,
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 3600000),
    confidence: randInt(88, 97)
  });

  io.of('/dashboard').emit('demand:forecast_update', {
    zone,
    predictedDemand: baseDemand,
    surgeMultiplier,
    isPeak,
    accuracy,
    recommendations: forecast.recommendations,
    ts: Date.now()
  });

  if (surgeMultiplier > 1.8) {
    io.of('/dashboard').emit('demand:surge_alert', {
      zone,
      surgeMultiplier,
      message: `🔥 SURGE DETECTED in ${zone} — x${surgeMultiplier.toFixed(1)} demand spike`,
      ts: Date.now()
    });

    await logAIEvent({
      source: 'DEMAND AI',
      level: 'warning',
      message: `Surge x${surgeMultiplier.toFixed(1)} in ${zone} — deploying additional resources`,
      category: 'surge-detection',
      metadata: { zone, surgeMultiplier, baseDemand }
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 4. INFRA AI — warehouse stock, restock triggers
// ─────────────────────────────────────────────────────────────
async function infraSimulatorTick(io) {
  const warehouses = await Warehouse.find().lean();

  for (const wh of warehouses) {
    // Deplete inventory slowly
    const depletion = randInt(1, 12);
    const newInventory = Math.max(0, wh.inventory - depletion);
    const stockPct = (newInventory / wh.capacity) * 100;

    let newStatus = 'active';
    if (stockPct < 20) newStatus = 'low-stock';
    if (stockPct < 5)  newStatus = 'restocking';

    await Warehouse.updateOne(
      { warehouseId: wh.warehouseId },
      { $set: { inventory: newInventory, status: newStatus } }
    );

    io.of('/dashboard').emit('infra:warehouse_update', {
      warehouseId: wh.warehouseId,
      name: wh.name,
      inventory: newInventory,
      capacity: wh.capacity,
      stockPct: parseFloat(stockPct.toFixed(1)),
      status: newStatus,
      ts: Date.now()
    });

    // Trigger restock alert
    if (newStatus === 'low-stock') {
      io.of('/dashboard').emit('infra:restock_alert', {
        warehouseId: wh.warehouseId,
        name: wh.name,
        stockPct: parseFloat(stockPct.toFixed(1)),
        message: `⚠️ ${wh.name} at ${stockPct.toFixed(0)}% — restock recommended`,
        ts: Date.now()
      });

      await logAIEvent({
        source: 'INFRA AI',
        level: 'warning',
        message: `${wh.name} stock at ${stockPct.toFixed(0)}% — auto-restock order placed`,
        category: 'inventory-management',
        relatedId: wh.warehouseId,
        metadata: { newInventory, capacity: wh.capacity }
      });
    }

    // Simulate a stock-mismatch incident (3% chance)
    if (randBool(0.03)) {
      const decision = simulateAIDecision([
        'Initiated physical audit', 'Flagged for manager review', 'Adjusted inventory count'
      ]);
      await createIncident({
        type: 'stock-mismatch',
        severity: 'medium',
        zone: wh.location?.zone || randZone(),
        description: `Stock count mismatch detected at ${wh.name}`,
        affectedEntities: { warehouseId: wh.warehouseId },
        aiResponse: decision
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 5. CUSTOMER AI — delivery notifications, voice call simulation
// ─────────────────────────────────────────────────────────────
async function customerSimulatorTick(io) {
  // Find orders that are out_for_delivery — notify customer
  const outForDelivery = await Order.find({ status: 'out_for_delivery' })
    .populate('customer', 'name phone')
    .limit(5)
    .lean();

  for (const order of outForDelivery) {
    if (!order.customer) continue;

    // Simulate AI-generated notification
    const notifType = randFrom(['sms', 'whatsapp', 'push']);
    const message = `Hi ${order.customer.name}, your order #${order.orderId} is on the way! ETA: ${randInt(10, 30)} mins.`;

    await Notification.create({
      recipient: order.customer._id,
      type: notifType,
      category: 'delivery',
      message,
      orderId: order.orderId,
      status: 'sent',
      aiGenerated: true,
      sentAt: new Date()
    });

    io.of('/dashboard').emit('customer:notification_sent', {
      customerId: order.customer._id,
      orderId: order.orderId,
      type: notifType,
      ts: Date.now()
    });
  }

  // Simulate AI voice call for missed delivery (5% chance)
  if (randBool(0.05)) {
    const failedOrder = await Order.findOne({ status: 'out_for_delivery' }).lean();
    if (failedOrder) {
      const callStatus = randFrom(['answered', 'no-answer', 'voicemail']);

      await CustomerCall.create({
        callId: genId('CALL'),
        orderId: failedOrder.orderId,
        callType: 'pre-delivery',
        status: callStatus,
        aiVoiceScript: `Hello, this is Deliver OS. Your order will arrive in ${randInt(5, 20)} minutes. Please be available.`,
        duration: callStatus === 'answered' ? randInt(15, 90) : 0,
        outcome: callStatus === 'answered' ? 'customer-available' : 'retry-scheduled',
        retryCount: callStatus !== 'answered' ? 1 : 0,
        nextRetryAt: callStatus !== 'answered' ? new Date(Date.now() + 300000) : undefined
      });

      io.of('/dashboard').emit('customer:call_initiated', {
        orderId: failedOrder.orderId,
        callStatus,
        ts: Date.now()
      });

      await logAIEvent({
        source: 'CUSTOMER AI',
        level: callStatus === 'answered' ? 'success' : 'info',
        message: `AI voice call for order ${failedOrder.orderId} — status: ${callStatus}`,
        category: 'customer-communication',
        relatedId: failedOrder.orderId
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 6. PAYMENT AI — fraud scoring, blockchain confirmations
// ─────────────────────────────────────────────────────────────
async function paymentSimulatorTick(io) {
  // Validate pending payments
  const pendingPayments = await Payment.find({ status: 'validating' }).limit(5).lean();

  for (const payment of pendingPayments) {
    const fraudScore = randInt(0, 100);
    const isFraud = fraudScore > 75;
    const newStatus = isFraud ? 'flagged' : 'confirmed';
    const confirmations = isFraud ? 0 : randInt(1, 6);

    const securityFlags = [];
    if (fraudScore > 60) securityFlags.push('high-velocity');
    if (fraudScore > 75) securityFlags.push('suspicious-location');
    if (fraudScore > 85) securityFlags.push('known-fraud-pattern');

    await Payment.updateOne(
      { transactionId: payment.transactionId },
      {
        $set: {
          status: newStatus,
          fraudScore,
          securityFlags,
          confirmations,
          blockNumber: isFraud ? undefined : randInt(100000, 999999)
        }
      }
    );

    io.of('/dashboard').emit('payment:validated', {
      transactionId: payment.transactionId,
      orderId: payment.orderId,
      status: newStatus,
      fraudScore,
      isFraud,
      amount: payment.amount,
      ts: Date.now()
    });

    if (isFraud) {
      io.of('/dashboard').emit('payment:fraud_alert', {
        transactionId: payment.transactionId,
        orderId: payment.orderId,
        fraudScore,
        flags: securityFlags,
        message: `🚨 FRAUD DETECTED — Order ${payment.orderId} flagged (score: ${fraudScore})`,
        ts: Date.now()
      });

      await createIncident({
        type: 'fraud-attempt',
        severity: fraudScore > 85 ? 'critical' : 'high',
        zone: randZone(),
        description: `Payment fraud detected: txn ${payment.transactionId}, score ${fraudScore}`,
        affectedEntities: { orderId: payment.orderId },
        aiResponse: simulateAIDecision([
          'Payment blocked and refunded', 'Account flagged for review', 'Notified fraud team'
        ])
      });

      await logAIEvent({
        source: 'PAYMENT AI',
        level: 'critical',
        message: `Fraud detected: ${payment.transactionId} — score ${fraudScore} — BLOCKED`,
        category: 'fraud-detection',
        relatedId: payment.transactionId,
        metadata: { fraudScore, securityFlags }
      });
    }
  }

  // Move some pending → validating
  await Payment.updateMany(
    { status: 'pending' },
    { $set: { status: 'validating' } },
    { limit: 3 }
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN — Start all simulators
// ─────────────────────────────────────────────────────────────

const _intervals = [];

function startAllSimulators(io) {
  logger.info('[SIMULATORS] Booting 6 AI simulators...');

  _intervals.push(safeInterval(() => fleetSimulatorTick(io),    FLEET_INTERVAL,    'GTI FLEET AI'));
  _intervals.push(safeInterval(() => orderSimulatorTick(io),    ORDER_INTERVAL,    'ORDER AI'));
  _intervals.push(safeInterval(() => demandSimulatorTick(io),   DEMAND_INTERVAL,   'DEMAND AI'));
  _intervals.push(safeInterval(() => infraSimulatorTick(io),    INFRA_INTERVAL,    'INFRA AI'));
  _intervals.push(safeInterval(() => customerSimulatorTick(io), CUSTOMER_INTERVAL, 'CUSTOMER AI'));
  _intervals.push(safeInterval(() => paymentSimulatorTick(io),  PAYMENT_INTERVAL,  'PAYMENT AI'));

  logger.info('[SIMULATORS] ✅ All 6 AI simulators online');
}

function stopAllSimulators() {
  _intervals.forEach(clearInterval);
  _intervals.length = 0;
  logger.info('[SIMULATORS] All simulators stopped');
}

module.exports = { startAllSimulators, stopAllSimulators };
