const express = require('express');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const LocationBifurcationService = require('../services/LocationBifurcationService');

const router = express.Router();
const cacheService = require('../services/cacheService');

// Robust string normalization helper (matches rice-stock.js)
const normalize = (str) => {
    if (!str) return '';
    return String(str)
        .toLowerCase()
        .trim()
        .replace(/[_\s-]+/g, ' '); // Standardize spaces, underscores, and hyphens
};

// Get rice stock movements with filtering and pagination - OPTIMIZED WITH CACHING
router.get('/movements', auth, async (req, res) => {
    const startTime = Date.now();
    try {
        const {
            year,
            month,
            dateFrom,
            dateTo,
            movementType,
            productType,
            approvalStatus,
            page = 1,
            limit = 50
        } = req.query;

        // Create cache key
        const cacheKey = `rice-movements:${page}:${limit}:${year || ''}:${month || ''}:${dateFrom || ''}:${dateTo || ''}:${movementType || ''}:${productType || ''}:${approvalStatus || ''}`;

        // Try cache first (60 second TTL)
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            const responseTime = Date.now() - startTime;
            return res.json({ ...cached, performance: { responseTime: `${responseTime}ms`, cached: true } });
        }

        // Build where clause
        const where = {};

        // OPTIMIZED: Combined date filtering logic
        const dateConditions = [];

        // 1. Month-wise filtering
        if (year && month) {
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
            dateConditions.push({
                [Op.gte]: startDate,
                [Op.lte]: endDate
            });
        }

        // 2. Date Range filtering
        if (dateFrom || dateTo) {
            const rangeCondition = {};
            if (dateFrom) rangeCondition[Op.gte] = dateFrom;
            if (dateTo) rangeCondition[Op.lte] = dateTo;
            dateConditions.push(rangeCondition);
        }

        // Combine date conditions
        if (dateConditions.length > 0) {
            if (dateConditions.length === 1) {
                where.date = dateConditions[0];
            } else {
                where.date = { [Op.and]: dateConditions };
            }
        }

        // Movement type filtering
        if (movementType) {
            where.movement_type = movementType;
        }

        // Product type filtering
        if (productType) {
            where.product_type = productType;
        }

        // Approval status filtering
        if (approvalStatus) {
            where.status = approvalStatus;
        }

        // Execute query with pagination — PARAMETERIZED for security
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Build parameterized WHERE clause
        const conditions = [];
        const replacements = {};

        if (where.date) {
            const dateObj = where.date;
            if (dateObj[Op.gte]) { conditions.push('rsm.date >= :dateGte'); replacements.dateGte = dateObj[Op.gte]; }
            if (dateObj[Op.lte]) { conditions.push('rsm.date <= :dateLte'); replacements.dateLte = dateObj[Op.lte]; }
            if (dateObj[Op.and]) {
                dateObj[Op.and].forEach((cond, i) => {
                    if (cond[Op.gte]) { conditions.push(`rsm.date >= :dateAndGte${i}`); replacements[`dateAndGte${i}`] = cond[Op.gte]; }
                    if (cond[Op.lte]) { conditions.push(`rsm.date <= :dateAndLte${i}`); replacements[`dateAndLte${i}`] = cond[Op.lte]; }
                });
            }
        }
        if (where.movement_type) { conditions.push('rsm.movement_type = :movementType'); replacements.movementType = where.movement_type; }
        if (where.product_type) { conditions.push('rsm.product_type = :productType'); replacements.productType = where.product_type; }
        if (where.status) { conditions.push('rsm.status = :status'); replacements.status = where.status; }

        const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

        replacements.limitVal = parseInt(limit);
        replacements.offsetVal = offset;

        const result = await sequelize.query(`
            SELECT 
                rsm.id as "id",
                rsm.date as "date",
                rsm.movement_type as "movementType",
                rsm.product_type as "productType",
                rsm.variety as "variety",
                rsm.bags as "bags",
                rsm.source_bags as "sourceBags",
                rsm.bag_size_kg as "bagSizeKg",
                rsm.quantity_quintals as "quantityQuintals",
                rsm.packaging_id as "packagingId",
                rsm.location_code as "locationCode",
                rsm.from_location as "fromLocation",
                rsm.to_location as "toLocation",
                rsm.bill_number as "billNumber",
                rsm.lorry_number as "lorryNumber",
                rsm.source_packaging_id as "sourcePackagingId",
                rsm.target_packaging_id as "targetPackagingId",
                rsm.conversion_shortage_kg as "conversionShortageKg",
                rsm.conversion_shortage_bags as "conversionShortageBags",
                rsm.status as "status",
                rsm.created_at as "createdAt",
                rsm.updated_at as "updatedAt",
                p1."brandName" as "packagingBrand",
                p1."allottedKg" as "packagingKg",
                p2."brandName" as "sourcePackagingBrand",
                p2."allottedKg" as "sourcePackagingKg",
                p3."brandName" as "targetPackagingBrand",
                p3."allottedKg" as "targetPackagingKg"
            FROM rice_stock_movements rsm
            LEFT JOIN packagings p1 ON rsm.packaging_id = p1.id
            LEFT JOIN packagings p2 ON rsm.source_packaging_id = p2.id
            LEFT JOIN packagings p3 ON rsm.target_packaging_id = p3.id
            WHERE ${whereClause}
            ORDER BY rsm.date DESC, rsm.created_at DESC
            LIMIT :limitVal OFFSET :offsetVal
        `, {
            replacements,
            type: sequelize.QueryTypes.SELECT
        });

        // Get total count only on first page for performance
        let total = result.length;
        let totalPages = 1;

        if (parseInt(page) === 1) {
            const countResult = await sequelize.query(`
                SELECT COUNT(*) as total
                FROM rice_stock_movements rsm
                WHERE ${whereClause}
            `, {
                replacements,
                type: sequelize.QueryTypes.SELECT
            });
            total = parseInt(countResult[0].total);
            totalPages = Math.ceil(total / parseInt(limit));
        }

        const responseData = {
            success: true,
            data: {
                movements: result,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalRecords: total,
                    recordsPerPage: parseInt(limit)
                }
            }
        };

        // Cache for 60 seconds
        await cacheService.set(cacheKey, responseData, 60);

        const responseTime = Date.now() - startTime;
        res.json({ ...responseData, performance: { responseTime: `${responseTime}ms`, cached: false } });
    } catch (error) {
        console.error('Error fetching rice stock movements:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch rice stock movements'
        });
    }
});

// Get pending rice stock movements for approval (managers/admins only)
router.get('/pending-list', auth, async (req, res) => {
    try {
        // Only managers and admins can view pending list
        if (req.user.role === 'staff') {
            return res.status(403).json({ success: false, error: 'Access denied. Manager or Admin role required.' });
        }

        const result = await sequelize.query(`
            SELECT 
                rsm.id,
                rsm.date,
                rsm.movement_type as "movementType",
                rsm.product_type as "productType",
                rsm.variety,
                rsm.bags,
                rsm.quantity_quintals as "quantityQuintals",
                rsm.location_code as "locationCode",
                rsm.lorry_number as "lorryNumber",
                rsm.bill_number as "billNumber",
                rsm.status,
                rsm.created_at as "createdAt",
                p.id as "packagingId",
                p."brandName" as "packagingBrand",
                p."allottedKg" as "packagingKg",
                u.username as "creatorUsername",
                u.role as "creatorRole"
            FROM rice_stock_movements rsm
            LEFT JOIN packagings p ON rsm.packaging_id = p.id
            LEFT JOIN users u ON rsm.created_by = u.id
            WHERE rsm.status = 'pending'
            ORDER BY rsm.date DESC, rsm.created_at DESC
        `, { type: sequelize.QueryTypes.SELECT });

        res.json({ success: true, movements: result });
    } catch (error) {
        console.error('Error fetching pending rice stock movements:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch pending rice stock movements' });
    }
});

// Bulk approve rice stock movements
router.post('/bulk-approve', auth, async (req, res) => {
    try {
        if (req.user.role === 'staff') {
            return res.status(403).json({ success: false, error: 'Access denied. Manager or Admin role required.' });
        }

        const { movementIds } = req.body;
        if (!movementIds || !Array.isArray(movementIds) || movementIds.length === 0) {
            return res.status(400).json({ success: false, error: 'Movement IDs are required' });
        }

        await sequelize.query(`
            UPDATE rice_stock_movements 
            SET status = 'approved', 
                approved_by = :userId, 
                approved_at = NOW()
            WHERE id IN (:ids) AND status = 'pending'
        `, {
            replacements: { userId: req.user.userId, ids: movementIds },
            type: sequelize.QueryTypes.UPDATE
        });

        // Clear cache
        await cacheService.clear();

        res.json({ success: true, message: `${movementIds.length} movement(s) approved successfully` });
    } catch (error) {
        console.error('Error bulk approving rice stock movements:', error);
        res.status(500).json({ success: false, error: 'Failed to approve rice stock movements' });
    }
});

// Bulk reject rice stock movements
router.post('/bulk-reject', auth, async (req, res) => {
    try {
        if (req.user.role === 'staff') {
            return res.status(403).json({ success: false, error: 'Access denied. Manager or Admin role required.' });
        }

        const { movementIds, remarks } = req.body;
        if (!movementIds || !Array.isArray(movementIds) || movementIds.length === 0) {
            return res.status(400).json({ success: false, error: 'Movement IDs are required' });
        }

        await sequelize.query(`
            UPDATE rice_stock_movements 
            SET status = 'rejected', 
                rejection_remarks = :remarks,
                rejected_by = :userId,
                rejected_at = NOW()
            WHERE id IN (:ids) AND status = 'pending'
        `, {
            replacements: { remarks: remarks || null, ids: movementIds, userId: req.user.userId },
            type: sequelize.QueryTypes.UPDATE
        });

        // Clear cache
        await cacheService.clear();

        res.json({ success: true, message: `${movementIds.length} movement(s) rejected successfully` });
    } catch (error) {
        console.error('Error bulk rejecting rice stock movements:', error);
        res.status(500).json({ success: false, error: 'Failed to reject rice stock movements' });
    }
});

// GET AVAILABLE STOCK - Check available stock for a specific product type, packaging, location, variety
// Updated to use enhanced RiceStockCalculationService with perfect variety-wise bifurcation
// Used by Palti/Sale modals to show real-time stock availability
router.get('/available-stock', auth, async (req, res) => {
    try {
        const { productType, packagingId, packagingBrand, bagSizeKg, locationCode, variety, outturnId, date } = req.query;

        if (!productType || !locationCode) {
            return res.status(400).json({
                success: false,
                error: 'productType and locationCode are required'
            });
        }

        // Require either variety string OR outturn ID
        if (!variety && !outturnId) {
            return res.status(400).json({
                success: false,
                error: 'Either variety or outturnId must be provided'
            });
        }

        console.log('📊 Checking available stock with enhanced perfect bifurcation:', {
            productType, packagingId, packagingBrand, bagSizeKg, locationCode, variety, outturnId, date
        });

        // Use the enhanced RiceStockCalculationService with perfect bifurcation
        const RiceStockCalculationService = require('../services/riceStockCalculationService');

        const stockInfo = await RiceStockCalculationService.calculateStockBalance({
            productType,
            packagingId: packagingId ? Number.parseInt(packagingId) : null,
            packagingBrand: packagingBrand || null,
            bagSizeKg: bagSizeKg ? Number.parseFloat(bagSizeKg) : null,
            locationCode,
            variety,
            outturnId: outturnId ? Number.parseInt(outturnId) : null,
            date: date || new Date().toISOString().split('T')[0],
            debugMode: true
        });

        console.log('✅ Enhanced available stock calculated:', stockInfo);

        res.json({
            success: true,
            productType,
            locationCode,
            variety: variety || null,
            completeVarietyText: stockInfo.completeVarietyText,
            outturnId: outturnId || null,
            packagingId: packagingId || null,
            packagingName: stockInfo.packagingName,
            bagSizeKg: stockInfo.bagSizeKg,
            availableQtls: stockInfo.availableQtls,
            availableBags: stockInfo.availableBags,
            groupingKey: stockInfo.groupingKey,
            calculationMethod: stockInfo.calculationMethod
        });

    } catch (error) {
        console.error('Error checking enhanced available stock:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check available stock',
            details: error.message
        });
    }
});

