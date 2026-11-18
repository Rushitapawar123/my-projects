const express = require('express');
const { query } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get(
  '/health',
  asyncHandler(async (req, res) => {
    await query('SELECT 1');
    res.json({ success: true, status: 'ok', uptime: process.uptime() });
  })
);

router.use('/auth', require('./auth.routes'));
// More feature routers will be mounted here, e.g.:
// router.use('/users', require('./user.routes'));

module.exports = router;
