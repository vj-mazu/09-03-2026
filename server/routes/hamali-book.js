const express = require('express');
const { sequelize } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Get hamali book entries (both paddy and rice hamali)
router.get('/', auth, async (req, res) => {
    try {
        const { dateFrom, dateTo, year, month, page = 1, limit = 500 } = req.query;
        const offset = (Number.parseInt(page) - 1) * Number.parseInt(limit);
        const limitVal = Number.parseInt(limit);

        console.log('📋 Hamali book request params:', { dateFrom, dateTo, year, month, page, limit });

        // Build date filter for arrivals (for paddy hamali)
        let arrivalDateFilter = '';
        if (year && month) {
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate = new Date(Number.parseInt(year), Number.parseInt(month), 0).toISOString().split('T')[0];
            arrivalDateFilter = `AND a.date >= '${startDate}' AND a.date <= '${endDate}'`;
        } else if (dateFrom || dateTo) {
            const conditions = [];
            if (dateFrom) conditions.push(`a.date >= '${dateFrom}'`);
            if (dateTo) conditions.push(`a.date <= '${dateTo}'`);
            arrivalDateFilter = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
        }

        console.log('📋 Using arrival date filter:', arrivalDateFilter);

        // TASK 3: Enhanced paddy hamali query (simplified without status tracking)
        const paddyHamaliQuery = `
            SELECT 
                phe.id,
                a.date,
                phe.arrival_id as arrivalId,
                a."slNo" as arrivalNumber,
                phe.work_type as workType,
                phe.work_detail as workDetail,
                phe.bags,
                phe.rate as ratePerBag,
                phe.amount as totalAmount,
                phe.worker_name as workerName,
                phe.batch_number as batchNumber,
                phe.status,
                phe.created_at as createdAt
                
            FROM paddy_hamali_entries phe
            LEFT JOIN arrivals a ON phe.arrival_id = a.id
            
            WHERE phe.arrival_id IS NOT NULL ${arrivalDateFilter}
            ORDER BY a.date DESC, phe.created_at DESC
            LIMIT :limitVal OFFSET :offset
        `;

        console.log('📋 Executing paddy hamali query...');
        const paddyHamaliResult = await sequelize.query(paddyHamaliQuery, {
            replacements: { limitVal, offset },
            type: sequelize.QueryTypes.SELECT
        });
        console.log('✅ Paddy hamali query successful, found:', paddyHamaliResult.length, 'entries');

        // Build date filter for rice productions AND stock movements (for rice hamali)
        let productionDateFilter = '';
        if (year && month) {
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate = new Date(Number.parseInt(year), Number.parseInt(month), 0).toISOString().split('T')[0];
            productionDateFilter = `AND (COALESCE(rp.date, rsm.date) >= '${startDate}' AND COALESCE(rp.date, rsm.date) <= '${endDate}')`;
        } else if (dateFrom || dateTo) {
            const conditions = [];
            if (dateFrom) conditions.push(`COALESCE(rp.date, rsm.date) >= '${dateFrom}'`);
            if (dateTo) conditions.push(`COALESCE(rp.date, rsm.date) <= '${dateTo}'`);
            productionDateFilter = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
        }

        // ✅ FIX: Remove duplicate location JOINs that cause cartesian product
        const riceHamaliQuery = `
            SELECT 
                rhe.id,
                COALESCE(rp.date, rsm.date) as date,
                rhe.rice_production_id as productionId,
                rhe.rice_stock_movement_id as stockMovementId,
                
                -- Extract actual work type from remarks instead of using rate table
                CASE 
                    WHEN rhe.remarks ILIKE '%Kata 25/26 Kg Bunker work%' THEN 'Kata 25/26 Kg'
                    WHEN rhe.remarks ILIKE '%Kata 50 kg Machine Packing%' THEN 'Kata 50 kg Packing with stitching'
                    WHEN rhe.remarks ILIKE '%Kata 75 kg%' THEN 'Kata 75 kg Packing with stitching'
                    WHEN rhe.remarks ILIKE '%Cleaning and sorting%' THEN 'Cleaning Work'
                    WHEN rhe.remarks ILIKE '%Other Hamali:%' THEN 'Other Rice Work'
                    WHEN rhe.remarks ILIKE '%Auto-created%' THEN 'Rice Work'
                    WHEN rhe.remarks ILIKE '%other hamali%' THEN 'Other Rice Work'
                    ELSE COALESCE(rhr.work_type, 'Rice Work')
                END as workType,
                
                -- Extract actual work detail from remarks
                CASE 
                    WHEN rhe.remarks ILIKE '%Kata 25/26 Kg Bunker work%' THEN 'Bunker'
                    WHEN rhe.remarks ILIKE '%Kata 50 kg Machine Packing%' THEN 'Machine Packing'
                    WHEN rhe.remarks ILIKE '%Kata 75 kg%' THEN 
                        CASE 
                            WHEN rhe.remarks ILIKE '%Bunker%' THEN 'Bunker'
                            WHEN rhe.remarks ILIKE '%Machine%' THEN 'Machine Packing with Stitching'
                            ELSE COALESCE(rhr.work_detail, 'Packing')
                        END
                    WHEN rhe.remarks ILIKE '%Cleaning and sorting%' THEN 'Cleaning and sorting work'
                    WHEN rhe.remarks ILIKE '%Other Hamali:%' THEN 
                        TRIM(SUBSTRING(rhe.remarks FROM 'Other Hamali: ([^,]+)'))
                    WHEN rhe.remarks ILIKE '%Auto-created%' THEN 
                        CASE 
                            WHEN rhe.remarks ILIKE '%purchase%' THEN 'Auto-created (Purchase)'
                            WHEN rhe.remarks ILIKE '%sale%' THEN 'Auto-created (Sale)'
                            WHEN rhe.remarks ILIKE '%production%' THEN 'Auto-created (Production)'
                            ELSE 'Auto-created'
                        END
                    WHEN rhe.remarks ILIKE '%other hamali%' THEN 'Other Work'
                    ELSE COALESCE(rhr.work_detail, 'General Work')
                END as workDetail,
                
                rhe.bags,
                rhe.rate as rateperbag,
                rhe.amount as totalamount,
                COALESCE(rhe.remarks, '') as remarks,
                rhe.entry_type,
                rhe.created_at as createdAt,
                
                CASE 
                    WHEN rhe.remarks ILIKE '%other hamali%' THEN 'other_hamali'
                    WHEN rhe.remarks ILIKE '%Other Hamali:%' THEN 'other_hamali'
                    WHEN rhe.remarks ILIKE '%other:%' THEN 'other_hamali'
                    WHEN rhe.remarks ILIKE '%Auto-created%' THEN 'main_hamali'
                    ELSE 'main_hamali'
                END as hamali_category,
                
                CASE 
                    WHEN rhe.remarks LIKE '%Worker: %' THEN 
                        TRIM(SUBSTRING(rhe.remarks FROM 'Worker: ([^,]+)'))
                    WHEN rhe.remarks LIKE 'Auto-created%' THEN 
                        'System'
                    WHEN rhe.remarks LIKE '%Auto-created%' THEN 
                        'System'
                    ELSE 'Manual Entry'
                END as workerName,
                
                CASE 
                    WHEN rhe.remarks LIKE '%Batch: %' THEN 
                        CAST(TRIM(SUBSTRING(rhe.remarks FROM 'Batch: ([0-9]+)')) AS INTEGER)
                    ELSE 1
                END as batchNumber,
                
                rsm.movement_type,
                rsm.product_type,
                rsm.bill_number,
                rsm.lorry_number,
                
                CASE 
                    WHEN rhe.rice_production_id IS NOT NULL THEN 
                        COALESCE(o."allottedVariety", rp."productType", 'Unknown Variety')
                    WHEN rhe.rice_stock_movement_id IS NOT NULL THEN 
                        COALESCE(rsm.variety, rsm.product_type, 'Unknown Variety')
                    ELSE 'Unknown Variety'
                END as variety,
                
                -- ✅ FIX: Use only ONE location field to prevent duplicates
                CASE 
                    WHEN rhe.rice_production_id IS NOT NULL THEN 
                        COALESCE(rp."locationCode", 'Unknown Location')
                    WHEN rhe.rice_stock_movement_id IS NOT NULL THEN 
                        COALESCE(rsm.location_code, 'Unknown Location')
                    ELSE 'Unknown Location'
                END as location,
                
                o."allottedVariety" as outturn_variety,
                pkg."brandName" as brand_name
                
            FROM rice_hamali_entries rhe
            LEFT JOIN rice_productions rp ON rhe.rice_production_id = rp.id
            LEFT JOIN rice_stock_movements rsm ON rhe.rice_stock_movement_id = rsm.id
            LEFT JOIN rice_hamali_rates rhr ON rhe.rice_hamali_rate_id = rhr.id
            LEFT JOIN outturns o ON rp."outturnId" = o.id
            LEFT JOIN packagings pkg ON rp."packagingId" = pkg.id
            
            WHERE (rhe.rice_production_id IS NOT NULL OR rhe.rice_stock_movement_id IS NOT NULL)
            AND rhe.remarks NOT ILIKE '%Auto-created%'
            ${productionDateFilter}
            ORDER BY COALESCE(rp.date, rsm.date) DESC, rhe.created_at DESC
            LIMIT :limitVal OFFSET :offset
        `;

        console.log('📋 Executing rice hamali query...');
        const riceHamaliResult = await sequelize.query(riceHamaliQuery, {
            replacements: { limitVal, offset },
            type: sequelize.QueryTypes.SELECT
        });
        console.log('✅ Rice hamali query successful, found:', riceHamaliResult.length, 'entries');

        // 🔍 DEBUG: Check for duplicate IDs in raw results
        const riceHamaliIds = riceHamaliResult.map(r => r.id);
        const uniqueIds = [...new Set(riceHamaliIds)];
        console.log('🔍 DEBUG - Rice Hamali IDs:', {
            totalEntries: riceHamaliResult.length,
            uniqueIds: uniqueIds.length,
            hasDuplicates: riceHamaliResult.length !== uniqueIds.length,
            duplicateIds: riceHamaliIds.filter((id, index) => riceHamaliIds.indexOf(id) !== index)
        });

        // 🔍 DEBUG: Log first few entries to see structure
        if (riceHamaliResult.length > 0) {
            console.log('🔍 DEBUG - First rice hamali entry:', JSON.stringify(riceHamaliResult[0], null, 2));
            if (riceHamaliResult.length > 1) {
                console.log('🔍 DEBUG - Second rice hamali entry:', JSON.stringify(riceHamaliResult[1], null, 2));
            }
        }

        // Debug: Log the first raw entry to see field names
        if (riceHamaliResult.length > 0) {
            console.log('🔍 DEBUG - Raw rice hamali entry from SQL:', JSON.stringify(riceHamaliResult[0], null, 2));
            console.log('🔍 DEBUG - Rate field check:', {
                rateperbag: riceHamaliResult[0].rateperbag,
                ratePerBag: riceHamaliResult[0].ratePerBag,
                totalamount: riceHamaliResult[0].totalamount,
                totalAmount: riceHamaliResult[0].totalAmount
            });
        }

        // Categorize rice hamali entries into main and other hamali based on remarks
        const mainRiceHamali = riceHamaliResult.filter(entry => entry.hamali_category === 'main_hamali');
        const otherRiceHamali = riceHamaliResult.filter(entry => entry.hamali_category === 'other_hamali');

        // ✅ FIX: GROUP entries by work type + details, combining multiple batches into splits
        // Group main rice hamali by work type + variety + location
        const mainGroupMap = new Map();
        mainRiceHamali.forEach(entry => {
            const groupKey = `${entry.worktype}|${entry.workdetail}|${entry.variety}|${entry.location}`;

            if (!mainGroupMap.has(groupKey)) {
                mainGroupMap.set(groupKey, {
                    workType: entry.worktype || 'Unknown Work',
                    workDetail: entry.workdetail || 'Unknown Detail',
                    movementType: entry.movement_type || 'production',
                    variety: entry.variety || 'Unknown Variety',
                    location: entry.location || 'Unknown Location',
                    ratePerBag: parseFloat(entry.rateperbag) || 0,
                    totalBags: 0,
                    totalAmount: 0,
                    splits: []
                });
            }

            const group = mainGroupMap.get(groupKey);
            group.totalBags += entry.bags || 0;
            group.totalAmount += parseFloat(entry.totalamount) || 0;
            group.splits.push({
                id: entry.id,
                workerName: entry.workername || `Batch ${entry.batchnumber || 1}`,
                bags: entry.bags || 0,
                rate: parseFloat(entry.rateperbag) || 0,
                amount: parseFloat(entry.totalamount) || 0,
                batchNumber: entry.batchnumber || 1,
                billNumber: entry.bill_number,
                lorryNumber: entry.lorry_number,
                variety: entry.variety,
                location: entry.location
            });
        });
        const individualMainRiceHamali = Array.from(mainGroupMap.values());

        // ✅ FIX: GROUP other rice hamali by work type + details, combining multiple batches
        const otherGroupMap = new Map();
        otherRiceHamali.forEach(entry => {
            const groupKey = `${entry.worktype}|${entry.workdetail}|${entry.variety}|${entry.location}`;

            if (!otherGroupMap.has(groupKey)) {
                otherGroupMap.set(groupKey, {
                    workType: entry.worktype || 'Unknown Work',
                    workDetail: entry.workdetail || 'Unknown Detail',
                    movementType: entry.movement_type || 'production',
                    variety: entry.variety || 'Unknown Variety',
                    location: entry.location || 'Unknown Location',
                    ratePerBag: parseFloat(entry.rateperbag) || 0,
                    totalBags: 0,
                    totalAmount: 0,
                    splits: []
                });
            }

            const group = otherGroupMap.get(groupKey);
            group.totalBags += entry.bags || 0;
            group.totalAmount += parseFloat(entry.totalamount) || 0;
            group.splits.push({
                id: entry.id,
                workerName: entry.workername || `Batch ${entry.batchnumber || 1}`,
                bags: entry.bags || 0,
                rate: parseFloat(entry.rateperbag) || 0,
                amount: parseFloat(entry.totalamount) || 0,
                batchNumber: entry.batchnumber || 1,
                billNumber: entry.bill_number,
                lorryNumber: entry.lorry_number,
                variety: entry.variety,
                location: entry.location
            });
        });
        const individualOtherRiceHamali = Array.from(otherGroupMap.values());


        console.log('📊 Rice hamali categorization:', {
            total: riceHamaliResult.length,
            mainHamali: mainRiceHamali.length,
            otherHamali: otherRiceHamali.length
        });

        // Debug: Log the first few entries to see the data structure
        if (individualMainRiceHamali.length > 0) {
            console.log('🔍 DEBUG - Main rice hamali sample:', JSON.stringify(individualMainRiceHamali[0], null, 2));
        }
        if (individualOtherRiceHamali.length > 0) {
            console.log('🔍 DEBUG - Other rice hamali sample:', JSON.stringify(individualOtherRiceHamali[0], null, 2));
        }

        // TASK 3: Enhanced date filter for other hamali (only arrivals and rice productions)
        let otherDateFilter = '';
        if (year && month) {
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate = new Date(Number.parseInt(year), Number.parseInt(month), 0).toISOString().split('T')[0];
            otherDateFilter = `WHERE (a.date >= '${startDate}' AND a.date <= '${endDate}') OR (rp.date >= '${startDate}' AND rp.date <= '${endDate}') OR (DATE(ohe.created_at) >= '${startDate}' AND DATE(ohe.created_at) <= '${endDate}')`;
        } else if (dateFrom || dateTo) {
            const conditions = [];
            if (dateFrom) conditions.push(`(a.date >= '${dateFrom}' OR rp.date >= '${dateFrom}' OR DATE(ohe.created_at) >= '${dateFrom}')`);
            if (dateTo) conditions.push(`(a.date <= '${dateTo}' OR rp.date <= '${dateTo}' OR DATE(ohe.created_at) <= '${dateTo}')`);
            otherDateFilter = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        }

        // TASK 3: Enhanced other hamali query (simplified without status tracking)
        const otherHamaliQuery = `
            SELECT 
                ohe.id,
                COALESCE(a.date, DATE(ohe.created_at)) as date,
                ohe.arrival_id,
                NULL as rice_production_id,
                NULL as stock_movement_id,
                ohe.work_type as workName,
                ohe.work_detail,
                ohe.bags as quantity,
                ohe.rate,
                ohe.amount as totalAmount,
                ohe.worker_name as workerName,
                ohe.status,
                ohe.created_at as createdAt,
                -- No stock movement context for other hamali
                NULL as movement_type,
                NULL as stock_product_type
                
            FROM other_hamali_entries ohe
            LEFT JOIN arrivals a ON ohe.arrival_id = a.id
            
            WHERE ohe.arrival_id IS NOT NULL 
            ${otherDateFilter.replace(/WHERE/g, 'AND').replace(/rsm\.date/g, 'NULL').replace(/rp\.date/g, 'NULL')}
            ORDER BY ohe.created_at DESC
            LIMIT :limitVal OFFSET :offset
        `;

        console.log('📋 Executing other hamali query...');
        const otherHamaliResult = await sequelize.query(otherHamaliQuery, {
            replacements: { limitVal, offset },
            type: sequelize.QueryTypes.SELECT
        });
        console.log('✅ Other hamali query successful, found:', otherHamaliResult.length, 'entries');

        // TASK 3: Calculate totals with categorized rice hamali
        const paddyTotal = paddyHamaliResult.reduce((sum, entry) => sum + Number.parseFloat(entry.totalamount || 0), 0);
        const mainRiceTotal = mainRiceHamali.reduce((sum, entry) => sum + Number.parseFloat(entry.totalamount || 0), 0);
        const otherRiceTotal = otherRiceHamali.reduce((sum, entry) => sum + Number.parseFloat(entry.totalamount || 0), 0);
        const riceTotal = mainRiceTotal + otherRiceTotal;
        const otherTotal = otherHamaliResult.reduce((sum, entry) => sum + Number.parseFloat(entry.totalamount || 0), 0);
        const grandTotal = paddyTotal + riceTotal + otherTotal;

        console.log('📊 Enhanced hamali book summary:', {
            paddyEntries: paddyHamaliResult.length,
            mainRiceEntries: mainRiceHamali.length,
            otherRiceEntries: otherRiceHamali.length,
            totalRiceEntries: riceHamaliResult.length,
            otherEntries: otherHamaliResult.length,
            paddyTotal: paddyTotal.toFixed(2),
            mainRiceTotal: mainRiceTotal.toFixed(2),
            otherRiceTotal: otherRiceTotal.toFixed(2),
            riceTotal: riceTotal.toFixed(2),
            otherTotal: otherTotal.toFixed(2),
            grandTotal: grandTotal.toFixed(2),
            'MAIN_RICE_HAMALI_GROUPED_COUNT': individualMainRiceHamali.length,
            'OTHER_RICE_HAMALI_GROUPED_COUNT': individualOtherRiceHamali.length
        });

        // TASK 3: Enhanced response with categorized rice hamali and status tracking
        res.json({
            success: true,
            data: {
                paddyHamali: paddyHamaliResult,
                // ✅ FIX: Send grouped data with categorized main/other work
                riceHamali: {
                    all: riceHamaliResult, // Keep raw for backward compatibility
                    main: individualMainRiceHamali, // Grouped main rice hamali
                    other: individualOtherRiceHamali // Grouped other rice hamali
                },
                otherHamali: otherHamaliResult,
                summary: {
                    paddyTotal: paddyTotal.toFixed(2),
                    riceTotal: riceTotal.toFixed(2),
                    mainRiceTotal: mainRiceTotal.toFixed(2),
                    otherRiceTotal: otherRiceTotal.toFixed(2),
                    otherTotal: otherTotal.toFixed(2),
                    grandTotal: grandTotal.toFixed(2),
                    totalEntries: paddyHamaliResult.length + riceHamaliResult.length + otherHamaliResult.length,
                    paddyEntries: paddyHamaliResult.length,
                    riceEntries: riceHamaliResult.length,
                    mainRiceEntries: mainRiceHamali.length,
                    otherRiceEntries: otherRiceHamali.length,
                    otherEntries: otherHamaliResult.length
                },
                // ✅ FIX: Only send grouped data to prevent duplicates in frontend
                // Frontend displays mainGrouped and otherGrouped, so we don't need raw arrays
                riceHamaliCategorized: {
                    // Individual entries for display (properly formatted, no duplicates)
                    mainGrouped: individualMainRiceHamali,
                    otherGrouped: individualOtherRiceHamali,
                    // Keep raw arrays for backward compatibility but frontend shouldn't use these
                    all: riceHamaliResult,
                    main: mainRiceHamali,
                    other: otherRiceHamali
                }
            }
        });
    } catch (error) {
        console.error('❌ Error fetching hamali book:', error);

        // TASK 3: Enhanced error handling with user-friendly messages
        let userMessage = 'Failed to fetch hamali book entries';
        let errorCode = 'HAMALI_FETCH_ERROR';

        if (error.name === 'SequelizeConnectionError') {
            userMessage = 'Database connection issue. Please try again in a moment.';
            errorCode = 'DATABASE_CONNECTION_ERROR';
        } else if (error.name === 'SequelizeTimeoutError') {
            userMessage = 'Request timed out. The system may be busy, please try again.';
            errorCode = 'DATABASE_TIMEOUT_ERROR';
        } else if (error.name === 'SequelizeDatabaseError') {
            userMessage = 'Database query error. Please check your date filters and try again.';
            errorCode = 'DATABASE_QUERY_ERROR';
        } else if (error.message.includes('date')) {
            userMessage = 'Invalid date format provided. Please use YYYY-MM-DD format.';
            errorCode = 'INVALID_DATE_FORMAT';
        }

        res.status(500).json({
            success: false,
            error: userMessage,
            errorCode: errorCode,
            timestamp: new Date().toISOString(),
            // Include technical details only in development
            ...(process.env.NODE_ENV === 'development' && {
                technicalError: error.message,
                stack: error.stack
            })
        });
    }
});