// GET VARIETIES WITH STOCK - Get varieties that actually have stock at a location
// Used by Sale/Palti modals to show only valid varieties for selection
router.get('/varieties-with-stock', auth, async (req, res) => {
    try {
        let { productType, locationCode, packagingId, date } = req.query;

        console.log('🔍 VARIETIES-WITH-STOCK API CALLED:', {
            productType,
            locationCode,
            packagingId,
            date,
            allParams: req.query
        });

        // PRODUCT TYPE MAPPING: Map frontend display names to database enum values
        const PRODUCT_TYPE_MAPPING = {
            'RJ Broken': 'Rejection Broken',
            'RJ Rice 2': 'RJ Rice 2',
            'RJ Rice 1': 'RJ Rice 1',
            '0 Broken': 'Zero Broken'
        };

        // Map the product type if needed
        if (productType && PRODUCT_TYPE_MAPPING[productType]) {
            console.log(`🔄 Mapping product type for varieties query: "${productType}" → "${PRODUCT_TYPE_MAPPING[productType]}"`);
            productType = PRODUCT_TYPE_MAPPING[productType];
        }

        // Check if location is direct load (Case insensitive)
        let isDirectLoad = false;
        if (locationCode) {
            const [locationInfo] = await sequelize.query(
                `SELECT is_direct_load FROM rice_stock_locations WHERE LOWER(code) = LOWER(:locationCode) LIMIT 1`,
                { replacements: { locationCode }, type: sequelize.QueryTypes.SELECT }
            );
            isDirectLoad = locationInfo?.is_direct_load || false;
        }

        // CRITICAL FIX: Product Type Aliasing for flexible matching
        const productTypeAliases = {
            'RJ Rice 1': ['RJ Rice 1', 'Rejection Rice 1', 'rj rice 1', 'rejection rice 1'],
            'RJ Rice (2)': ['RJ Rice (2)', 'RJ Rice 2', 'Rejection Rice 2', 'rj rice 2', 'rejection rice 2'],
            'RJ Broken': ['RJ Broken', 'Rejection Broken', 'rj broken', 'rejection broken'],
            'Rejection Broken': ['Rejection Broken', 'RJ Broken', 'rejection broken', 'rj broken'],
            '0 Broken': ['0 Broken', 'Zero Broken', '0broken', 'zero broken'],
            'Unpolish': ['Unpolish', 'Unpolished', 'unpolish', 'unpolished'],
            'Sizer Broken': ['Sizer Broken', 'sizer broken'],
            'Faram': ['Faram', 'faram', 'Farm'],
            'Broken': ['Broken', 'broken'],
            'Rice': ['Rice', 'rice'],
            'Bran': ['Bran', 'bran', 'Farm Bran']
        };

        const productTypeList = productType ? (productTypeAliases[productType] || [productType]) : null;

        console.log('📊 Fetching varieties with stock:', { productType, locationCode, packagingId, productTypeList });

        // Query to get unique varieties with positive stock from both movements and productions
        const varietiesQuery = `
            WITH combined_stock AS (
                SELECT 
                    lower(trim(regexp_replace(variety, '[_\\s-]+', ' ', 'g'))) as normalized_variety,
                    UPPER(TRIM(variety)) as original_variety,
                    SUM(CASE 
                        WHEN movement_type IN ('production', 'purchase') THEN quantity_quintals
                        WHEN movement_type = 'sale' THEN -quantity_quintals
                        WHEN movement_type = 'palti' AND source_packaging_id IS NOT NULL THEN -quantity_quintals
                        WHEN movement_type = 'palti' AND target_packaging_id IS NOT NULL THEN quantity_quintals
                        ELSE 0
                    END) as stock_qtls
                FROM rice_stock_movements
                WHERE status = 'approved'
                  ${productTypeList ? 'AND product_type IN (:productTypeList)' : ''}
                  ${locationCode ? 'AND location_code = :locationCode' : ''}
                  ${isDirectLoad && date ? 'AND date = :date' : ''}
                GROUP BY 1, 2
                
                UNION ALL
                
                SELECT 
                    lower(trim(regexp_replace(
                        CASE 
                            WHEN o.type IS NULL THEN TRIM(o."allottedVariety")
                            ELSE TRIM(o."allottedVariety" || ' ' || o.type)
                        END, 
                        '[_\\s-]+', ' ', 'g'
                    ))) as normalized_variety,
                    UPPER(CASE 
                        WHEN o.type IS NULL THEN TRIM(o."allottedVariety")
                        ELSE TRIM(o."allottedVariety" || ' ' || o.type)
                    END) as original_variety,
                    SUM(rp."quantityQuintals") as stock_qtls
                FROM rice_productions rp
                JOIN outturns o ON rp."outturnId" = o.id
                WHERE rp.status = 'approved'
                  ${productTypeList ? 'AND rp."productType" IN (:productTypeList)' : ''}
                  ${locationCode ? 'AND rp."locationCode" = :locationCode' : ''}
                  ${isDirectLoad && date ? 'AND rp.date = :date' : ''}
                GROUP BY 1, 2
            )
            SELECT 
                MAX(original_variety) as variety, 
                SUM(stock_qtls) as total_stock
            FROM combined_stock
            WHERE normalized_variety IS NOT NULL AND normalized_variety != ''
            GROUP BY normalized_variety
            HAVING SUM(stock_qtls) > 0.01
            ORDER BY 1
        `;

        const replacements = {
            productTypeList: productTypeList,
            locationCode: locationCode || null,
            date: date || null
        };

        const varieties = await sequelize.query(varietiesQuery, {
            replacements,
            type: sequelize.QueryTypes.SELECT
        });

        console.log(`✅ Found ${varieties.length} varieties with stock`);
        console.log('📊 Varieties details:', varieties.map(v => ({ name: v.variety, stock: v.total_stock })));

        const response = {
            success: true,
            varieties: varieties.map(v => ({
                name: v.variety,
                stockQtls: parseFloat(v.total_stock || 0).toFixed(2)
            }))
        };

        console.log('📤 Sending response:', response);

        res.json(response);

    } catch (error) {
        console.error('❌ Error fetching varieties with stock:', error);
        console.error('❌ Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch varieties with stock',
            details: error.message
        });
    }
});


// GET HIERARCHICAL VARIETY BIFURCATION - Shows palti conversions nested under source varieties
// Used to display variety-wise bifurcation with palti conversions as sub-entries
router.get('/hierarchical-variety-bifurcation', auth, async (req, res) => {
    try {
        const { productType = 'Rice', date } = req.query;

        console.log('🏗️ Getting hierarchical variety bifurcation:', {
            productType, date
        });

        const hierarchicalData = await LocationBifurcationService.getHierarchicalVarietyBifurcation({
            productType,
            date: date || new Date().toISOString().split('T')[0],
            debugMode: true
        });

        console.log('✅ Hierarchical variety bifurcation calculated:', hierarchicalData.summary);

        res.json({
            success: true,
            data: hierarchicalData
        });

    } catch (error) {
        console.error('Error getting hierarchical variety bifurcation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get hierarchical variety bifurcation',
            details: error.message
        });
    }
});

// GET RICE OPENING BALANCE - Calculate stock totals before a given date
router.get('/opening-balance', auth, async (req, res) => {
    const startTime = Date.now();

    try {
        const { beforeDate } = req.query;

        if (!beforeDate) {
            return res.status(400).json({ error: 'beforeDate is required (format: YYYY-MM-DD)' });
        }

        console.log(`📊 Calculating rice opening balance before ${beforeDate}...`);

        // RICE STOCK: Calculate net stock with PERFECT variety-wise bifurcation
        // Grouping: location + variety + packaging name + bag size
        const riceStockQuery = `
            WITH movement_sums AS (
                -- Purchase movements (addition)
                SELECT 
                    variety,
                    product_type::text as product_type,
                    packaging_id,
                    location_code,
                    SUM(bags) as movement_bags,
                    SUM(quantity_quintals) as movement_qtls
                FROM rice_stock_movements
                WHERE date < :beforeDate
                  AND status = 'approved'
                  AND movement_type = 'purchase'
                GROUP BY variety, product_type, packaging_id, location_code
                
                UNION ALL
                
                -- Sale movements (deduction)
                SELECT 
                    variety,
                    product_type::text as product_type,
                    packaging_id,
                    location_code,
                    SUM(-bags) as movement_bags,
                    SUM(-quantity_quintals) as movement_qtls
                FROM rice_stock_movements
                WHERE date < :beforeDate
                  AND status = 'approved'
                  AND movement_type = 'sale'
                GROUP BY variety, product_type, packaging_id, location_code
                
                UNION ALL
                
                -- Palti movements (source deduction + shortage)
                -- CRITICAL FIX: Use source_bags (original bags before conversion) + shortage
                SELECT 
                    variety,
                    product_type::text as product_type,
                    source_packaging_id as packaging_id,
                    location_code, -- source location
                    SUM(-(COALESCE(source_bags, bags) + COALESCE(conversion_shortage_bags, 0))) as movement_bags,
                    SUM(-(quantity_quintals + COALESCE(conversion_shortage_kg, 0)/100)) as movement_qtls
                FROM rice_stock_movements
                WHERE date < :beforeDate
                  AND status = 'approved'
                  AND movement_type = 'palti'
                  AND source_packaging_id IS NOT NULL
                GROUP BY variety, product_type, source_packaging_id, location_code
                
                UNION ALL
                
                -- Palti movements (target addition)
                -- CRITICAL FIX: Only include records with target_packaging_id set
                SELECT 
                    variety,
                    product_type::text as product_type,
                    target_packaging_id as packaging_id,
                    COALESCE(to_location, location_code) as location_code, -- target location
                    SUM(bags) as movement_bags,
                    SUM(quantity_quintals) as movement_qtls
                FROM rice_stock_movements
                WHERE date < :beforeDate
                  AND status = 'approved'
                  AND movement_type = 'palti'
                  AND target_packaging_id IS NOT NULL
                GROUP BY variety, product_type, target_packaging_id, COALESCE(to_location, location_code)
                
                UNION ALL
                
                -- Production movements (addition with outturn variety integration)
                SELECT 
                    UPPER(o."allottedVariety" || ' ' || o.type) as variety,
                    rp."productType"::text as product_type,
                    rp."packagingId" as packaging_id,
                    rp."locationCode" as location_code,
                    SUM(rp.bags) as movement_bags,
                    SUM(rp."quantityQuintals") as movement_qtls
                FROM rice_productions rp
                JOIN outturns o ON rp."outturnId" = o.id
                WHERE rp.date < :beforeDate
                  AND rp.status = 'approved'
                GROUP BY UPPER(o."allottedVariety" || ' ' || o.type), rp."productType", rp."packagingId", rp."locationCode"
            )
            SELECT 
                ms.variety,
                ms.product_type,
                ms.location_code as "locationCode",
                p."brandName" as "brandName",
                p."allottedKg" as "bagSizeKg", -- CRITICAL: Include bag size in grouping
                SUM(ms.movement_bags) as bags,
                SUM(ms.movement_qtls) as quintals
            FROM movement_sums ms
            LEFT JOIN packagings p ON ms.packaging_id = p.id
            -- Exclude DIRECT_LOAD locations (no carry-forward)
            LEFT JOIN rice_stock_locations rsl ON LOWER(REPLACE(ms.location_code, '_', ' ')) = LOWER(REPLACE(rsl.code, '_', ' '))
            WHERE COALESCE(rsl.is_direct_load, false) = false
            GROUP BY ms.variety, ms.product_type, ms.location_code, p."brandName", p."allottedKg"
            HAVING SUM(ms.movement_bags) != 0 OR SUM(ms.movement_qtls) != 0
            ORDER BY ms.location_code, ms.variety, p."brandName", p."allottedKg"
        `;

        const stockBalances = await sequelize.query(riceStockQuery, {
            replacements: { beforeDate },
            type: sequelize.QueryTypes.SELECT
        });

        const balances = {};
        stockBalances.forEach(row => {
            // Match frontend category logic with EXACT MATCH FIRST for 101% accuracy
            let category = 'Other';
            const productType = row.product_type;

            // PRIORITY 1: Exact matches for all known product types (case-sensitive)
            const exactProductTypes = {
                'Rice': 'Rice',
                'Bran': 'Bran',
                'Broken': 'Broken',
                'Faram': 'Faram',
                'Unpolish': 'Unpolish',
                '0 Broken': '0 Broken',
                'Zero Broken': '0 Broken',
                'Sizer Broken': 'Sizer Broken',
                'RJ Broken': 'RJ Broken',
                'Rejection Broken': 'RJ Broken',
                'RJ Rice 1': 'RJ Rice 1',
                'RJ Rice (2)': 'RJ Rice (2)',
                'RJ Rice 2': 'RJ Rice (2)',
            };

            // Check for exact match first
            if (exactProductTypes[productType]) {
                category = exactProductTypes[productType];
            } else {
                // PRIORITY 2: Case-insensitive exact match
                const productLower = (productType || '').toLowerCase();
                const exactMatchLower = Object.entries(exactProductTypes).find(
                    ([key]) => key.toLowerCase() === productLower
                );
                if (exactMatchLower) {
                    category = exactMatchLower[1];
                } else {
                    // PRIORITY 3: Includes-based fallback (for legacy/unexpected data)
                    if (productLower.includes('faram')) category = 'Faram';
                    else if (productLower.includes('unpolish')) category = 'Unpolish';
                    else if (productLower.includes('zero broken') || productLower.includes('0 broken')) category = '0 Broken';
                    else if (productLower.includes('sizer broken')) category = 'Sizer Broken';
                    else if (productLower.includes('rejection broken') || productLower.includes('rj broken')) category = 'RJ Broken';
                    else if (productLower.includes('rj rice 1')) category = 'RJ Rice 1';
                    else if (productLower.includes('rj rice 2') || productLower.includes('rj rice (2)')) category = 'RJ Rice (2)';
                    else if (productLower.includes('broken')) category = 'Broken';
                    else if (productLower.includes('rice') || productLower.includes('rj rice')) category = 'Rice';
                    else if (productLower.includes('bran')) category = 'Bran';
                }
            }

            // CRITICAL FIX: PERFECT VARIETY-WISE BIFURCATION
            // Group by: location + variety + packaging name + bag size
            const brandName = normalize(row.brandName || 'Unknown');
            const normVariety = normalize(row.variety);
            const normLoc = normalize(row.locationCode);
            const bagSize = row.bagSizeKg ? `${row.bagSizeKg}kg` : 'Unknown';

            // PERFECT GROUPING KEY: includes all 4 dimensions for precise bifurcation
            const key = `${normLoc}|${normVariety}|${category}|${brandName}|${bagSize}`;

            console.log(`🎯 Opening Stock Entry: ${normLoc} | ${normVariety} | ${category} | ${brandName} | ${bagSize} = ${parseFloat(row.quintals || 0).toFixed(2)} QTL, ${parseInt(row.bags || 0)} bags`);

            balances[key] = {
                locationCode: normLoc,           // 1. Location
                variety: normVariety,           // 2. Variety
                category: category,              // 3. Product Category  
                brandName: brandName,           // 4. Packaging Name
                bagSizeKg: row.bagSizeKg || 0, // 5. Bag Size
                bags: parseInt(row.bags) || 0,
                quintals: parseFloat(row.quintals) || 0
            };
        });

        console.log(`📊 Perfect Opening Stock Bifurcation: ${Object.keys(balances).length} unique stock entries found`);
        console.log('🔑 Grouping Logic: location|variety|category|brandName|bagSize');

        const responseTime = Date.now() - startTime;
        res.json({
            beforeDate,
            balances,
            performance: {
                responseTime: `${responseTime}ms`
            }
        });
    } catch (error) {
        console.error('Error calculating rice opening balance:', error);
        res.status(500).json({ error: 'Failed to calculate rice opening balance' });
    }
});

