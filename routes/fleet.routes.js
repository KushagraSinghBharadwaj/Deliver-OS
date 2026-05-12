'use strict';

const express = require('express');
const router = express.Router();
const fleet = require('../controllers/fleet.controller');

// Traffic Prediction endpoints
router.get('/traffic-predict', fleet.trafficPredict);
router.get('/traffic-predict/live', fleet.trafficLive);
router.get('/traffic-predict/forecast', fleet.trafficForecast);

module.exports = router;