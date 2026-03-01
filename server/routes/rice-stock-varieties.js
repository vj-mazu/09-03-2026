const express = require('express');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const Outturn = require('../models/Outturn');

const router = express.Router();

/**
 * Rice Stock Varieties API Endpoints
 * 
 * These endpoints provide standardized variety data specifically for rice stock operations
 * (Purchase, Sale, Palti). They work with outturn references instead of free-text varieties.
 * 
 * This API is separate from the unified-varieties endpoint which is used by arrivals
 * and other systems that continue to use free-text varieties.
 */

// Get standardized rice stock varieties from outturns
router.get('/rice-stock/varieties', auth, async (req, res) => {
    try {
        const {
            processing_type, // 'Raw' or 'Steam' filter
            search,          // Search term for variety name
            limit = 100,     // Limit results
            include_metadata = false // Include additional outturn metadata
        } = req.query;

        console.log('🔍 Fetching rice stock varieties with filters:', { processing_type, search, limit });

        // Build WHERE conditions
        const whereConditions = [];
        const bindParams = [];
        let paramIndex = 1;

        // Filter by processing type if specified
        if (processing_type && ['Raw', 'Steam'].includes(processing_type)) {
            whereConditions.push(`o.type = $${paramIndex}`);
            bindParams.push(processing_type);
            paramIndex++;
        }

        // Filter by search term if specified
        if (search && search.trim()) {
            whereConditions.push(`(
                UPPER(o."allottedVariety") LIKE UPPER($${paramIndex}) OR
                UPPER(CONCAT(o."allottedVariety", ' ', o.type)) LIKE UPPER($${paramIndex})
            )`);
            bindParams.push(`%${search.trim()}%`);
            paramIndex++;
        }

        // ✅ INCLUDE ALL OUTTURNS (even if cleared) - varieties should remain available
        // Removed filter: o.is_cleared = false

        const whereClause = whereConditions.length > 0
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        // Build SELECT fields based on metadata requirement
        const selectFields = include_metadata === 'true'
            ? `
                o.id,
                o.code,
                TRIM(UPPER(CONCAT(o."allottedVariety", ' ', o.type))) as standardized_variety,
                o."allottedVariety" as allotted_variety,
                o.type as processing_type,
                o."createdAt" as created_at,
                o.is_cleared,
                COUNT(rsm.id) as usage_count
            `
            : `
                o.id,
                o.code,
                TRIM(UPPER(CONCAT(o."allottedVariety", ' ', o.type))) as standardized_variety,
                o."allottedVariety" as allotted_variety,
                o.type as processing_type
            `;

        const groupByClause = include_metadata === 'true'
            ? 'GROUP BY o.id, o.code, o."allottedVariety", o.type, o."createdAt", o.is_cleared'
            : '';

        // Execute query
        const [varieties] = await sequelize.query(`
            SELECT ${selectFields}
            FROM outturns o
            ${include_metadata === 'true' ? 'LEFT JOIN rice_stock_movements rsm ON rsm.outturn_id = o.id AND rsm.status = \'approved\'' : ''}
            ${whereClause}
            ${groupByClause}
            ORDER BY o."allottedVariety", o.type
            LIMIT $${paramIndex}
        `, {
            bind: [...bindParams, parseInt(limit)]
        });

        console.log(`✅ Found ${varieties.length} rice stock varieties`);

        // Format response
        const response = {
            varieties: varieties.map(v => ({
                id: v.id,
                code: v.code,
                standardized_variety: v.standardized_variety,
                allotted_variety: v.allotted_variety,
                processing_type: v.processing_type,
                ...(include_metadata === 'true' && {
                    created_at: v.created_at,
                    is_cleared: v.is_cleared,
                    usage_count: parseInt(v.usage_count) || 0
                })
            })),
            total: varieties.length,
            filters: {
                processing_type: processing_type || 'all',
                search: search || '',
                limit: parseInt(limit)
            }
        };

        res.json(response);

    } catch (error) {
        console.error('❌ Error fetching rice stock varieties:', error);
        res.status(500).json({
            error: 'Failed to fetch rice stock varieties',
            message: error.message
        });
    }
});