// GET RICE STOCK LEDGER - Combined audit trail of productions and movements
router.get('/ledger', auth, async (req, res) => {
    const startTime = Date.now();
    try {
        const { locationCode, dateFrom, dateTo, productType, page = 1, limit = 50 } = req.query;
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 50;
        const offset = (pageNum - 1) * limitNum;

        if (!locationCode) {
            return res.status(400).json({ success: false, error: 'locationCode is required' });
        }

        console.log(`📊 Generating rice ledger for ${locationCode} (page ${pageNum}, limit ${limitNum})...`);


        // 1. Calculate Opening Balance before dateFrom - ORIGINAL LOGIC (EXCLUDE DIRECT LOAD)
        const openingBalanceDate = dateFrom || '1970-01-01';

        const openingBalanceQuery = `
            WITH movement_sums AS (
                -- Sum from rice_stock_movements
                -- CRITICAL FIX: Use source_bags for palti deductions
                SELECT 
                    SUM(CASE 
                        WHEN movement_type = 'purchase' THEN bags 
                        WHEN movement_type = 'sale' THEN -bags
                        WHEN movement_type = 'palti' THEN (
                            CASE 
                                WHEN to_location = :locationCode AND (from_location = :locationCode OR location_code = :locationCode) THEN -COALESCE(conversion_shortage_bags, 0)
                                WHEN to_location = :locationCode THEN bags
                                WHEN from_location = :locationCode OR location_code = :locationCode THEN -(COALESCE(source_bags, bags) + COALESCE(conversion_shortage_bags, 0))
                                ELSE 0
                            END
                        )
                        ELSE 0
                    END) as opening_bags,
                    SUM(CASE 
                        WHEN movement_type = 'purchase' THEN quantity_quintals 
                        WHEN movement_type = 'sale' THEN -quantity_quintals
                        WHEN movement_type = 'palti' THEN (
                            CASE 
                                WHEN to_location = :locationCode AND (from_location = :locationCode OR location_code = :locationCode) THEN -(COALESCE(conversion_shortage_kg, 0)/100)
                                WHEN to_location = :locationCode THEN quantity_quintals
                                WHEN from_location = :locationCode OR location_code = :locationCode THEN -(quantity_quintals + COALESCE(conversion_shortage_kg, 0)/100)
                                ELSE 0
                            END
                        )
                        ELSE 0
                    END) as opening_qtls
                FROM rice_stock_movements rsm
                WHERE rsm.date < :openingDate
                  AND rsm.status = 'approved'
                  AND (rsm.location_code = :locationCode OR rsm.from_location = :locationCode OR rsm.to_location = :locationCode)
                  AND LOWER(REPLACE(rsm.location_code, '_', ' ')) NOT IN (SELECT LOWER(REPLACE(code, '_', ' ')) FROM rice_stock_locations WHERE is_direct_load = true)
                  AND LOWER(REPLACE(COALESCE(rsm.from_location, ''), '_', ' ')) NOT IN (SELECT LOWER(REPLACE(code, '_', ' ')) FROM rice_stock_locations WHERE is_direct_load = true)
                  AND LOWER(REPLACE(COALESCE(rsm.to_location, ''), '_', ' ')) NOT IN (SELECT LOWER(REPLACE(code, '_', ' ')) FROM rice_stock_locations WHERE is_direct_load = true)
                
                UNION ALL
                
                -- Sum from rice_productions
                SELECT 
                    SUM(rp.bags) as opening_bags,
                    SUM(rp."quantityQuintals") as opening_qtls
                FROM rice_productions rp
                WHERE rp.date < :openingDate
                  AND rp.status = 'approved'
                  AND rp."locationCode" = :locationCode
                  AND LOWER(REPLACE(rp."locationCode", '_', ' ')) NOT IN (SELECT LOWER(REPLACE(code, '_', ' ')) FROM rice_stock_locations WHERE is_direct_load = true)
            )
            SELECT 
                COALESCE(SUM(opening_bags), 0) as bags,
                COALESCE(SUM(opening_qtls), 0) as quintals
            FROM movement_sums
        `;

        const openingBalanceResult = await sequelize.query(openingBalanceQuery, {
            replacements: { locationCode, openingDate: openingBalanceDate },
            type: sequelize.QueryTypes.SELECT
        });

        const openingBalance = {
            bags: parseInt(openingBalanceResult[0].bags) || 0,
            quintals: parseFloat(openingBalanceResult[0].quintals) || 0
        };

        // 2. Get total count for pagination
        const countQuery = `
            SELECT COUNT(*) as total FROM (
                SELECT rp.id
                FROM rice_productions rp
                JOIN outturns o ON rp."outturnId" = o.id
                WHERE rp."locationCode" = :locationCode
                  AND (:dateFrom IS NULL OR rp.date >= :dateFrom)
                  AND (:dateTo IS NULL OR rp.date <= :dateTo)
                  AND (:productType IS NULL OR rp."productType" = :productType)
                UNION ALL
                SELECT rsm.id
                FROM rice_stock_movements rsm
                WHERE (rsm.location_code = :locationCode OR rsm.from_location = :locationCode OR rsm.to_location = :locationCode)
                  AND (:dateFrom IS NULL OR rsm.date >= :dateFrom)
                  AND (:dateTo IS NULL OR rsm.date <= :dateTo)
                  AND (:productType IS NULL OR rsm.product_type = :productType)
            ) as combined_count
        `;

        const countResult = await sequelize.query(countQuery, {
            replacements: {
                locationCode,
                dateFrom: dateFrom || null,
                dateTo: dateTo || null,
                productType: productType || null
            },
            type: sequelize.QueryTypes.SELECT
        });

        const totalRecords = parseInt(countResult[0].total) || 0;
        const totalPages = Math.ceil(totalRecords / limitNum) || 1;

        // 3. Fetch entries within date range with pagination - SIMPLE DIRECT LOAD FIX
        const entriesQuery = `
            SELECT * FROM (
                -- Production Entries
                SELECT
                    rp.id as "id",
                    rp.date as "date",
                    'production' as "movementType",
                    rp."productType"::text as "productType",
                    UPPER(o."allottedVariety" || ' ' || o.type) as "variety",
                    rp.bags as "bags",
                    NULL::integer as "sourceBags",
                    rp."quantityQuintals" as "quantityQuintals",
                    NULL::numeric as "bagSizeKg",
                    NULL::numeric as "sourcePackagingKg",
                    p."brandName" as "packagingBrand",
                    rp."locationCode" as "locationCode",
                    NULL as "partyName",
                    rp."billNumber" as "billNumber",
                    rp."lorryNumber" as "lorryNumber",
                    rp.status::text as "status",
                    rp."createdAt" as "createdAt",
                    NULL as "fromLocation",
                    NULL as "toLocation",
                    NULL as "conversionShortageKg",
                    NULL as "conversionShortageBags",
                    NULL as "sourcePackagingBrand",
                    NULL as "targetPackagingBrand"
                FROM rice_productions rp
                JOIN outturns o ON rp."outturnId" = o.id
                LEFT JOIN packagings p ON rp."packagingId" = p.id
                WHERE rp."locationCode" = :locationCode
                  AND (:dateFrom IS NULL OR rp.date >= :dateFrom)
                  AND (:dateTo IS NULL OR rp.date <= :dateTo)
                  AND (:productType IS NULL OR rp."productType" = :productType)

                UNION ALL

                -- Stock Movements (Purchase, Sale, Palti)
                SELECT 
                    rsm.id as "id",
                    rsm.date as "date",
                    rsm.movement_type as "movementType",
                    rsm.product_type::text as "productType",
                    rsm.variety as "variety",
                    rsm.bags as "bags",
                    rsm.source_bags as "sourceBags",
                    rsm.quantity_quintals as "quantityQuintals",
                    rsm.bag_size_kg as "bagSizeKg",
                    p2."allottedKg" as "sourcePackagingKg",
                    p1."brandName" as "packagingBrand",
                    rsm.location_code as "locationCode",
                    rsm.party_name as "partyName",
                    rsm.bill_number as "billNumber",
                    rsm.lorry_number as "lorryNumber",
                    rsm.status::text as "status",
                    rsm.created_at as "createdAt",
                    rsm.from_location as "fromLocation",
                    rsm.to_location as "toLocation",
                    rsm.conversion_shortage_kg as "conversionShortageKg",
                    rsm.conversion_shortage_bags as "conversionShortageBags",
                    p2."brandName" as "sourcePackagingBrand",
                    p3."brandName" as "targetPackagingBrand"
                FROM rice_stock_movements rsm
                LEFT JOIN packagings p1 ON rsm.packaging_id = p1.id
                LEFT JOIN packagings p2 ON rsm.source_packaging_id = p2.id
                LEFT JOIN packagings p3 ON rsm.target_packaging_id = p3.id
                WHERE (rsm.location_code = :locationCode OR rsm.from_location = :locationCode OR rsm.to_location = :locationCode)
                  AND (:dateFrom IS NULL OR rsm.date >= :dateFrom)
                  AND (:dateTo IS NULL OR rsm.date <= :dateTo)
                  AND (:productType IS NULL OR rsm.product_type = :productType)
            ) as combined_entries
            ORDER BY date ASC, "createdAt" ASC
            LIMIT :limitNum OFFSET :offset
        `;

        const entries = await sequelize.query(entriesQuery, {
            replacements: {
                locationCode,
                dateFrom: dateFrom || null,
                dateTo: dateTo || null,
                productType: productType || null,
                limitNum,
                offset
            },
            type: sequelize.QueryTypes.SELECT
        });


        // 3. Process entries and calculate running balance
        let runningBags = openingBalance.bags;
        let runningQtls = openingBalance.quintals;

        const totals = {
            production: { bags: 0, quintals: 0 },
            purchase: { bags: 0, quintals: 0 },
            sale: { bags: 0, quintals: 0 },
            palti: { bags: 0, quintals: 0 },
            balance: { bags: 0, quintals: 0 }
        };

        const processedEntries = entries.map(entry => {
            const bags = parseInt(entry.bags || entry.BAGS || entry.Bags) || 0;
            const bagSize = parseFloat(entry.bagSizeKg || entry.bag_size_kg || entry.bagsizekg || 26);

            // Robust quintals extraction
            let qtls = parseFloat(entry.quantityQuintals || entry.quantity_quintals || entry.quantityquintals || entry.QuantityQuintals || entry.QUANTITYQUINTALS);
            if (isNaN(qtls) || qtls === 0) {
                qtls = (bags * bagSize) / 100;
            }

            const type = (entry.movementType || entry.movement_type || entry.movementtype || entry.MOVEMENTTYPE || '').toLowerCase();

            let isInward = false;
            let isOutward = false;

            if (type === 'production' || type === 'purchase') {
                isInward = true;
                if (totals[type]) {
                    totals[type].bags += bags;
                    totals[type].quintals += qtls;
                }
                runningBags += bags;
                runningQtls += qtls;
            } else if (type === 'sale') {
                isOutward = true;
                totals.sale.bags += bags;
                totals.sale.quintals += qtls;
                runningBags -= bags;
                runningQtls -= qtls;
            } else if (type === 'palti') {
                const entryToLoc = (entry.toLocation || entry.to_location || entry.tolocation || '').toString();
                const entryFromLoc = (entry.fromLocation || entry.from_location || entry.fromlocation || entry.locationCode || entry.location_code || '').toString();

                const shortageBags = parseFloat(entry.conversionShortageBags || entry.conversion_shortage_bags || 0);
                const shortageQtls = parseFloat(entry.conversionShortageKg || entry.conversion_shortage_kg || 0) / 100;

                if (entryToLoc === locationCode && entryFromLoc === locationCode) {
                    // Internal Palti - only shortage affects balance
                    isInward = true;
                    isOutward = false;
                    runningBags -= shortageBags;
                    runningQtls -= shortageQtls;
                    entry.packagingBrand = `${entry.sourcePackagingBrand || 'Unknown'} \u2192 ${entry.targetPackagingBrand || 'Unknown'}`;
                } else if (entryToLoc === locationCode) {
                    // Inward from another location
                    isInward = true;
                    isOutward = false;
                    runningBags += bags;
                    runningQtls += qtls;
                    entry.packagingBrand = entry.targetPackagingBrand || entry.packagingBrand;
                    entry.partyName = `From: ${entryFromLoc}`;
                } else if (entryFromLoc === locationCode) {
                    // Outward to another location
                    isInward = false;
                    isOutward = true;

                    // FIX: Calculate source bags from quintals if not stored
                    let sourceBagsToDeduct;
                    const entrySourceBags = parseInt(entry.sourceBags || entry.source_bags || 0);
                    if (entrySourceBags > 0) {
                        sourceBagsToDeduct = entrySourceBags;
                    } else {
                        // Calculate from quintals and source packaging kg
                        const sourceKg = parseFloat(entry.sourcePackagingKg || entry.source_packaging_kg || bagSize || 26);
                        sourceBagsToDeduct = Math.round(((qtls + shortageQtls) * 100) / sourceKg);
                    }

                    runningBags -= (sourceBagsToDeduct + shortageBags);
                    runningQtls -= (qtls + shortageQtls);
                    entry.packagingBrand = entry.sourcePackagingBrand || 'Unknown';
                    entry.partyName = `To: ${entryToLoc}`;
                } else {
                    isInward = false;
                    isOutward = false;
                }

                totals.palti.bags += bags;
                totals.palti.quintals += qtls;
            }

            return {
                ...entry,
                bags,
                quantityQuintals: qtls,
                isInward,
                isOutward,
                runningBalance: runningBags,
                runningBalanceQtls: runningQtls
            };
        });

        totals.balance.bags = runningBags;
        totals.balance.quintals = runningQtls;

        const responseTime = Date.now() - startTime;
        res.json({
            success: true,
            data: {
                location: { code: locationCode },
                openingBalance,
                entries: processedEntries,
                totals,
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalRecords,
                    recordsPerPage: limitNum
                }
            },
            performance: { responseTime: `${responseTime}ms` }
        });

    } catch (error) {
        console.error('Error generating rice ledger:', error);
        res.status(500).json({ success: false, error: 'Failed to generate rice ledger' });
    }
});