// Get paddy hamali book entries only
router.get('/paddy', auth, async (req, res) => {
    try {
        const { dateFrom, dateTo, year, month } = req.query;

        // Build date filter
        let dateFilter = '';
        if (year && month) {
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate = new Date(Number.parseInt(year), Number.parseInt(month), 0).toISOString().split('T')[0];
            dateFilter = `WHERE phe.date >= '${startDate}' AND phe.date <= '${endDate}'`;
        } else if (dateFrom || dateTo) {
            const conditions = [];
            if (dateFrom) conditions.push(`phe.date >= '${dateFrom}'`);
            if (dateTo) conditions.push(`phe.date <= '${dateTo}'`);
            dateFilter = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        }

        const paddyHamaliQuery = `
            SELECT 
                phe.id,
                phe.date,
                phe.arrival_id as arrivalId,
                a.arrival_number as arrivalNumber,
                phe.work_type as workType,
                phe.bags,
                phe.rate_per_bag as ratePerBag,
                phe.total_amount as totalAmount,
                phe.worker_name as workerName,
                phe.batch_number as batchNumber,
                phe.status,
                phe.created_at as createdAt
            FROM paddy_hamali_entries phe
            LEFT JOIN arrivals a ON phe.arrival_id = a.id
            ${dateFilter}
            ORDER BY phe.date DESC, phe.created_at DESC
        `;

        const result = await sequelize.query(paddyHamaliQuery, { type: sequelize.QueryTypes.SELECT });
        const total = result.reduce((sum, entry) => sum + Number.parseFloat(entry.totalAmount || 0), 0);

        res.json({
            success: true,
            data: {
                entries: result,
                total: total.toFixed(2),
                count: result.length
            }
        });
    } catch (error) {
        console.error('❌ Error fetching paddy hamali book:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch paddy hamali book entries'
        });
    }
});

