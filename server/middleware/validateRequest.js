/**
 * Request validation middleware
 * Sanitizes and validates incoming request data to prevent XSS and data corruption
 */

// Simple XSS sanitizer — strips HTML tags from string values
const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str
        .replace(/<[^>]*>/g, '') // Strip HTML tags
        .replace(/javascript:/gi, '') // Block JS protocol
        .replace(/on\w+\s*=/gi, '') // Block event handlers
        .trim();
};

// Recursively sanitize all string values in an object
const sanitizeObject = (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return sanitizeString(obj);
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    if (typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
    }
    return obj;
};

// Middleware: Sanitize request body, query, and params
const sanitizeRequest = (req, res, next) => {
    if (req.body) req.body = sanitizeObject(req.body);
    if (req.query) req.query = sanitizeObject(req.query);
    if (req.params) req.params = sanitizeObject(req.params);
    next();
};

// Validation helper — validates required fields exist in body
const validateRequired = (...fields) => {
    return (req, res, next) => {
        const missing = fields.filter(f => {
            const val = req.body[f];
            return val === undefined || val === null || val === '';
        });
        if (missing.length > 0) {
            return res.status(400).json({
                error: `Missing required fields: ${missing.join(', ')}`
            });
        }
        next();
    };
};

// Validation helper — validates numeric fields
const validateNumeric = (...fields) => {
    return (req, res, next) => {
        const invalid = fields.filter(f => {
            const val = req.body[f];
            return val !== undefined && val !== null && val !== '' && isNaN(Number(val));
        });
        if (invalid.length > 0) {
            return res.status(400).json({
                error: `Fields must be numeric: ${invalid.join(', ')}`
            });
        }
        next();
    };
};

// Validation helper — validates pagination params
const validatePagination = (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize) || 100, 500); // Max 500

    if (page < 1) {
        return res.status(400).json({ error: 'Page must be >= 1' });
    }

    req.pagination = { page, pageSize, offset: (page - 1) * pageSize };
    next();
};

module.exports = {
    sanitizeRequest,
    sanitizeObject,
    sanitizeString,
    validateRequired,
    validateNumeric,
    validatePagination
};