// Get pending rice stock movements (for admin approval)
router.get('/movements/pending', auth, async (req, res) => {
    try {
        // Only admin can see pending movements
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Only admin can view pending movements'
            });
        }

        const result = await sequelize.query(`
            SELECT
                rsm.id,
                rsm.date,
                rsm.movement_type,
                rsm.product_type,
                rsm.variety,
                rsm.bags,
                rsm.bag_size_kg,
                rsm.quantity_quintals,
                rsm.packaging_id,
                rsm.location_code,
                rsm.from_location,
                rsm.to_location,
                rsm.bill_number,
                rsm.lorry_number,
                rsm.source_packaging_id,
                rsm.target_packaging_id,
                rsm.conversion_shortage_kg,
                rsm.conversion_shortage_bags,
                rsm.status,
                rsm.created_at,
                rsm.created_by,
                p1."brandName" as packaging_brand,
                p1."allottedKg" as packaging_kg,
                p2."brandName" as source_packaging_brand,
                p2."allottedKg" as source_packaging_kg,
                p3."brandName" as target_packaging_brand,
                p3."allottedKg" as target_packaging_kg,
                u.username as created_by_username
            FROM rice_stock_movements rsm
            LEFT JOIN packagings p1 ON rsm.packaging_id = p1.id
            LEFT JOIN packagings p2 ON rsm.source_packaging_id = p2.id
            LEFT JOIN packagings p3 ON rsm.target_packaging_id = p3.id
            LEFT JOIN users u ON rsm.created_by = u.id
            WHERE rsm.status = 'pending'
            ORDER BY rsm.created_at DESC
        `, {
            type: sequelize.QueryTypes.SELECT
        });

        res.json({
            success: true,
            data: {
                movements: result,
                count: result.length
            }
        });
    } catch (error) {
        console.error('Error fetching pending rice stock movements:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch pending rice stock movements'
        });
    }
});