// Validate rice stock variety selection
router.post('/rice-stock/varieties/validate', auth, async (req, res) => {
    try {
        const { outturn_id, variety_string } = req.body;

        console.log('🔍 Validating rice stock variety:', { outturn_id, variety_string });

        const validationResult = {
            is_valid: false,
            outturn_id: null,
            standardized_variety: null,
            suggestions: [],
            error: null
        };

        // Validate by outturn_id if provided
        if (outturn_id) {
            const outturn = await Outturn.findOne({
                where: {
                    id: outturn_id
                    // ✅ Removed is_cleared filter - allow cleared outturns
                },
                attributes: ['id', 'code', 'allottedVariety', 'type', 'is_cleared']
            });

            if (outturn) {
                validationResult.is_valid = true;
                validationResult.outturn_id = outturn.id;
                validationResult.standardized_variety = `${outturn.allottedVariety} ${outturn.type}`.toUpperCase().trim();
            } else {
                validationResult.error = 'Outturn not found or has been cleared';
            }
        }
        // Validate by variety string if provided
        else if (variety_string && variety_string.trim()) {
            const cleanVariety = variety_string.toUpperCase().trim();

            // Try exact match first
            const [exactMatches] = await sequelize.query(`
                SELECT 
                    o.id,
                    o.code,
                    TRIM(UPPER(CONCAT(o."allottedVariety", ' ', o.type))) as standardized_variety,
                    o."allottedVariety" as allotted_variety,
                    o.type as processing_type
                FROM outturns o
                WHERE TRIM(UPPER(CONCAT(o."allottedVariety", ' ', o.type))) = $1
                  -- ✅ Removed is_cleared filter - allow cleared outturns
                ORDER BY o."createdAt" DESC
                LIMIT 1
            `, {
                bind: [cleanVariety]
            });

            if (exactMatches.length > 0) {
                const match = exactMatches[0];
                validationResult.is_valid = true;
                validationResult.outturn_id = match.id;
                validationResult.standardized_variety = match.standardized_variety;
            } else {
                // No exact match - provide suggestions
                const [suggestions] = await sequelize.query(`
                    SELECT 
                        o.id,
                        o.code,
                        TRIM(UPPER(CONCAT(o."allottedVariety", ' ', o.type))) as standardized_variety,
                        o."allottedVariety" as allotted_variety,
                        o.type as processing_type,
                        CASE 
                            WHEN UPPER(o."allottedVariety") LIKE $1 THEN 3
                            WHEN UPPER(CONCAT(o."allottedVariety", ' ', o.type)) LIKE $1 THEN 2
                            ELSE 1
                        END as relevance_score
                    FROM outturns o
                    WHERE (
                        UPPER(o."allottedVariety") LIKE $1 OR
                        UPPER(CONCAT(o."allottedVariety", ' ', o.type)) LIKE $1
                    )
                    -- ✅ Removed is_cleared filter - allow cleared outturns
                    ORDER BY relevance_score DESC, o."allottedVariety", o.type
                    LIMIT 5
                `, {
                    bind: [`%${cleanVariety}%`]
                });

                validationResult.suggestions = suggestions.map(s => ({
                    id: s.id,
                    code: s.code,
                    standardized_variety: s.standardized_variety,
                    allotted_variety: s.allotted_variety,
                    processing_type: s.processing_type
                }));

                validationResult.error = `Variety "${variety_string}" not found. ${suggestions.length > 0 ? 'See suggestions below.' : 'No similar varieties found.'}`;
            }
        } else {
            validationResult.error = 'Either outturn_id or variety_string must be provided';
        }

        console.log(`✅ Validation result: ${validationResult.is_valid ? 'Valid' : 'Invalid'}`);

        res.json(validationResult);

    } catch (error) {
        console.error('❌ Error validating rice stock variety:', error);
        res.status(500).json({
            error: 'Failed to validate rice stock variety',
            message: error.message
        });
    }
});

