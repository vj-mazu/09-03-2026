const jwt = require('jsonwebtoken');
const User = require('../models/User');

// In-memory user cache — avoids DB hit on every request (30s TTL)
const userCache = new Map();
const USER_CACHE_TTL = 30 * 1000; // 30 seconds

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token has expired. Please login again.' });
      }
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token. Please login again.' });
      }
      throw jwtError;
    }

    // Check user cache first (saves ~50-80ms DB roundtrip)
    const cacheKey = decoded.userId;
    const cached = userCache.get(cacheKey);
    if (cached && Date.now() - cached.time < USER_CACHE_TTL) {
      req.user = decoded;
      return next();
    }

    // Cache miss — check DB
    const user = await User.findOne({
      where: {
        id: decoded.userId,
        isActive: true
      },
      attributes: ['id'],
      raw: true
    });

    if (!user) {
      userCache.delete(cacheKey);
      return res.status(401).json({ error: 'User account not found or inactive. Please contact admin.' });
    }

    // Cache the verified user
    userCache.set(cacheKey, { time: Date.now() });
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Token is not valid.' });
  }
};

// Export cache invalidation for logout/deactivation flows
const invalidateUserCache = (userId) => {
  if (userId) userCache.delete(userId);
  else userCache.clear();
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Access denied. Please login.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }

    next();
  };
};

module.exports = { auth, authorize, invalidateUserCache };