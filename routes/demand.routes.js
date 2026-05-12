'use strict';
const express = require('express');
const router = express.Router();
router.get('/', (req, res) => res.json({ success: true, module: 'demand' }));
module.exports = router;