// Create new rice stock movement
router.post('/movements', auth, async (req, res) => {
    try {
        const {
            date,
            movementType,
            productType: frontendProductType,
            variety,
            outturnId, // NEW: outturn ID for variety standardization
            bags,
            sourceBags, // For palti operations
            quantityQuintals,
            packagingBrand,
            packagingKg,
            bagSizeKg, // Alternative field name from frontend
            packagingId, // Frontend sends ID, need to resolve to brand
            locationCode,
            fromLocation,
            toLocation,
            billNumber,
            lorryNumber,
            sourcePackagingBrand,
            sourcePackagingKg,
            sourcePackagingId, // Frontend sends ID, need to resolve
            targetPackagingBrand,
            targetPackagingKg,
            targetPackagingId, // Frontend sends ID, need to resolve
            conversionShortageKg: requestedShortageKg, // Direct from frontend
            conversionShortageBags: requestedShortageBags // Direct from frontend
        } = req.body;

        // PRODUCT TYPE MAPPING: Map frontend display names to database enum values
        const PRODUCT_TYPE_MAPPING = {
            'RJ Broken': 'Rejection Broken',
            'RJ Rice 2': 'RJ Rice 2',
            'RJ Rice 1': 'RJ Rice 1',
            '0 Broken': 'Zero Broken'
        };

        // Map the product type if needed
        const productType = PRODUCT_TYPE_MAPPING[frontendProductType] || frontendProductType;

        // Log mapping for debugging
        if (frontendProductType !== productType) {
            console.log(`🔄 Product type mapped: "${frontendProductType}" → "${productType}"`);
        }

        // ✅ NEW: VARIETY NORMALIZATION - Fetch standardized variety from outturn if outturnId provided
        let finalVariety = variety;

        if (outturnId) {
            try {
                const [outturnResult] = await sequelize.query(`
                    SELECT UPPER("allottedVariety" || ' ' || type) as standardized_variety
                    FROM outturns
                    WHERE id = :outturnId
                `, {
                    replacements: { outturnId: parseInt(outturnId) },
                    type: sequelize.QueryTypes.SELECT
                });

                if (outturnResult && outturnResult.standardized_variety) {
                    finalVariety = outturnResult.standardized_variety;
                    console.log(`✅ Variety standardized from outturn ${outturnId}: ${finalVariety}`);
                }
            } catch (error) {
                console.warn('⚠️ Could not fetch variety from outturn:', error.message);
            }
        }

        // Fallback to provided variety or default
        finalVariety = finalVariety || variety || 'SUM25 RNR RAW';
        console.log(`📊 Final variety for storage: ${finalVariety}`);

        console.log('📥 Rice stock movement creation request:', { ...req.body, productType, finalVariety });


        // Validation
        if (!date || !movementType || !productType || !locationCode) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: date, movementType, productType, locationCode'
            });
        }

        // ⚡ PERFORMANCE: Cache rice stock locations in memory (eliminates 41ms query)
        if (!global.riceStockLocationsCache) {
            const [locations] = await sequelize.query(
                `SELECT code, is_direct_load FROM rice_stock_locations`,
                { type: sequelize.QueryTypes.SELECT }
            );
            global.riceStockLocationsCache = new Map(
                locations.map(loc => [loc.code.toLowerCase().replace(/[_\s]/g, ''), loc.is_direct_load])
            );
            console.log(`⚡ Cached ${locations.length} rice stock locations`);
        }

        // Ultra-fast cached lookup (< 1ms instead of 41ms)
        const normalizedLocationCode = locationCode.toLowerCase().replace(/[_\s]/g, '');
        const isDirectLoad = global.riceStockLocationsCache.get(normalizedLocationCode) || false;

        // Validate movement type
        const validMovementTypes = ['purchase', 'sale', 'palti'];
        if (!validMovementTypes.includes(movementType)) {
            return res.status(400).json({
                success: false,
                error: `Invalid movement type. Must be one of: ${validMovementTypes.join(', ')}`
            });
        }

        // MANDATORY PACKAGING VALIDATION FOR SALE OPERATIONS
        // Packaging must be selected for sale operations
        if (movementType === 'sale') {
            if (!packagingId) {
                return res.status(400).json({
                    success: false,
                    error: 'Packaging selection is required for sale operations',
                    details: 'Please select a packaging before creating a sale'
                });
            }
        }

        // STOCK VALIDATION FOR PALTI OPERATIONS
        // STRICT CHECK: Block if insufficient stock for EXACT product type + location + packaging
        if (movementType === 'palti' && sourcePackagingId && sourceBags) {
            try {
                // PHASE 3: TYPE CONVERSION VALIDATION
                // Validate that source and target product types are in the same category
                const { canConvertTypes, getProductTypeCategory } = require('../utils/productTypeCategories');

                // Get target product type from request (palti operations change product type)
                // Apply same mapping as source product type
                const frontendTargetProductType = req.body.targetProductType || productType;
                const targetProductType = PRODUCT_TYPE_MAPPING[frontendTargetProductType] || frontendTargetProductType;

                // Log mapping for debugging
                if (frontendTargetProductType !== targetProductType) {
                    console.log(`🔄 Target product type mapped: "${frontendTargetProductType}" → "${targetProductType}"`);
                }

                if (!canConvertTypes(productType, targetProductType)) {
                    const sourceCategory = getProductTypeCategory(productType);
                    const targetCategory = getProductTypeCategory(targetProductType);

                    console.log(`❌ Invalid type conversion blocked: ${productType} (${sourceCategory}) → ${targetProductType} (${targetCategory})`);

                    return res.status(400).json({
                        success: false,
                        error: 'Invalid type conversion',
                        details: {
                            sourceType: productType,
                            sourceCategory,
                            targetType: targetProductType,
                            targetCategory,
                            message: `Cannot convert ${sourceCategory} (${productType}) to ${targetCategory} (${targetProductType}). Only same-category conversions allowed.`,
                            allowedConversions: {
                                'RICE → RICE': 'Rice, RJ Rice 1, RJ Rice 2, RJ Rice (2), Rejection Rice, Unpolished, Unpolish',
                                'BROKEN → BROKEN': 'Sizer Broken, Rejection Broken, RJ Broken, Broken, Zero Broken, 0 Broken',
                                'BRAN → BRAN': 'Bran, Farm Bran',
                                'OTHER → OTHER': 'Faram, Farm'
                            }
                        }
                    });
                }

                console.log(`✅ Type conversion validation passed: ${productType} → ${targetProductType} (same category)`);

                console.log('🔍 Validating palti stock availability (STRICT check - product type + location + packaging)...');

                // Get source packaging details for accurate stock check
                const [sourcePackagingInfo] = await sequelize.query(
                    `SELECT "brandName", "allottedKg" FROM packagings WHERE id = :sourcePackagingId`,
                    { replacements: { sourcePackagingId: parseInt(sourcePackagingId) }, type: sequelize.QueryTypes.SELECT }
                );
                const sourcePackagingBrandName = sourcePackagingInfo?.brandName || 'Unknown';
                const sourcePackagingKgValue = parseFloat(sourcePackagingInfo?.allottedKg || 26);

                // CRITICAL FIX: Product Type Aliasing for flexible matching
                // Maps frontend product types to backend/database variations
                const productTypeAliases = {
                    'RJ Rice 1': ['RJ Rice 1', 'Rejection Rice 1', 'rj rice 1', 'rejection rice 1'],
                    'RJ Rice (2)': ['RJ Rice (2)', 'RJ Rice 2', 'Rejection Rice 2', 'rj rice 2', 'rejection rice 2'],
                    'RJ Broken': ['RJ Broken', 'Rejection Broken', 'rj broken', 'rejection broken'],
                    'Rejection Broken': ['Rejection Broken', 'RJ Broken', 'rejection broken', 'rj broken'],
                    '0 Broken': ['0 Broken', 'Zero Broken', '0broken', 'zero broken'],
                    'Unpolish': ['Unpolish', 'Unpolished', 'unpolish', 'unpolished'],
                    'Sizer Broken': ['Sizer Broken', 'sizer broken'],
                    'Faram': ['Faram', 'faram', 'Farm'],
                    'Broken': ['Broken', 'broken'],
                    'Rice': ['Rice', 'rice'],
                    'Bran': ['Bran', 'bran', 'Farm Bran']
                };

                // Get product type aliases for matching
                const productTypeList = productTypeAliases[productType] || [productType];
                console.log('📊 Product type aliases for matching:', { original: productType, aliases: productTypeList });

                // CRITICAL FIX: Use Smart Variety Matching for palti operations
                // Same aliasing logic as /available-stock endpoint
                const requestedVar = normalize(variety);
                const varietyAliases = [requestedVar];

                if (requestedVar.includes('raw')) {
                    varietyAliases.push(requestedVar.replace('raw', '').trim());
                } else if (!requestedVar.includes('steam')) {
                    varietyAliases.push(`${requestedVar} raw`);
                }
                const safeAliases = varietyAliases.map(v => normalize(v)).filter(v => v);

                // CRITICAL FIX: For past-dated Palti, calculate stock AS IT EXISTED on that date
                // This means: include transactions UP TO AND INCLUDING the Palti date,
                // but EXCLUDE any transactions that happened AFTER the Palti date
                const stockCheckResult = await sequelize.query(`
                    -- COMPLETE 5-DIMENSION VALIDATION FOR PALTI WITH DATE-BASED STOCK CALCULATION
                    -- Checks: location_code + product_type + variety + packaging_id + bag_size_kg
                    -- CRITICAL: Calculates stock as it existed on the specified date
                    WITH movement_stock AS (
                        SELECT 
                            COALESCE(SUM(CASE 
                                WHEN movement_type IN ('production', 'purchase') AND packaging_id = :sourcePackagingId THEN quantity_quintals
                                WHEN movement_type = 'sale' AND packaging_id = :sourcePackagingId THEN -quantity_quintals
                                WHEN movement_type = 'palti' AND source_packaging_id = :sourcePackagingId THEN -quantity_quintals
                                WHEN movement_type = 'palti' AND target_packaging_id = :sourcePackagingId THEN quantity_quintals
                                ELSE 0
                            END), 0) as movement_qtls
                        FROM rice_stock_movements 
                        WHERE status = 'approved' 
                          AND location_code = :locationCode
                          AND product_type IN (:productTypeList)
                          AND (CASE 
                            WHEN :isDirectLoad THEN date = :date
                            ELSE date <= :date
                          END)
                          ${variety && safeAliases.length > 0 ? "AND lower(trim(regexp_replace(variety, '[_\\s-]+', ' ', 'g'))) IN (:varietyAliases)" : ''}
                    ),
                    production_stock AS (
                        SELECT COALESCE(SUM(rp."quantityQuintals"), 0) as prod_qtls
                        FROM rice_productions rp
                        LEFT JOIN outturns o ON rp."outturnId" = o.id
                        WHERE rp."locationCode" = :locationCode
                          AND rp."productType" IN (:productTypeList)
                          AND rp.status = 'approved'
                          AND rp."packagingId" = :sourcePackagingId
                          AND (CASE 
                            WHEN :isDirectLoad THEN rp.date = :date
                            ELSE rp.date <= :date
                          END)
                          ${variety && safeAliases.length > 0 ? "AND lower(trim(regexp_replace(o.\"allottedVariety\" || ' ' || o.type, '[_\\s-]+', ' ', 'g'))) IN (:varietyAliases)" : ''}
                    )
                    SELECT 
                        (COALESCE(ms.movement_qtls, 0) + COALESCE(ps.prod_qtls, 0)) as available_qtls
                    FROM movement_stock ms, production_stock ps
                `, {
                    replacements: {
                        sourcePackagingId: parseInt(sourcePackagingId),
                        locationCode: locationCode,
                        productTypeList: productTypeList,
                        varietyAliases: safeAliases.length > 0 ? safeAliases : [''],
                        date, // This is the Palti date - stock is calculated up to this date
                        isDirectLoad
                    },
                    type: sequelize.QueryTypes.SELECT
                });

                console.log('📅 DATE-BASED STOCK VALIDATION:', {
                    paltiDate: date,
                    stockCalculatedUpTo: date,
                    note: 'Stock calculated as it existed on the Palti date (excluding future transactions)'
                });

                const availableQtls = parseFloat(stockCheckResult[0]?.available_qtls || 0);

                // Calculate requested quintals (source weight including shortage)
                let reqQtls = 0;
                if (req.body.quantityQuintals) {
                    reqQtls = parseFloat(req.body.quantityQuintals);
                } else {
                    reqQtls = (parseInt(sourceBags) * sourcePackagingKgValue) / 100;
                }

                console.log('📊 Palti Stock validation (Complete 5-Dimension Check):', {
                    location: locationCode,
                    productType: productType,
                    packaging: sourcePackagingBrandName,
                    packagingKg: sourcePackagingKgValue,
                    variety: variety,
                    varietyAliases: safeAliases,
                    availableQtls,
                    requestedQtls: reqQtls,
                    dimensionsChecked: '✓ location + type + variety + packaging + bag_size'
                });

                // STRICT VALIDATION - Block if insufficient stock for EXACT match
                if (availableQtls < reqQtls) {
                    const today = new Date().toISOString().split('T')[0];
                    const isPastDate = date < today;

                    console.log(`❌ Insufficient Palti stock for ${productType}: Available ${availableQtls.toFixed(2)} Q, Requested ${reqQtls.toFixed(2)} Q`);

                    return res.status(400).json({
                        success: false,
                        error: isPastDate
                            ? `Insufficient ${productType} stock on ${date}. Stock available on that date: ${availableQtls.toFixed(2)} QTL, Required: ${reqQtls.toFixed(2)} QTL`
                            : `Insufficient ${productType} stock with exact dimensions at ${locationCode}`,
                        details: {
                            productType,
                            location: locationCode,
                            packaging: sourcePackagingBrandName,
                            bagSizeKg: sourcePackagingKgValue,
                            variety,
                            paltiDate: date,
                            isPastDate,
                            availableQtls: parseFloat(availableQtls.toFixed(2)),
                            requestedQtls: parseFloat(reqQtls.toFixed(2)),
                            shortfall: parseFloat((reqQtls - availableQtls).toFixed(2)),
                            message: isPastDate
                                ? `Cannot create Palti for ${date} because insufficient stock existed on that date. Stock on ${date}: ${availableQtls.toFixed(2)} QTL, Required: ${reqQtls.toFixed(2)} QTL`
                                : `Stock not found for exact combination: ${productType} + ${variety} + ${sourcePackagingKgValue}kg + ${sourcePackagingBrandName} at ${locationCode}`,
                            dimensionsChecked: 'location + type + variety + packaging + bag_size',
                            suggestion: isPastDate
                                ? `The stock you see today may be different from what existed on ${date}. Please check the stock report for ${date} to verify available stock on that date.`
                                : 'Verify all dimensions match exactly: location, product type, variety, packaging, and bag size'
                        }
                    });
                } else {
                    console.log('✅ Palti stock validation passed - Complete 5-dimension match');
                }

            } catch (stockError) {
                console.error('⚠️ Stock validation check failed:', stockError.message);
                return res.status(400).json({ success: false, error: 'Stock validation failed: ' + stockError.message });
            }
        }


        // ENHANCED STOCK VALIDATION FOR SALE OPERATIONS
        // CRITICAL FIX: Uses date-aware group-based stock tracking to prevent sales after palti consumes stock
        if (movementType === 'sale' && locationCode && bags) {
            try {
                console.log('🔍 Validating sale stock availability with date-aware bifurcation...');
                console.log('📊 Sale validation params:', {
                    productType,
                    packagingId,
                    packagingBrand,
                    bagSizeKg,
                    locationCode,
                    variety,
                    bags,
                    date
                });

                // CRITICAL: Validate sale against opening stock minus palti operations on same date
                const validation = await LocationBifurcationService.validateSaleAfterPalti({
                    locationCode,
                    variety,
                    productType,
                    packagingId: packagingId ? Number.parseInt(packagingId) : null,
                    packagingBrand: packagingBrand || null,
                    bagSizeKg: bagSizeKg ? Number.parseFloat(bagSizeKg) : null,
                    requestedBags: Number.parseInt(bags),
                    saleDate: date,
                    debugMode: true
                });

                console.log('📊 Date-Aware Sale Stock Validation Result:', {
                    locationCode,
                    productType,
                    variety,
                    openingStock: validation.openingStock,
                    paltiDeductions: validation.paltiDeductions,
                    remainingStock: validation.remainingStock,
                    requestedBags: validation.requestedBags,
                    isValid: validation.isValid,
                    groupKey: validation.groupKey
                });

                // STRICT VALIDATION - Block if insufficient stock after palti operations
                if (!validation.isValid) {
                    console.log(`❌ Insufficient stock after palti operations: ${validation.message}`);
                    return res.status(400).json({
                        success: false,
                        error: 'INSUFFICIENT_STOCK',
                        message: validation.message,
                        details: {
                            location: locationCode,
                            productType,
                            variety,
                            date,
                            openingStock: validation.openingStock,
                            paltiDeductions: validation.paltiDeductions,
                            remainingStock: validation.remainingStock,
                            requestedBags: validation.requestedBags,
                            shortfall: validation.shortfall,
                            groupKey: validation.groupKey,
                            explanation: 'Opening stock is calculated from operations before the sale date. Palti operations on the same date reduce available stock.'
                        },
                        suggestions: [
                            'Check if palti operations on this date consumed the stock',
                            'Verify the sale date is correct',
                            'Confirm the variety name matches exactly (including Steam/Raw processing type)',
                            'Verify the packaging type and bag size are correct'
                        ]
                    });
                } else {
                    console.log('✅ Date-aware sale stock validation passed');
                }

            } catch (stockError) {
                console.error('❌ Date-aware sale stock validation error:', stockError);
                return res.status(500).json({
                    success: false,
                    error: 'Stock validation failed',
                    details: {
                        message: stockError.message,
                        stack: stockError.stack
                    }
                });
            }
        }

        // Handle different data formats from frontend
        let finalBags = bags || sourceBags;
        let finalPackagingKg = packagingKg || bagSizeKg;
        let finalPackagingBrand = packagingBrand;
        let finalSourcePackagingBrand = sourcePackagingBrand;
        let finalTargetPackagingBrand = targetPackagingBrand;
        let finalQuantityQuintals = quantityQuintals; // Declare this variable early

        console.log('🔍 DEBUG - Initial values:', {
            bags, sourceBags, finalBags,
            packagingKg, bagSizeKg, finalPackagingKg,
            movementType, sourcePackagingId, targetPackagingId
        });

        // For palti operations, use frontend values if provided, or calculate if not
        if (movementType === 'palti' && sourceBags) {
            console.log('🔍 DEBUG - Processing palti operation:', { bags, sourceBags, quantityQuintals });

            // For palti, get packaging info for brand names and calculations
            if (sourcePackagingId && targetPackagingId) {
                try {
                    const [sourcePackagingResult, targetPackagingResult] = await Promise.all([
                        sequelize.query(`SELECT "brandName", "allottedKg" FROM packagings WHERE id = :sourcePackagingId`, {
                            replacements: { sourcePackagingId },
                            type: sequelize.QueryTypes.SELECT
                        }),
                        sequelize.query(`SELECT "brandName", "allottedKg" FROM packagings WHERE id = :targetPackagingId`, {
                            replacements: { targetPackagingId },
                            type: sequelize.QueryTypes.SELECT
                        })
                    ]);

                    if (sourcePackagingResult.length > 0 && targetPackagingResult.length > 0) {
                        const sourceKg = parseFloat(sourcePackagingResult[0].allottedKg);
                        const targetKg = parseFloat(targetPackagingResult[0].allottedKg);

                        // Use frontend-provided values if available, otherwise calculate
                        if (bags && parseInt(bags) > 0) {
                            finalBags = parseInt(bags);
                        } else {
                            const totalKg = parseInt(sourceBags) * sourceKg;
                            finalBags = Math.floor(totalKg / targetKg);
                        }

                        if (quantityQuintals && parseFloat(quantityQuintals) > 0) {
                            finalQuantityQuintals = parseFloat(quantityQuintals);
                        } else {
                            const totalKg = parseInt(sourceBags) * sourceKg;
                            finalQuantityQuintals = totalKg / 100;
                        }

                        finalPackagingKg = targetKg; // Use target packaging kg

                        finalSourcePackagingBrand = sourcePackagingResult[0].brandName;
                        finalTargetPackagingBrand = targetPackagingResult[0].brandName;
                        sourcePackagingKg = sourceKg;
                        targetPackagingKg = targetKg;

                        console.log('📊 Palti conversion processed:', {
                            sourceBags: parseInt(sourceBags),
                            sourceKg,
                            targetBags: finalBags,
                            targetKg,
                            finalQuantityQuintals
                        });
                    } else {
                        console.log('❌ Could not find packaging records');
                    }
                } catch (error) {
                    console.warn('Could not resolve palti packaging conversion:', error.message);
                }
            } else {
                console.log('❌ Missing sourcePackagingId or targetPackagingId');
            }
        }

        // Resolve packaging IDs to brand names if needed
        if (packagingId && !packagingBrand) {
            // Query packaging table to get brand name
            try {
                const packagingResult = await sequelize.query(`
                    SELECT "brandName", "allottedKg" FROM packagings WHERE id = :packagingId
                `, {
                    replacements: { packagingId },
                    type: sequelize.QueryTypes.SELECT
                });

                if (packagingResult.length > 0) {
                    finalPackagingBrand = packagingResult[0].brandName;
                    if (!finalPackagingKg) {
                        finalPackagingKg = packagingResult[0].allottedKg;
                    }
                }
            } catch (error) {
                console.warn('Could not resolve packaging ID:', packagingId);
            }
        }

        // Resolve source packaging ID for palti operations
        if (sourcePackagingId && !sourcePackagingBrand) {
            try {
                const sourcePackagingResult = await sequelize.query(`
                    SELECT "brandName", "allottedKg" FROM packagings WHERE id = :sourcePackagingId
                `, {
                    replacements: { sourcePackagingId },
                    type: sequelize.QueryTypes.SELECT
                });

                if (sourcePackagingResult.length > 0) {
                    finalSourcePackagingBrand = sourcePackagingResult[0].brandName;
                    sourcePackagingKg = sourcePackagingResult[0].allottedKg;
                }
            } catch (error) {
                console.warn('Could not resolve source packaging ID:', sourcePackagingId);
            }
        }

        // Resolve target packaging ID for palti operations
        if (targetPackagingId && !targetPackagingBrand) {
            try {
                const targetPackagingResult = await sequelize.query(`
                    SELECT "brandName", "allottedKg" FROM packagings WHERE id = :targetPackagingId
                `, {
                    replacements: { targetPackagingId },
                    type: sequelize.QueryTypes.SELECT
                });

                if (targetPackagingResult.length > 0) {
                    finalTargetPackagingBrand = targetPackagingResult[0].brandName;
                    targetPackagingKg = targetPackagingResult[0].allottedKg;
                }
            } catch (error) {
                console.warn('Could not resolve target packaging ID:', targetPackagingId);
            }
        }

        // Calculate quantity quintals if not provided
        if (!finalQuantityQuintals && finalBags && finalPackagingKg) {
            finalQuantityQuintals = (parseInt(finalBags) * parseFloat(finalPackagingKg)) / 100;
        }

        // Final validation
        if (!finalBags || !finalQuantityQuintals) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: bags and quantityQuintals (or sufficient data to calculate them)'
            });
        }

        console.log('📊 Processed data for insertion:', {
            date,
            movementType,
            productType,
            variety: variety || 'Sum25 RNR Raw',
            bags: finalBags,
            quantityQuintals: finalQuantityQuintals,
            packagingBrand: finalPackagingBrand || 'White Packet',
            packagingKg: finalPackagingKg || 26,
            locationCode,
            fromLocation,
            toLocation,
            billNumber,
            lorryNumber,
            sourcePackagingBrand: finalSourcePackagingBrand,
            sourcePackagingKg,
            targetPackagingBrand: finalTargetPackagingBrand,
            targetPackagingKg
        });

        // FIXED: Auto-approve if created by admin or manager
        const isAdminOrManager = req.user.role === 'admin' || req.user.role === 'manager';
        const status = isAdminOrManager ? 'approved' : 'pending';
        console.log(`📊 Setting status to '${status}' for user role: ${req.user.role}`);

        // Insert new movement
        const result = await sequelize.query(`
            INSERT INTO rice_stock_movements (
                date,
                movement_type,
                product_type,
                variety,
                bags,
                source_bags,
                bag_size_kg,
                quantity_quintals,
                packaging_id,
                location_code,
                from_location,
                to_location,
                bill_number,
                lorry_number,
                source_packaging_id,
                target_packaging_id,
                conversion_shortage_kg,
                conversion_shortage_bags,
                status,
                created_by,
                created_at,
                updated_at
            ) VALUES (
                :date,
                :movementType,
                :productType,
                :variety,
                :bags,
                :sourceBagsValue,
                :bagSizeKg,
                :quantityQuintals,
                :packagingId,
                :locationCode,
                :fromLocation,
                :toLocation,
                :billNumber,
                :lorryNumber,
                :sourcePackagingId,
                :targetPackagingId,
                :conversionShortageKg,
                :conversionShortageBags,
                :status,
                :createdBy,
                NOW(),
                NOW()
            ) RETURNING id
        `, {
            replacements: {
                date,
                movementType,
                productType,
                variety: finalVariety, // ✅ Use normalized variety
                bags: parseInt(finalBags),
                bagSizeKg: finalPackagingKg ? parseFloat(finalPackagingKg) : 26,
                quantityQuintals: parseFloat(finalQuantityQuintals),
                packagingId: movementType === 'palti'
                    ? null  // ✅ Set to NULL for palti - rely on source_packaging_id + target_packaging_id
                    : ((packagingId || targetPackagingId) ? parseInt(packagingId || targetPackagingId) : null),
                // Store source_bags for Palti operations (original bags before conversion)
                sourceBagsValue: movementType === 'palti' && sourceBags ? parseInt(sourceBags) : null,
                locationCode,
                fromLocation: fromLocation || null,
                toLocation: toLocation || null,
                billNumber: billNumber || null,
                lorryNumber: lorryNumber || null,
                sourcePackagingId: sourcePackagingId ? parseInt(sourcePackagingId) : null,
                targetPackagingId: targetPackagingId ? parseInt(targetPackagingId) : null,
                conversionShortageKg: movementType === 'palti' ? (
                    requestedShortageKg !== undefined && requestedShortageKg !== null ? parseFloat(requestedShortageKg) :
                        (sourcePackagingKg && targetPackagingKg ?
                            (parseInt(sourceBags || finalBags) * parseFloat(sourcePackagingKg)) - (parseInt(finalBags) * parseFloat(targetPackagingKg)) : null)
                ) : null,
                conversionShortageBags: movementType === 'palti' ? (
                    requestedShortageBags !== undefined && requestedShortageBags !== null ? parseFloat(requestedShortageBags) :
                        (sourcePackagingKg && targetPackagingKg ?
                            ((parseInt(sourceBags || finalBags) * parseFloat(sourcePackagingKg)) - (parseInt(finalBags) * parseFloat(targetPackagingKg))) / parseFloat(targetPackagingKg) : null)
                ) : null,
                createdBy: req.user.userId,
                status
            },
            type: sequelize.QueryTypes.INSERT
        });

        // Handle different database return formats
        let newId;
        if (result && result[0]) {
            if (Array.isArray(result[0]) && result[0].length > 0) {
                newId = result[0][0].id || result[0][0];
            } else if (result[0].id) {
                newId = result[0].id;
            } else {
                newId = result[0];
            }
        }

        console.log('✅ Rice stock movement created successfully:', { newId, result });

        res.status(201).json({
            success: true,
            data: {
                id: newId,
                message: 'Rice stock movement created successfully'
            }
        });
    } catch (error) {
        console.error('❌ Error creating rice stock movement:', error);

        // Handle specific constraint violations
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                error: 'Validation error: ' + error.errors.map(e => e.message).join(', ')
            });
        }

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                success: false,
                error: 'Duplicate entry: ' + error.errors.map(e => e.message).join(', ')
            });
        }

        // Handle database connection errors
        if (error.name === 'SequelizeConnectionError') {
            return res.status(500).json({
                success: false,
                error: 'Database connection error. Please try again.'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to create rice stock movement: ' + error.message
        });
    }
});

