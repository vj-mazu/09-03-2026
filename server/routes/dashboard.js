const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const queryOptimizationService = require('../services/queryOptimizationService');
const cacheService = require('../services/cacheService');

const router = express.Router();

// Get Dashboard Statistics - OPTIMIZED with CACHING
router.get('/stats', auth, async (req, res) => {
  const startTime = Date.now();

  try {
    // Get business date (if before 6 AM, use previous day)
    const now = new Date();
    const hours = now.getHours();
    const businessDate = new Date(now);

    if (hours < 6) {
      businessDate.setDate(businessDate.getDate() - 1);
    }

    const businessDateStr = businessDate.toISOString().split('T')[0];
    const cacheKey = `dashboard:stats:${businessDateStr}`;

    // Try to get from cache
    let stats = await cacheService.get(cacheKey);
    let fromCache = false;

    if (stats) {
      stats = JSON.parse(stats);
      fromCache = true;
    } else {
      // Cache miss - fetch from database
      stats = await queryOptimizationService.getDashboardStats(businessDateStr);

      // Cache for 5 minutes (300 seconds) - increased for 10 lakh record performance
      await cacheService.set(cacheKey, JSON.stringify(stats), 300);
    }

    const responseTime = Date.now() - startTime;

    // Set cache-control header
    res.set('Cache-Control', 'public, max-age=120');

    res.json({
      success: true,
      stats,
      businessDate: businessDateStr,
      performance: {
        responseTime: `${responseTime}ms`,
        fromCache
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);

    // Handle timeout errors gracefully
    if (error.name === 'SequelizeTimeoutError') {
      return res.status(504).json({
        success: false,
        error: 'Query timeout - please try again',
        message: 'Dashboard statistics query took too long'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics',
      message: error.message
    });
  }
});

module.exports = router;
