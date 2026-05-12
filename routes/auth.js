/**
 * Auth Middleware — JWT Verification + Role-Based Access Control
 */

'use strict';

const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

// ── Verify JWT Token ──────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied — No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user from DB
    const user = await User.findById(decoded.id).select('-password -refreshToken');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Token invalid or user deactivated' });
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired — please refresh' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token signature' });
    }
    logger.error(`[AUTH] Token verification failed: ${err.message}`);
    return res.status(401).json({ success: false, message: 'Authentication failed' });
  }
};

// ── Optional Auth (doesn't fail if no token) ─────────────────
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password -refreshToken');
    req.userId = req.user?._id;
  } catch { /* noop */ }
  next();
};

// ── Role Guard Factory ────────────────────────────────────────
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied — requires role: ${roles.join(' or ')}`
    });
  }
  next();
};

// Convenience role guards
const isAdmin = authorize('admin');
const isAdminOrManager = authorize('admin', 'manager');
const isRider = authorize('rider', 'admin', 'manager');

module.exports = { authenticate, optionalAuth, authorize, isAdmin, isAdminOrManager, isRider };