// Get rice stock variety usage statistics
router.get('/rice-stock/varieties/:outturn_id/usage', auth, async (req, res) => {
    try {
        const { outturn_id } = req.params;
        const {
            start_date,
            end_date,
            movement_type, // 'purchase', 'sale', 'palti'
            location_code
        } = req.query;

        console.log(`🔍 Getting usage statistics for outturn ${outturn_id}`);

        // Build WHERE conditions
        const whereConditions = ['rsm.outturn_id = $1', 'rsm.status = \'approved\''];
        const bindParams = [parseInt(outturn_id)];
        let paramIndex = 2;

        if (start_date) {
            whereConditions.push(`rsm.date >= $${paramIndex}`);
            bindParams.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            whereConditions.push(`rsm.date <= $${paramIndex}`);
            bindParams.push(end_date);
            paramIndex++;
        }

        if (movement_type && ['purchase', 'sale', 'palti'].includes(movement_type)) {
            whereConditions.push(`rsm.movement_type = $${paramIndex}`);
            bindParams.push(movement_type);
            paramIndex++;
        }

        if (location_code) {
            whereConditions.push(`rsm.location_code = $${paramIndex}`);
            bindParams.push(location_code);
            paramIndex++;
        }

        const whereClause = whereConditions.join(' AND ');

        // Get usage statistics
        const [usageStats] = await sequelize.query(`
            SELECT 
                o.id as outturn_id,
                o.code as outturn_code,
                TRIM(UPPER(CONCAT(o."allottedVariety", ' ', o.type))) as standardized_variety,
                COUNT(rsm.id) as total_movements,
                SUM(rsm.bags) as total_bags,
                SUM(rsm.quantity_quintals) as total_quantity_quintals,
                MIN(rsm.date) as first_movement_date,
                MAX(rsm.date) as last_movement_date,
                COUNT(DISTINCT rsm.location_code) as locations_used,
                COUNT(DISTINCT rsm.movement_type) as movement_types_used,
                ARRAY_AGG(DISTINCT rsm.movement_type) as movement_types,
                ARRAY_AGG(DISTINCT rsm.location_code) as locations
            FROM outturns o
            LEFT JOIN rice_stock_movements rsm ON rsm.outturn_id = o.id
            WHERE o.id = $1 AND (rsm.id IS NULL OR (${whereClause}))
            GROUP BY o.id, o.code, o."allottedVariety", o.type
        `, {
            bind: bindParams
        });

        if (usageStats.length === 0) {
            return res.status(404).json({ error: 'Outturn not found' });
        }

        const stats = usageStats[0];

        // Get movement type breakdown
        const [movementBreakdown] = await sequelize.query(`
            SELECT 
                rsm.movement_type,
                COUNT(rsm.id) as movement_count,
                SUM(rsm.bags) as total_bags,
                SUM(rsm.quantity_quintals) as total_quantity_quintals
            FROM rice_stock_movements rsm
            WHERE ${whereClause}
            GROUP BY rsm.movement_type
            ORDER BY rsm.movement_type
        `, {
            bind: bindParams
        });

        const response = {
            outturn_id: stats.outturn_id,
            outturn_code: stats.outturn_code,
            standardized_variety: stats.standardized_variety,
            summary: {
                total_movements: parseInt(stats.total_movements) || 0,
                total_bags: parseInt(stats.total_bags) || 0,
                total_quantity_quintals: parseFloat(stats.total_quantity_quintals) || 0,
                first_movement_date: stats.first_movement_date,
                last_movement_date: stats.last_movement_date,
                locations_used: parseInt(stats.locations_used) || 0,
                movement_types_used: parseInt(stats.movement_types_used) || 0
            },
            breakdown_by_movement_type: movementBreakdown.map(b => ({
                movement_type: b.movement_type,
                movement_count: parseInt(b.movement_count),
                total_bags: parseInt(b.total_bags),
                total_quantity_quintals: parseFloat(b.total_quantity_quintals)
            })),
            locations: stats.locations || [],
            movement_types: stats.movement_types || [],
            filters: {
                start_date: start_date || null,
                end_date: end_date || null,
                movement_type: movement_type || 'all',
                location_code: location_code || 'all'
            }
        };

        console.log(`✅ Usage statistics retrieved for outturn ${outturn_id}`);
        res.json(response);

    } catch (error) {
        console.error('❌ Error getting rice stock variety usage:', error);
        res.status(500).json({
            error: 'Failed to get usage statistics',
            message: error.message
        });
    }
});

module.exports = router;