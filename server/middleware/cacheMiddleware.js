/**
 * Cache middleware for reference data endpoints
 * Sets Cache-Control headers so the browser caches responses,
 * reducing redundant API calls for data that rarely changes.
 */

// Cache for 5 minutes — safe for reference data (varieties, packagings, brokers)
const cacheReferenceData = (req, res, next) => {
  // Only cache GET requests
  if (req.method === 'GET') {
    res.set('Cache-Control', 'public, max-age=300'); // 5 min
  }
  next();
};

// No-cache for mutation responses
const noCache = (req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};

module.exports = { cacheReferenceData, noCache };
