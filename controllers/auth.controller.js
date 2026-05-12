/**
 * Auth Controller — Register, Login, Refresh, Logout, Profile
 */

'use strict';

const authService = require('../services/auth.service');

// POST /api/auth/register
exports.register = async (req, res) => {
  const { name, email, password, phone, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'name, email, password are required' });
  }
  const data = await authService.register({ name, email, password, phone, role });
  res.status(201).json({ success: true, message: 'Registration successful', data });
};

// POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'email and password are required' });
  }
  const data = await authService.login({ email, password });
  res.json({ success: true, message: 'Login successful', data });
};

// POST /api/auth/refresh
exports.refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'refreshToken is required' });
  }
  const data = await authService.refreshAccessToken(refreshToken);
  res.json({ success: true, data });
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
  await authService.logout(req.userId);
  res.json({ success: true, message: 'Logged out successfully' });
};

// GET /api/auth/me
exports.me = async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};