// Update rice stock movement
router.put('/movements/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        console.log('📝 UPDATE rice stock movement request:', { id, body: req.body });

        const {
            date,
            movementType,
            productType,
            variety,
            bags,
            sourceBags,
            quantityQuintals,
            packagingId,
            packagingBrand,
            packagingKg,
            bagSizeKg,
            locationCode,
            fromLocation,
            toLocation,
            billNumber,
            lorryNumber,
            sourcePackagingId,
            targetPackagingId,
            shortageKg,
            shortageBags,
            status
        } = req.body;

        // Check if movement exists and get its current data
        const existing = await sequelize.query(`
            SELECT id, status, movement_type, product_type, location_code, bags, 
                   packaging_id, source_packaging_id, target_packaging_id, variety,
                   from_location, to_location, date
            FROM rice_stock_movements WHERE id = :id
        `, {
            replacements: { id },
            type: sequelize.QueryTypes.SELECT
        });

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Rice stock movement not found'
            });
        }

        const currentMovement = existing[0];
        const currentStatus = currentMovement.status;
        const finalMovementType = movementType || currentMovement.movement_type;
        const finalProductType = productType || currentMovement.product_type;
        const finalLocationCode = locationCode || currentMovement.location_code;
        const finalBags = bags || currentMovement.bags;
        const finalVariety = variety || currentMovement.variety;
        const finalPackagingId = packagingId || currentMovement.packaging_id;
        const finalSourcePackagingId = sourcePackagingId || currentMovement.source_packaging_id;
        const finalTargetPackagingId = targetPackagingId || currentMovement.target_packaging_id;

        // Status check - Admins can bypass the 'approved' block
        if (currentStatus === 'approved' && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Approved rice stock movements cannot be updated by non-admin users'
            });
        }

        // =====================================================
        // VALIDATION SECTION - Same rules as POST endpoint
        // =====================================================

        // Basic required fields validation
        if (!finalProductType) {
            return res.status(400).json({
                success: false,
                error: 'Product type is required'
            });
        }

        if (!finalLocationCode) {
            return res.status(400).json({
                success: false,
                error: 'Location code is required'
            });
        }

        if (!finalBags || finalBags <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Bags must be greater than 0'
            });
        }

        // Movement type specific validation
        const validMovementTypes = ['purchase', 'sale', 'palti'];
        if (!validMovementTypes.includes(finalMovementType)) {
            return res.status(400).json({
                success: false,
                error: `Invalid movement type. Must be one of: ${validMovementTypes.join(', ')}`
            });
        }

        // =====================================================
        // SALE VALIDATION
        // =====================================================
        if (finalMovementType === 'sale') {
            // Packaging is required for sale
            if (!finalPackagingId && !packagingBrand) {
                return res.status(400).json({
                    success: false,
                    error: 'Packaging selection is required for sale operations',
                    details: 'Please select a packaging before updating a sale'
                });
            }

            // Stock availability check for sale (skip if only status change)
            if (bags || productType || locationCode || variety || packagingId) {
                try {
                    console.log('🔍 Validating sale stock availability during edit...');

                    // Resolve packaging ID if only brand name provided
                    let salePackagingId = finalPackagingId;
                    if (!salePackagingId && packagingBrand) {
                        const [pkgResult] = await sequelize.query(`
                            SELECT id FROM packagings WHERE "brandName" = :brandName LIMIT 1
                        `, { replacements: { brandName: packagingBrand }, type: sequelize.QueryTypes.SELECT });
                        if (pkgResult) salePackagingId = pkgResult.id;
                    }

                    const LocationBifurcationService = require('../services/LocationBifurcationService');
                    const validation = await LocationBifurcationService.validateSaleAfterPalti({
                        locationCode: finalLocationCode,
                        variety: finalVariety,
                        productType: finalProductType,
                        packagingId: salePackagingId ? Number.parseInt(salePackagingId) : null,
                        packagingBrand: packagingBrand || null,
                        bagSizeKg: bagSizeKg ? Number.parseFloat(bagSizeKg) : null,
                        requestedBags: Number.parseInt(finalBags),
                        saleDate: date || currentMovement.date,
                        excludeMovementId: parseInt(id), // Exclude current movement from calculation
                        debugMode: true
                    });

                    if (!validation.isValid) {
                        console.log(`❌ Insufficient stock for sale edit: ${validation.message}`);
                        return res.status(400).json({
                            success: false,
                            error: 'INSUFFICIENT_STOCK',
                            message: validation.message,
                            details: {
                                location: finalLocationCode,
                                productType: finalProductType,
                                variety: finalVariety,
                                openingStock: validation.openingStock,
                                remainingStock: validation.remainingStock,
                                requestedBags: validation.requestedBags,
                                shortfall: validation.shortfall
                            }
                        });
                    }
                    console.log('✅ Sale stock validation passed during edit');
                } catch (stockError) {
                    console.error('⚠️ Sale stock validation error during edit:', stockError.message);
                    // Log but don't block - allow edit to proceed
                }
            }
        }

        // =====================================================
        // PALTI VALIDATION
        // =====================================================
        if (finalMovementType === 'palti') {
            // Source and target packaging are required for palti
            if (!finalSourcePackagingId) {
                return res.status(400).json({
                    success: false,
                    error: 'Source packaging is required for palti operations',
                    details: 'Please select the source packaging (FROM) before updating a palti'
                });
            }

            if (!finalTargetPackagingId) {
                return res.status(400).json({
                    success: false,
                    error: 'Target packaging is required for palti operations',
                    details: 'Please select the target packaging (TO) before updating a palti'
                });
            }

            // From and To locations are required for palti
            const finalFromLocation = fromLocation || currentMovement.from_location;
            const finalToLocation = toLocation || currentMovement.to_location;

            if (!finalFromLocation) {
                return res.status(400).json({
                    success: false,
                    error: 'From location is required for palti operations'
                });
            }

            if (!finalToLocation) {
                return res.status(400).json({
                    success: false,
                    error: 'To location is required for palti operations'
                });
            }

            // Type conversion validation - can only convert within same category
            if (productType && productType !== currentMovement.product_type) {
                try {
                    const { canConvertTypes, getProductTypeCategory } = require('../utils/productTypeCategories');
                    const sourceType = currentMovement.product_type;
                    const targetType = productType;

                    if (!canConvertTypes(sourceType, targetType)) {
                        const sourceCategory = getProductTypeCategory(sourceType);
                        const targetCategory = getProductTypeCategory(targetType);

                        return res.status(400).json({
                            success: false,
                            error: 'Invalid type conversion',
                            details: {
                                sourceType,
                                sourceCategory,
                                targetType,
                                targetCategory,
                                message: `Cannot convert ${sourceCategory} (${sourceType}) to ${targetCategory} (${targetType}). Only same-category conversions allowed.`,
                                allowedConversions: {
                                    'RICE → RICE': 'Rice, Rejection Rice, Unpolished, etc.',
                                    'BROKEN → BROKEN': 'Sizer Broken, Rejection Broken, Zero Broken, etc.',
                                    'BRAN → BRAN': 'Bran, Farm Bran',
                                    'OTHER → OTHER': 'Faram, Farm'
                                }
                            }
                        });
                    }
                    console.log(`✅ Type conversion validation passed: ${sourceType} → ${targetType}`);
                } catch (typeError) {
                    console.warn('⚠️ Type conversion check failed:', typeError.message);
                }
            }

            // Stock availability check for palti (only if changing key fields)
            if (bags || productType || locationCode || sourcePackagingId) {
                try {
                    console.log('🔍 Validating palti stock availability during edit...');

                    // Get source packaging details
                    const [sourcePackagingInfo] = await sequelize.query(
                        `SELECT "brandName", "allottedKg" FROM packagings WHERE id = :sourcePackagingId`,
                        { replacements: { sourcePackagingId: parseInt(finalSourcePackagingId) }, type: sequelize.QueryTypes.SELECT }
                    );

                    if (!sourcePackagingInfo) {
                        return res.status(400).json({
                            success: false,
                            error: 'Source packaging not found'
                        });
                    }

                    const sourcePackagingKgValue = parseFloat(sourcePackagingInfo.allottedKg || 26);
                    const editSourceBags = sourceBags || finalBags;
                    const reqQtls = (parseInt(editSourceBags) * sourcePackagingKgValue) / 100;

                    // Check available stock (excluding current movement)
                    const stockCheckResult = await sequelize.query(`
                        SELECT COALESCE(SUM(CASE 
                            WHEN movement_type IN ('production', 'purchase') AND packaging_id = :sourcePackagingId THEN quantity_quintals
                            WHEN movement_type = 'sale' AND packaging_id = :sourcePackagingId THEN -quantity_quintals
                            WHEN movement_type = 'palti' AND source_packaging_id = :sourcePackagingId THEN -quantity_quintals
                            WHEN movement_type = 'palti' AND target_packaging_id = :sourcePackagingId THEN quantity_quintals
                            ELSE 0
                        END), 0) as available_qtls
                        FROM rice_stock_movements 
                        WHERE status = 'approved' 
                          AND location_code = :locationCode
                          AND product_type = :productType
                          AND id != :excludeId
                    `, {
                        replacements: {
                            sourcePackagingId: parseInt(finalSourcePackagingId),
                            locationCode: finalLocationCode,
                            productType: finalProductType,
                            excludeId: parseInt(id)
                        },
                        type: sequelize.QueryTypes.SELECT
                    });

                    const availableQtls = parseFloat(stockCheckResult[0]?.available_qtls || 0);

                    console.log('📊 Palti edit stock validation:', {
                        availableQtls,
                        requestedQtls: reqQtls,
                        isValid: availableQtls >= reqQtls
                    });

                    if (availableQtls < reqQtls) {
                        return res.status(400).json({
                            success: false,
                            error: `Insufficient ${finalProductType} stock at ${finalLocationCode}`,
                            details: {
                                productType: finalProductType,
                                location: finalLocationCode,
                                availableQtls: parseFloat(availableQtls.toFixed(2)),
                                requestedQtls: parseFloat(reqQtls.toFixed(2)),
                                shortfall: parseFloat((reqQtls - availableQtls).toFixed(2))
                            }
                        });
                    }
                    console.log('✅ Palti stock validation passed during edit');
                } catch (stockError) {
                    console.error('⚠️ Palti stock validation error during edit:', stockError.message);
                    // Log but continue - don't block the edit
                }
            }
        }

        // =====================================================
        // RESOLVE PACKAGING ID FROM BRAND NAME
        // =====================================================
        let resolvedPackagingId = packagingId || null;
        let resolvedPackagingKg = bagSizeKg || packagingKg || null;

        if (packagingBrand && !packagingId) {
            try {
                const packagingResult = await sequelize.query(`
                    SELECT id, "allottedKg" FROM packagings WHERE "brandName" = :brandName LIMIT 1
                `, {
                    replacements: { brandName: packagingBrand },
                    type: sequelize.QueryTypes.SELECT
                });
                if (packagingResult.length > 0) {
                    resolvedPackagingId = packagingResult[0].id;
                    if (!resolvedPackagingKg) {
                        resolvedPackagingKg = packagingResult[0].allottedKg;
                    }
                }
            } catch (error) {
                console.warn('Could not resolve packaging brand:', packagingBrand, error.message);
            }
        }

        // =====================================================
        // UPDATE MOVEMENT
        // =====================================================
        await sequelize.query(`
            UPDATE rice_stock_movements SET
                date = COALESCE(:date, date),
                movement_type = COALESCE(:movementType, movement_type),
                product_type = COALESCE(:productType, product_type),
                variety = COALESCE(:variety, variety),
                bags = COALESCE(:bags, bags),
                source_bags = COALESCE(:sourceBags, source_bags),
                bag_size_kg = COALESCE(:bagSizeKg, bag_size_kg),
                quantity_quintals = COALESCE(:quantityQuintals, quantity_quintals),
                packaging_id = COALESCE(:packagingId, packaging_id),
                location_code = COALESCE(:locationCode, location_code),
                from_location = COALESCE(:fromLocation, from_location),
                to_location = COALESCE(:toLocation, to_location),
                bill_number = COALESCE(:billNumber, bill_number),
                lorry_number = COALESCE(:lorryNumber, lorry_number),
                source_packaging_id = COALESCE(:sourcePackagingId, source_packaging_id),
                target_packaging_id = COALESCE(:targetPackagingId, target_packaging_id),
                conversion_shortage_kg = COALESCE(:shortageKg, conversion_shortage_kg),
                conversion_shortage_bags = COALESCE(:shortageBags, conversion_shortage_bags),
                status = COALESCE(:status, status),
                updated_at = NOW()
            WHERE id = :id
        `, {
            replacements: {
                id,
                date: date || null,
                movementType: movementType || null,
                productType: productType || null,
                variety: variety || null,
                bags: bags ? parseInt(bags) : null,
                sourceBags: sourceBags ? parseInt(sourceBags) : null,
                bagSizeKg: resolvedPackagingKg ? parseFloat(resolvedPackagingKg) : null,
                quantityQuintals: quantityQuintals ? parseFloat(quantityQuintals) : null,
                packagingId: resolvedPackagingId ? parseInt(resolvedPackagingId) : null,
                locationCode: locationCode || null,
                fromLocation: fromLocation || null,
                toLocation: toLocation || null,
                billNumber: billNumber || null,
                lorryNumber: lorryNumber || null,
                sourcePackagingId: sourcePackagingId ? parseInt(sourcePackagingId) : null,
                targetPackagingId: targetPackagingId ? parseInt(targetPackagingId) : null,
                shortageKg: shortageKg !== undefined && shortageKg !== null ? parseFloat(shortageKg) : null,
                shortageBags: shortageBags !== undefined && shortageBags !== null ? parseFloat(shortageBags) : null,
                status: status || null
            },
            type: sequelize.QueryTypes.UPDATE
        });

        console.log('✅ Rice stock movement updated successfully:', { id });

        // CRITICAL: Clear all rice stock related caches to ensure fresh data
        try {
            await cacheService.delPattern('rice*');
            await cacheService.delPattern('production*');
            await cacheService.delPattern('byProduct*');
            await cacheService.delPattern('outturn*');
            console.log('✅ All related caches cleared after rice stock movement update');
        } catch (cacheError) {
            console.warn('⚠️ Failed to clear cache:', cacheError.message);
        }

        res.json({
            success: true,
            data: {
                message: 'Rice stock movement updated successfully'
            }
        });
    } catch (error) {
        console.error('❌ Error updating rice stock movement:', error);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            sql: error.sql || 'N/A'
        });
        res.status(500).json({
            success: false,
            error: 'Failed to update rice stock movement: ' + error.message
        });
    }
});

