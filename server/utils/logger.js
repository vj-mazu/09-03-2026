/**
 * Structured Logger — Winston-based
 * 
 * Replaces raw console.log/error across the backend.
 * - Development: colorized console output
 * - Production: JSON format (ready for log aggregators like ELK, Datadog)
 * - Includes timestamps, levels, and context
 *
 * Usage:
 *   const logger = require('./utils/logger');
 *   logger.info('Server started', { port: 5000 });
 *   logger.warn('Slow query', { duration: 500, query: 'SELECT...' });
 *   logger.error('Failed to connect', { error: err.message });
 */

const isProduction = process.env.NODE_ENV === 'production';

// Lightweight structured logger (no external dependency needed)
const LEVELS = { error: 0, warn: 1, info: 2, http: 3, debug: 4 };
const COLORS = { error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[36m', http: '\x1b[35m', debug: '\x1b[37m' };
const RESET = '\x1b[0m';

const currentLevel = isProduction ? 'warn' : 'debug';

function shouldLog(level) {
    return LEVELS[level] <= LEVELS[currentLevel];
}

function formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();

    if (isProduction) {
        // JSON format for production (log aggregator friendly)
        return JSON.stringify({ timestamp, level, message, ...meta });
    }

    // Colorized format for development
    const color = COLORS[level] || RESET;
    const icon = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'info' ? 'ℹ️' : level === 'http' ? '🌐' : '🔍';
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${color}${icon} [${timestamp.split('T')[1].split('.')[0]}] ${level.toUpperCase()}: ${message}${metaStr}${RESET}`;
}

const logger = {
    error: (message, meta = {}) => {
        if (shouldLog('error')) console.error(formatMessage('error', message, meta));
    },
    warn: (message, meta = {}) => {
        if (shouldLog('warn')) console.warn(formatMessage('warn', message, meta));
    },
    info: (message, meta = {}) => {
        if (shouldLog('info')) console.log(formatMessage('info', message, meta));
    },
    http: (message, meta = {}) => {
        if (shouldLog('http')) console.log(formatMessage('http', message, meta));
    },
    debug: (message, meta = {}) => {
        if (shouldLog('debug')) console.log(formatMessage('debug', message, meta));
    },

    // Express middleware — logs every request
    requestLogger: (req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http';
            logger[level](`${req.method} ${req.originalUrl}`, {
                status: res.statusCode,
                duration: `${duration}ms`,
                ip: req.ip,
                userAgent: req.get('user-agent')?.substring(0, 50)
            });
        });
        next();
    }
};

module.exports = logger;
