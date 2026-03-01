/**
 * Lightweight Performance Monitoring Middleware
 * Only tracks response times and logs slow queries — no DB writes, no memoryUsage()
 */

const performanceMonitorMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Store original end function
  const originalEnd = res.end;

  // Override end function
  res.end = function (...args) {
    const responseTime = Date.now() - startTime;

    // Add response time header
    try {
      if (!res.headersSent) {
        res.setHeader('X-Response-Time', `${responseTime}ms`);
      }
    } catch (error) {
      // Ignore header errors
    }

    // Only log slow queries (>500ms) — not every single request
    if (responseTime > 500 && responseTime <= 2000) {
      console.warn(`⚠️  SLOW: ${req.method} ${req.originalUrl} - ${responseTime}ms`);
    }

    if (responseTime > 2000) {
      console.error(`🚨 VERY SLOW: ${req.method} ${req.originalUrl} - ${responseTime}ms (Status: ${res.statusCode})`);
    }

    // Call original end
    originalEnd.apply(res, args);
  };

  next();
};

module.exports = performanceMonitorMiddleware;