// Delete rice stock movement
router.delete('/movements/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if movement exists
        const existing = await sequelize.query(`
            SELECT id FROM rice_stock_movements WHERE id = :id
        `, {
            replacements: { id },
            type: sequelize.QueryTypes.SELECT
        });

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Rice stock movement not found'
            });
        }

        // Delete movement
        await sequelize.query(`
            DELETE FROM rice_stock_movements WHERE id = :id
        `, {
            replacements: { id },
            type: sequelize.QueryTypes.DELETE
        });

        res.json({
            success: true,
            data: {
                message: 'Rice stock movement deleted successfully'
            }
        });
    } catch (error) {
        console.error('Error deleting rice stock movement:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete rice stock movement'
        });
    }
});

// Batch operations for efficiency
router.post('/movements/batch', auth, async (req, res) => {
    try {
        const { movements } = req.body;

        if (!Array.isArray(movements) || movements.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid movements array'
            });
        }

        const results = [];

        // Process each movement in a transaction
        await sequelize.transaction(async (transaction) => {
            for (const movement of movements) {
                const {
                    date,
                    movementType,
                    productType,
                    variety,
                    bags,
                    quantityQuintals,
                    packagingBrand,
                    packagingKg,
                    locationCode,
                    fromLocation,
                    toLocation,
                    billNumber,
                    lorryNumber,
                    sourcePackagingBrand,
                    sourcePackagingKg,
                    targetPackagingBrand,
                    targetPackagingKg
                } = movement;

                const result = await sequelize.query(`
                    INSERT INTO rice_stock_movements (
                        date,
                        movement_type,
                        product_type,
                        variety,
                        bags,
                        quantity_quintals,
                        packaging_brand,
                        packaging_kg,
                        location_code,
                        from_location,
                        to_location,
                        bill_number,
                        lorry_number,
                        source_packaging_brand,
                        source_packaging_kg,
                        target_packaging_brand,
                        target_packaging_kg,
                        status,
                        created_at,
                        updated_at
                    ) VALUES (
                        :date,
                        :movementType,
                        :productType,
                        :variety,
                        :bags,
                        :quantityQuintals,
                        :packagingBrand,
                        :packagingKg,
                        :locationCode,
                        :fromLocation,
                        :toLocation,
                        :billNumber,
                        :lorryNumber,
                        :sourcePackagingBrand,
                        :sourcePackagingKg,
                        :targetPackagingBrand,
                        :targetPackagingKg,
                        'pending',
                        NOW(),
                        NOW()
                    ) RETURNING id
                `, {
                    replacements: {
                        date,
                        movementType,
                        productType,
                        variety: variety || 'Sum25 RNR Raw',
                        bags: parseInt(bags),
                        quantityQuintals: parseFloat(quantityQuintals),
                        packagingBrand: packagingBrand || 'White Packet',
                        packagingKg: packagingKg ? parseFloat(packagingKg) : 26,
                        locationCode,
                        fromLocation,
                        toLocation,
                        billNumber,
                        lorryNumber,
                        sourcePackagingBrand,
                        sourcePackagingKg: sourcePackagingKg ? parseFloat(sourcePackagingKg) : null,
                        targetPackagingBrand,
                        targetPackagingKg: targetPackagingKg ? parseFloat(targetPackagingKg) : null
                    },
                    type: sequelize.QueryTypes.INSERT,
                    transaction
                });

                results.push({ id: result[0][0].id });
            }
        });

        res.status(201).json({
            success: true,
            data: {
                created: results.length,
                movements: results
            }
        });
    } catch (error) {
        console.error('Error creating batch rice stock movements:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create batch rice stock movements'
        });
    }
});

// Get pending rice stock movements for approval
router.get('/movements/pending', auth, async (req, res) => {
    try {
        console.log('🔍 Fetching pending rice stock movements...');

        const result = await sequelize.query(`
            SELECT 
                rsm.id,
                rsm.date,
                rsm.movement_type,
                rsm.product_type,
                rsm.variety,
                rsm.bags,
                rsm.bag_size_kg,
                rsm.quantity_quintals,
                rsm.location_code,
                rsm.from_location,
                rsm.to_location,
                rsm.bill_number,
                rsm.lorry_number,
                rsm.party_name,
                rsm.rate_per_bag,
                rsm.total_amount,
                rsm.status,
                rsm.created_at,
                p1."brandName" as packaging_brand,
                p1."allottedKg" as packaging_kg,
                u.username as created_by_username
            FROM rice_stock_movements rsm
            LEFT JOIN packagings p1 ON rsm.packaging_id = p1.id
            LEFT JOIN users u ON rsm.created_by = u.id
            WHERE rsm.status = 'pending'
            ORDER BY rsm.created_at DESC
            LIMIT 200
        `, {
            type: sequelize.QueryTypes.SELECT
        });

        console.log(`✅ Found ${result.length} pending movements`);

        res.json({
            success: true,
            data: {
                movements: result
            }
        });
    } catch (error) {
        console.error('Error fetching pending movements:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch pending movements'
        });
    }
});

// Update rice stock movement status (approve/reject)
router.patch('/movements/:id/status', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason } = req.body;
        const userId = req.user.userId;

        console.log(`🔄 Updating movement ${id} status to ${status} by user ${userId}`);

        // Validate status
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status. Must be "approved" or "rejected"'
            });
        }

        // Check if movement exists
        const [movement] = await sequelize.query(`
            SELECT id, status, created_by 
            FROM rice_stock_movements 
            WHERE id = :id
        `, {
            replacements: { id },
            type: sequelize.QueryTypes.SELECT
        });

        if (!movement) {
            return res.status(404).json({
                success: false,
                error: 'Movement not found'
            });
        }

        // Check if already processed
        if (movement.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: `Movement is already ${movement.status}`
            });
        }

        // Update the movement status
        const updateFields = {
            status,
            approved_by: userId,
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Add rejection reason if provided
        if (status === 'rejected' && rejectionReason) {
            updateFields.rejection_reason = rejectionReason;
        }

        const setClause = Object.keys(updateFields)
            .map(key => `${key} = :${key}`)
            .join(', ');

        await sequelize.query(`
            UPDATE rice_stock_movements 
            SET ${setClause}
            WHERE id = :id
        `, {
            replacements: { ...updateFields, id }
        });

        console.log(`✅ Movement ${id} ${status} successfully`);

        res.json({
            success: true,
            message: `Movement ${status} successfully`,
            data: {
                id: parseInt(id),
                status,
                approvedBy: userId,
                approvedAt: updateFields.approved_at
            }
        });

    } catch (error) {
        console.error('Error updating movement status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update movement status'
        });
    }
});

// Bulk approve rice stock movements
router.post('/movements/bulk-approve', auth, async (req, res) => {
    const startTime = Date.now();

    try {
        const { ids } = req.body;
        const userId = req.user.userId;
        const userRole = req.user.role;

        // Validate input
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'ids array is required and must not be empty'
            });
        }

        // Only admin can bulk approve
        if (userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Only admin can bulk approve rice stock movements'
            });
        }

        console.log(`🔄 Bulk approving ${ids.length} rice stock movements by admin ${userId}`);

        const results = {
            approved: [],
            failed: []
        };

        // Process in a transaction for data integrity
        await sequelize.transaction(async (transaction) => {
            for (const id of ids) {
                try {
                    // Check if movement exists and is pending
                    const [movement] = await sequelize.query(`
                        SELECT id, status FROM rice_stock_movements WHERE id = :id
                    `, {
                        replacements: { id },
                        type: sequelize.QueryTypes.SELECT,
                        transaction
                    });

                    if (!movement) {
                        results.failed.push({ id, reason: 'Movement not found' });
                        continue;
                    }

                    if (movement.status !== 'pending') {
                        results.failed.push({ id, reason: `Already ${movement.status}` });
                        continue;
                    }

                    // Approve the movement
                    await sequelize.query(`
                        UPDATE rice_stock_movements 
                        SET status = 'approved',
                            approved_by = :userId,
                            approved_at = NOW(),
                            updated_at = NOW()
                        WHERE id = :id
                    `, {
                        replacements: { id, userId },
                        transaction
                    });

                    results.approved.push(id);
                } catch (error) {
                    console.error(`Error approving movement ${id}:`, error);
                    results.failed.push({ id, reason: error.message });
                }
            }
        });

        // Clear rice-related caches after bulk operation
        try {
            await cacheService.delPattern('rice*');
            await cacheService.delPattern('production*');
            console.log('✅ Caches cleared after bulk approval');
        } catch (cacheError) {
            console.warn('⚠️ Failed to clear cache:', cacheError.message);
        }

        const responseTime = Date.now() - startTime;

        console.log(`✅ Bulk approval completed: ${results.approved.length} approved, ${results.failed.length} failed`);

        res.json({
            success: true,
            message: `Bulk approval completed: ${results.approved.length} approved, ${results.failed.length} failed`,
            data: results,
            performance: {
                responseTime: `${responseTime}ms`,
                recordsProcessed: ids.length
            }
        });

    } catch (error) {
        console.error('❌ Bulk approve rice movements error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to bulk approve rice stock movements',
            details: error.message
        });
    }
});

