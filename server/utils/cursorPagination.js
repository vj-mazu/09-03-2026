/**
 * Cursor-based Pagination Utility
 * 
 * Replaces offset-based pagination for O(1) performance at any page depth.
 * Works by using a composite cursor (createdAt + id) instead of offset.
 * 
 * Usage:
 *   const { buildCursorQuery, formatCursorResponse } = require('./utils/cursorPagination');
 *   
 *   const query = buildCursorQuery(req.query, 'DESC');
 *   const results = await Model.findAll({ ...query, where: { ...existingWhere, ...query.where } });
 *   const response = formatCursorResponse(results, query.limit);
 */
const { Op } = require('sequelize');

const DEFAULT_CURSOR_FIELDS = [
    { name: 'createdAt', type: 'date' },
    { name: 'id', type: 'string' }
];

function normalizeFields(fields = DEFAULT_CURSOR_FIELDS) {
    if (!Array.isArray(fields) || fields.length === 0) {
        return DEFAULT_CURSOR_FIELDS;
    }

    return fields.map((field) => {
        if (typeof field === 'string') {
            return { name: field, type: field.toLowerCase().includes('at') ? 'date' : 'string' };
        }

        return {
            name: field.name,
            type: field.type || 'string'
        };
    }).filter((field) => field.name);
}

function parseCursorValue(value, type) {
    if (value === undefined || value === null) return value;

    if (type === 'date') {
        return new Date(value);
    }

    if (type === 'number') {
        return Number(value);
    }

    return value;
}

function buildCompositeCursorWhere(fields, decoded, sortDirection) {
    const comparator = sortDirection === 'DESC' ? Op.lt : Op.gt;
    const clauses = [];

    for (let index = 0; index < fields.length; index += 1) {
        const andClauses = [];

        for (let previousIndex = 0; previousIndex < index; previousIndex += 1) {
            const previousField = fields[previousIndex];
            andClauses.push({
                [previousField.name]: parseCursorValue(decoded[previousField.name], previousField.type)
            });
        }

        const currentField = fields[index];
        andClauses.push({
            [currentField.name]: {
                [comparator]: parseCursorValue(decoded[currentField.name], currentField.type)
            }
        });

        clauses.push(andClauses.length === 1 ? andClauses[0] : { [Op.and]: andClauses });
    }

    return { [Op.or]: clauses };
}

/**
 * Build cursor query from request parameters
 * @param {Object} queryParams - req.query object
 * @param {string} sortDirection - 'ASC' or 'DESC' (default: 'DESC')
 * @returns {Object} { where, order, limit }
 */
function buildCursorQuery(queryParams, sortDirection = 'DESC', options = {}) {
    const {
        cursor,        // Base64 encoded cursor from previous response
        pageSize = 50, // Items per page
        // Keep offset support for backward compatibility
        page,
        limit
    } = queryParams;

    const parsedLimit = Math.min(parseInt(pageSize || limit || 50), 500);
    const fields = normalizeFields(options.fields);
    const order = fields.map((field) => [field.name, sortDirection]);

    // If page is provided (backward compat), use offset-based
    if (page && !cursor) {
        const parsedPage = Math.max(1, parseInt(page));
        return {
            offset: (parsedPage - 1) * parsedLimit,
            limit: parsedLimit,
            order,
            where: {},
            isCursor: false,
            fields
        };
    }

    // Cursor-based pagination
    if (cursor) {
        try {
            const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
            return {
                where: buildCompositeCursorWhere(fields, decoded, sortDirection),
                order,
                limit: parsedLimit + 1, // Fetch one extra to know if there's a next page
                isCursor: true,
                fields
            };
        } catch (e) {
            // Invalid cursor, fall through to default
        }
    }

    // Default: first page with cursor support
    return {
        where: {},
        order,
        limit: parsedLimit + 1, // Fetch one extra to know if there's a next page
        isCursor: true,
        fields
    };
}

/**
 * Format response with cursor information
 * @param {Array} results - Query results
 * @param {number} requestedLimit - The limit that was used (including +1 extra)
 * @param {number} totalCount - Optional total count (only include if cheap to compute)
 * @returns {Object} { data, pagination }
 */
function formatCursorResponse(results, requestedLimit, totalCount = null, options = {}) {
    const actualLimit = requestedLimit - 1; // We fetched one extra
    const hasNextPage = results.length > actualLimit;
    const data = hasNextPage ? results.slice(0, actualLimit) : results;
    const fields = normalizeFields(options.fields);

    let nextCursor = null;
    if (hasNextPage && data.length > 0) {
        const lastItem = data[data.length - 1];
        const cursorData = {};
        fields.forEach((field) => {
            cursorData[field.name] = lastItem[field.name];
        });
        nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
    }

    const pagination = {
        hasNextPage,
        nextCursor,
        pageSize: actualLimit,
        returnedCount: data.length
    };

    if (totalCount !== null) {
        pagination.totalCount = totalCount;
    }

    return { data, pagination };
}

module.exports = { buildCursorQuery, formatCursorResponse };