// Get rice hamali book entries only
router.get('/rice', auth, async (req, res) => {
    try {
        const { dateFrom, dateTo, year, month } = req.query;

        // Build date filter
        let dateFilter = '';
        if (year && month) {
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate = new Date(Number.parseInt(year), Number.parseInt(month), 0).toISOString().split('T')[0];
            dateFilter = `WHERE rhe.date >= '${startDate}' AND rhe.date <= '${endDate}'`;
        } else if (dateFrom || dateTo) {
            const conditions = [];
            if (dateFrom) conditions.push(`rhe.date >= '${dateFrom}'`);
            if (dateTo) conditions.push(`rhe.date <= '${dateTo}'`);
            dateFilter = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        }

        const riceHamaliQuery = `
            SELECT 
                rhe.id,
                rhe.date,
                rhe.production_id as productionId,
                rhe.work_type as workType,
                rhe.bags,
                rhe.rate_per_bag as ratePerBag,
                rhe.total_amount as totalAmount,
                rhe.status,
                rhe.created_at as createdAt
            FROM rice_hamali_entries rhe
            ${dateFilter}
            ORDER BY rhe.date DESC, rhe.created_at DESC
        `;

        const result = await sequelize.query(riceHamaliQuery, { type: sequelize.QueryTypes.SELECT });
        const total = result.reduce((sum, entry) => sum + Number.parseFloat(entry.totalAmount || 0), 0);

        res.json({
            success: true,
            data: {
                entries: result,
                total: total.toFixed(2),
                count: result.length
            }
        });
    } catch (error) {
        console.error('❌ Error fetching rice hamali book:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch rice hamali book entries'
        });
    }
});

module.exports = router;