// Bulk reject rice stock movements
router.post('/movements/bulk-reject', auth, async (req, res) => {
    const startTime = Date.now();

    try {
        const { ids, rejectionReason } = req.body;
        const userId = req.user.userId;
        const userRole = req.user.role;

        // Validate input
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'ids array is required and must not be empty'
            });
        }

        // Only admin can bulk reject
        if (userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Only admin can bulk reject rice stock movements'
            });
        }

        console.log(`🔄 Bulk rejecting ${ids.length} rice stock movements by admin ${userId}`);

        const results = {
            rejected: [],
            failed: []
        };

        // Process in a transaction
        await sequelize.transaction(async (transaction) => {
            for (const id of ids) {
                try {
                    // Check if movement exists and is pending
                    const [movement] = await sequelize.query(`
                        SELECT id, status FROM rice_stock_movements WHERE id = :id
                    `, {
                        replacements: { id },
                        type: sequelize.QueryTypes.SELECT,
                        transaction
                    });

                    if (!movement) {
                        results.failed.push({ id, reason: 'Movement not found' });
                        continue;
                    }

                    if (movement.status !== 'pending') {
                        results.failed.push({ id, reason: `Already ${movement.status}` });
                        continue;
                    }

                    // Reject the movement
                    await sequelize.query(`
                        UPDATE rice_stock_movements 
                        SET status = 'rejected',
                            approved_by = :userId,
                            approved_at = NOW(),
                            rejection_reason = :rejectionReason,
                            updated_at = NOW()
                        WHERE id = :id
                    `, {
                        replacements: { id, userId, rejectionReason: rejectionReason || null },
                        transaction
                    });

                    results.rejected.push(id);
                } catch (error) {
                    console.error(`Error rejecting movement ${id}:`, error);
                    results.failed.push({ id, reason: error.message });
                }
            }
        });

        // Clear rice-related caches
        try {
            await cacheService.delPattern('rice*');
            await cacheService.delPattern('production*');
            console.log('✅ Caches cleared after bulk rejection');
        } catch (cacheError) {
            console.warn('⚠️ Failed to clear cache:', cacheError.message);
        }

        const responseTime = Date.now() - startTime;

        console.log(`✅ Bulk rejection completed: ${results.rejected.length} rejected, ${results.failed.length} failed`);

        res.json({
            success: true,
            message: `Bulk rejection completed: ${results.rejected.length} rejected, ${results.failed.length} failed`,
            data: results,
            performance: {
                responseTime: `${responseTime}ms`,
                recordsProcessed: ids.length
            }
        });

    } catch (error) {
        console.error('❌ Bulk reject rice movements error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to bulk reject rice stock movements',
            details: error.message
        });
    }
});

// Get variety bifurcation - NEW ENDPOINT for perfect variety-wise stock splitting
router.get('/variety-bifurcation', auth, async (req, res) => {
    const startTime = Date.now();
    try {
        const {
            variety,
            outturnId,
            productType = 'Rice',
            date = new Date().toISOString().split('T')[0],
            debug = false
        } = req.query;

        console.log('🎯 Getting variety bifurcation:', {
            variety,
            outturnId,
            productType,
            date,
            debug: debug === 'true'
        });

        // Validate required parameters
        if (!variety && !outturnId) {
            return res.status(400).json({
                error: 'Either variety or outturnId is required',
                code: 'MISSING_VARIETY_PARAMETER'
            });
        }

        // Import the calculation service
        const RiceStockCalculationService = require('../services/riceStockCalculationService');

        // Get complete variety bifurcation
        const bifurcationResult = await RiceStockCalculationService.getVarietyBifurcation({
            variety,
            outturnId: outturnId ? Number.parseInt(outturnId) : null,
            productType,
            date,
            debugMode: debug === 'true'
        });

        const responseTime = Date.now() - startTime;

        console.log(`✅ Variety bifurcation completed in ${responseTime}ms`);
        console.log(`📊 Found ${bifurcationResult.bifurcation.length} unique stock entries`);
        console.log(`🎯 Total stock: ${bifurcationResult.totals.totalBags} bags, ${bifurcationResult.totals.totalQtls.toFixed(2)} QTL`);

        res.json({
            success: true,
            data: bifurcationResult,
            performance: {
                responseTime: `${responseTime}ms`,
                cached: false
            }
        });

    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error('❌ Error getting variety bifurcation:', error);

        res.status(500).json({
            error: 'Failed to get variety bifurcation',
            details: error.message,
            code: 'BIFURCATION_ERROR',
            performance: {
                responseTime: `${responseTime}ms`,
                cached: false
            }
        });
    }
});

// ============================================
// LOCATION BIFURCATION ENDPOINTS
// ============================================

// Get location-specific stock breakdown for palti operations
router.get('/location-breakdown', auth, async (req, res) => {
    const startTime = Date.now();
    try {
        const {
            variety,
            outturnId,
            productType = 'Rice',
            packagingId,
            packagingBrand,
            bagSizeKg,
            date = new Date().toISOString().split('T')[0],
            debug = false
        } = req.query;

        console.log('🏢 Getting location stock breakdown:', {
            variety,
            outturnId,
            productType,
            packagingId,
            packagingBrand,
            bagSizeKg,
            date
        });

        // Validate required parameters
        if (!variety && !outturnId) {
            return res.status(400).json({
                success: false,
                error: 'Either variety or outturnId is required',
                code: 'MISSING_VARIETY_PARAMETER'
            });
        }

        // Get location breakdown
        const locationBreakdown = await LocationBifurcationService.getLocationStockBreakdown({
            variety,
            outturnId: outturnId ? parseInt(outturnId) : undefined,
            productType,
            packagingId: packagingId ? parseInt(packagingId) : undefined,
            packagingBrand,
            bagSizeKg: bagSizeKg ? parseFloat(bagSizeKg) : undefined,
            date,
            debugMode: debug === 'true'
        });

        const responseTime = Date.now() - startTime;

        res.json({
            success: true,
            data: locationBreakdown,
            performance: {
                responseTime: `${responseTime}ms`,
                cached: false
            }
        });

    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error('❌ Error getting location breakdown:', error);

        res.status(500).json({
            success: false,
            error: 'Failed to get location breakdown',
            details: error.message,
            code: 'LOCATION_BREAKDOWN_ERROR',
            performance: {
                responseTime: `${responseTime}ms`,
                cached: false
            }
        });
    }
});

// Validate palti operation against specific location stock
router.post('/validate-palti-location', auth, async (req, res) => {
    const startTime = Date.now();
    try {
        const {
            sourceLocation,
            variety,
            outturnId,
            productType = 'Rice',
            packagingId,
            packagingBrand,
            bagSizeKg,
            requestedBags,
            requestedQtls,
            date = new Date().toISOString().split('T')[0],
            debug = false
        } = req.body;

        console.log('🔍 Validating palti by location:', {
            sourceLocation,
            variety,
            outturnId,
            productType,
            requestedBags,
            requestedQtls
        });

        // Validate required parameters
        if (!sourceLocation) {
            return res.status(400).json({
                success: false,
                error: 'Source location is required',
                code: 'MISSING_SOURCE_LOCATION'
            });
        }

        if (!variety && !outturnId) {
            return res.status(400).json({
                success: false,
                error: 'Either variety or outturnId is required',
                code: 'MISSING_VARIETY_PARAMETER'
            });
        }

        if (!requestedBags && !requestedQtls) {
            return res.status(400).json({
                success: false,
                error: 'Either requestedBags or requestedQtls is required',
                code: 'MISSING_QUANTITY_PARAMETER'
            });
        }

        // Validate palti by location
        const validation = await LocationBifurcationService.validatePaltiByLocation({
            sourceLocation,
            variety,
            outturnId: outturnId ? parseInt(outturnId) : undefined,
            productType,
            packagingId: packagingId ? parseInt(packagingId) : undefined,
            packagingBrand,
            bagSizeKg: bagSizeKg ? parseFloat(bagSizeKg) : undefined,
            requestedBags: requestedBags ? parseInt(requestedBags) : undefined,
            requestedQtls: requestedQtls ? parseFloat(requestedQtls) : undefined,
            date,
            debugMode: debug === true
        });

        const responseTime = Date.now() - startTime;

        res.json({
            success: true,
            data: validation,
            performance: {
                responseTime: `${responseTime}ms`,
                cached: false
            }
        });

    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error('❌ Error validating palti by location:', error);

        res.status(500).json({
            success: false,
            error: 'Failed to validate palti by location',
            details: error.message,
            code: 'PALTI_VALIDATION_ERROR',
            performance: {
                responseTime: `${responseTime}ms`,
                cached: false
            }
        });
    }
});

// Get available locations for a specific variety (for location selection)
router.get('/available-locations', auth, async (req, res) => {
    const startTime = Date.now();
    try {
        const {
            variety,
            outturnId,
            productType = 'Rice',
            date = new Date().toISOString().split('T')[0]
        } = req.query;

        console.log('📍 Getting available locations for variety:', {
            variety,
            outturnId,
            productType,
            date
        });

        // Validate required parameters
        if (!variety && !outturnId) {
            return res.status(400).json({
                success: false,
                error: 'Either variety or outturnId is required',
                code: 'MISSING_VARIETY_PARAMETER'
            });
        }

        // Get available locations
        const availableLocations = await LocationBifurcationService.getAvailableLocationsForVariety({
            variety,
            outturnId: outturnId ? parseInt(outturnId) : undefined,
            productType,
            date
        });

        const responseTime = Date.now() - startTime;

        res.json({
            success: true,
            data: {
                variety: variety || 'Unknown',
                outturnId: outturnId ? parseInt(outturnId) : null,
                productType,
                date,
                locations: availableLocations,
                totalLocations: availableLocations.length
            },
            performance: {
                responseTime: `${responseTime}ms`,
                cached: false
            }
        });

    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error('❌ Error getting available locations:', error);

        res.status(500).json({
            success: false,
            error: 'Failed to get available locations',
            details: error.message,
            code: 'AVAILABLE_LOCATIONS_ERROR',
            performance: {
                responseTime: `${responseTime}ms`,
                cached: false
            }
        });
    }
});

// Enhanced palti endpoint with location bifurcation data
router.post('/palti-with-location', auth, async (req, res) => {
    const startTime = Date.now();
    try {
        const {
            sourceLocation,
            targetLocation,
            variety,
            outturnId,
            productType = 'Rice',
            sourcePackagingId,
            targetPackagingId,
            bags,
            quantityQuintals,
            conversionShortageKg = 0,
            notes = '',
            date = new Date().toISOString().split('T')[0]
        } = req.body;

        console.log('🔄 Creating palti with location tracking:', {
            sourceLocation,
            targetLocation,
            variety,
            outturnId,
            productType,
            bags,
            quantityQuintals
        });

        // Validate required parameters
        if (!sourceLocation) {
            return res.status(400).json({
                success: false,
                error: 'Source location is required',
                code: 'MISSING_SOURCE_LOCATION'
            });
        }

        if (!variety && !outturnId) {
            return res.status(400).json({
                success: false,
                error: 'Either variety or outturnId is required',
                code: 'MISSING_VARIETY_PARAMETER'
            });
        }

        if (!bags && !quantityQuintals) {
            return res.status(400).json({
                success: false,
                error: 'Either bags or quantityQuintals is required',
                code: 'MISSING_QUANTITY_PARAMETER'
            });
        }

        // First validate stock availability at source location
        const validation = await LocationBifurcationService.validatePaltiByLocation({
            sourceLocation,
            variety,
            outturnId: outturnId ? parseInt(outturnId) : undefined,
            productType,
            packagingId: sourcePackagingId ? parseInt(sourcePackagingId) : undefined,
            requestedBags: bags ? parseInt(bags) : undefined,
            requestedQtls: quantityQuintals ? parseFloat(quantityQuintals) : undefined,
            date
        });

        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Insufficient stock at source location',
                details: validation.message,
                validation,
                code: 'INSUFFICIENT_STOCK'
            });
        }

        // Create the palti movement record
        const paltiMovement = await sequelize.query(`
            INSERT INTO rice_stock_movements (
                date, movement_type, variety, outturn_id, product_type,
                location_code, from_location, to_location,
                packaging_id, source_packaging_id, target_packaging_id,
                bags, quantity_quintals, conversion_shortage_kg,
                notes, status, created_at, updated_at
            ) VALUES (
                :date, 'palti', :variety, :outturnId, :productType,
                :sourceLocation, :sourceLocation, :targetLocation,
                :sourcePackagingId, :sourcePackagingId, :targetPackagingId,
                :bags, :quantityQuintals, :conversionShortageKg,
                :notes, 'approved', NOW(), NOW()
            ) RETURNING *
        `, {
            replacements: {
                date,
                variety,
                outturnId: outturnId ? parseInt(outturnId) : null,
                productType,
                sourceLocation,
                targetLocation: targetLocation || sourceLocation,
                sourcePackagingId: sourcePackagingId ? parseInt(sourcePackagingId) : null,
                targetPackagingId: targetPackagingId ? parseInt(targetPackagingId) : null,
                bags: bags ? parseInt(bags) : 0,
                quantityQuintals: quantityQuintals ? parseFloat(quantityQuintals) : 0,
                conversionShortageKg: parseFloat(conversionShortageKg) || 0,
                notes
            },
            type: sequelize.QueryTypes.INSERT
        });

        // Update stock balances after palti
        const stockUpdate = await LocationBifurcationService.updateStockAfterPalti({
            sourceLocation,
            targetLocation: targetLocation || sourceLocation,
            variety,
            outturnId: outturnId ? parseInt(outturnId) : undefined,
            productType,
            sourcePackagingId: sourcePackagingId ? parseInt(sourcePackagingId) : undefined,
            targetPackagingId: targetPackagingId ? parseInt(targetPackagingId) : undefined,
            bags: bags ? parseInt(bags) : 0,
            quantityQuintals: quantityQuintals ? parseFloat(quantityQuintals) : 0,
            date
        });

        const responseTime = Date.now() - startTime;

        res.status(201).json({
            success: true,
            data: {
                paltiMovement: paltiMovement[0],
                stockUpdate,
                validation
            },
            message: 'Palti operation completed successfully with location tracking',
            performance: {
                responseTime: `${responseTime}ms`,
                cached: false
            }
        });

    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error('❌ Error creating palti with location:', error);

        res.status(500).json({
            success: false,
            error: 'Failed to create palti with location tracking',
            details: error.message,
            code: 'PALTI_CREATION_ERROR',
            performance: {
                responseTime: `${responseTime}ms`,
                cached: false
            }
        });
    }
});

module.exports = router;