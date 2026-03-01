const express = require('express');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const RiceProduction = require('../models/RiceProduction');
const Outturn = require('../models/Outturn');
const Packaging = require('../models/Packaging');

const router = express.Router();

// Get Rice Stock Report with month-wise pagination
router.get('/', auth, async (req, res) => {
    try {
        const { month, dateFrom, dateTo, productType, locationCode, page, limit } = req.query; // month format: YYYY-MM

        // Validate date formats
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (dateFrom && !dateRegex.test(dateFrom)) {
            return res.status(400).json({ error: 'Invalid dateFrom format. Use YYYY-MM-DD' });
        }
        if (dateTo && !dateRegex.test(dateTo)) {
            return res.status(400).json({ error: 'Invalid dateTo format. Use YYYY-MM-DD' });
        }

        // Validate product type
        const validProductTypes = [
            'Rice', 'Bran', 'Farm Bran', 'Rejection Rice', 'Sizer Broken',
            'Rejection Broken', 'Broken', 'Zero Broken', 'Faram',
            'Unpolished', 'RJ Rice 1', 'RJ Rice 2'
        ];
        if (productType && !validProductTypes.includes(productType)) {
            return res.status(400).json({ error: 'Invalid product type' });
        }

        const where = {
            status: 'approved'
        };

        // Exclude CLEARING entries - they represent waste/loss, not actual stock
        where[Op.or] = [
            { locationCode: { [Op.ne]: 'CLEARING' } },
            { locationCode: null } // Include loading entries (null locationCode but have lorryNumber/billNumber)
        ];

        // Month-wise filtering
        if (month) {
            const [year, monthNum] = month.split('-');
            const startDate = `${year}-${monthNum}-01`;
            const endDate = new Date(parseInt(year), parseInt(monthNum), 0).toISOString().split('T')[0];
            where.date = {
                [Op.gte]: startDate,
                [Op.lte]: endDate
            };
        } else if (dateFrom || dateTo) {
            where.date = {};
            if (dateFrom) where.date[Op.gte] = dateFrom;
            if (dateTo) where.date[Op.lte] = dateTo;
        }

        // Product type filtering
        if (productType) {
            where.productType = productType;
        }

        // Location code filtering
        if (locationCode) {
            where.locationCode = locationCode;
        }

        // Get all rice productions with related data
        const productions = await RiceProduction.findAll({
            where,
            include: [
                {
                    model: Outturn,
                    as: 'outturn',
                    attributes: ['id', 'code', 'allottedVariety', 'type']
                },
                {
                    model: Packaging,
                    as: 'packaging',
                    attributes: ['id', 'brandName', 'code', 'allottedKg']
                }
            ],
            order: [['date', 'ASC'], ['createdAt', 'ASC']]
        });

        // -------------------------------------------------------------------------
        // SECURITY FIX: Use parameterized queries to prevent SQL injection
        // PERFORMANCE: Parameterized queries also enable query plan caching
        // -------------------------------------------------------------------------
        const { QueryTypes } = require('sequelize');
        const replacements = {};
        const movementWhereParts = ["rsm.status = 'approved'"];

        // Month-wise filtering with parameterization
        if (month) {
            const [year, monthNum] = month.split('-');
            const startDate = `${year}-${monthNum.padStart(2, '0')}-01`;
            const endDate = new Date(parseInt(year), parseInt(monthNum), 0).toISOString().split('T')[0];
            movementWhereParts.push('rsm.date >= :startDate AND rsm.date <= :endDate');
            replacements.startDate = startDate;
            replacements.endDate = endDate;
        } else if (dateFrom || dateTo) {
            if (dateFrom) {
                movementWhereParts.push('rsm.date >= :dateFrom');
                replacements.dateFrom = dateFrom;
            }
            if (dateTo) {
                movementWhereParts.push('rsm.date <= :dateTo');
                replacements.dateTo = dateTo;
            }
        }

        // Product type filtering with parameterization
        if (productType) {
            movementWhereParts.push('rsm.product_type = :productType');
            replacements.productType = productType;
        }

        // Location code filtering with parameterization
        if (locationCode) {
            movementWhereParts.push('rsm.location_code = :locationCode');
            replacements.locationCode = locationCode;
        }

        const [movements] = await sequelize.query(`
            SELECT 
                rsm.id,
                rsm.date,
                rsm.movement_type as "movementType",
                rsm.product_type as "productType",
                -- STANDARDIZED VARIETY: Prefer outturn-based variety over free-text
                CASE 
                    WHEN rsm.outturn_id IS NOT NULL AND o.allotted_variety IS NOT NULL THEN 
                        UPPER(TRIM(CONCAT(o.allotted_variety, ' ', COALESCE(o.type, ''))))
                    ELSE 
                        UPPER(TRIM(rsm.variety))
                END as variety,
                rsm.outturn_id,
                o.code as outturn_code,
                o.allotted_variety as outturn_variety,
                o.type as outturn_type,
                rsm.bags,
                rsm.source_bags as "sourceBags",
                rsm.bag_size_kg as "bagSizeKg",
                rsm.quantity_quintals as "quantityQuintals",
                rsm.location_code as "locationCode",
                rsm.from_location,
                rsm.to_location,
                rsm.bill_number as "billNumber",
                rsm.lorry_number as "lorryNumber",
                rsm.conversion_shortage_kg,
                rsm.conversion_shortage_bags,
                p1."brandName" as packaging_brand,
                p1."allottedKg" as packaging_kg,
                p2."brandName" as source_packaging_brand,
                p2."allottedKg" as source_packaging_kg,
                p3."brandName" as target_packaging_brand,
                p3."allottedKg" as target_packaging_kg
            FROM rice_stock_movements rsm
            LEFT JOIN packagings p1 ON rsm.packaging_id = p1.id
            LEFT JOIN packagings p2 ON rsm.source_packaging_id = p2.id
            LEFT JOIN packagings p3 ON rsm.target_packaging_id = p3.id
            LEFT JOIN outturns o ON rsm.outturn_id = o.id
            WHERE ${movementWhereParts.join(' AND ')}
            ORDER BY rsm.date ASC, rsm.created_at ASC
        `, {
            replacements,
            type: QueryTypes.SELECT
        });


        // Helper function for consistent string normalization
        // FIXED: Now handles underscores (_) and hyphens (-) by treating them as spaces
        const normalize = (str) => (str || '').toString().toLowerCase().trim().replace(/[_\s-]+/g, ' ');

        // Helper function to create consistent stock grouping key
        // PERFECT VARIETY-WISE BIFURCATION: location + variety + packaging name + bag size
        const createStockKey = (prod) => {
            const variety = normalize(prod.variety);
            const type = normalize(prod.type);
            const product = normalize(prod.product);
            const packaging = normalize(prod.packaging);
            const location = normalize(prod.location);
            const bagSize = prod.bagSizeKg ? `${prod.bagSizeKg}kg` : 'Unknown';

            // Combine variety and type if type exists to form the unique variety identity
            const fullVariety = type ? `${variety} ${type}` : variety;

            // PERFECT GROUPING: location|variety|product|packaging|bagSize
            // This matches opening stock grouping for perfect consistency
            const category = product; // product type = category for grouping

            return `${location}|${fullVariety}|${category}|${packaging}|${bagSize}`;
        };

        // Helper function to find matching stock for deductions (PERFECT MATCH: location + variety + packaging name + bag size)
        const findMatchingStockForDeduction = (prod, runningStock) => {
            const searchVariety = normalize(prod.variety);
            const searchType = normalize(prod.type);
            const fullSearchVariety = searchType ? `${searchVariety} ${searchType}` : searchVariety;
            const searchProduct = normalize(prod.product);
            const searchPackaging = normalize(prod.packaging);
            const searchLocation = normalize(prod.location);
            const searchBagSize = prod.bagSizeKg ? `${prod.bagSizeKg}kg` : 'Unknown';

            return Object.keys(runningStock).find(k => {
                const stock = runningStock[k];
                const stockVariety = normalize(stock.variety);
                const stockType = normalize(stock.type);
                const fullStockVariety = stockType ? `${stockVariety} ${stockType}` : stockVariety;

                // PERFECT VALIDATION: location + variety + packaging name + bag size
                return fullStockVariety === fullSearchVariety &&
                    normalize(stock.product) === searchProduct &&
                    normalize(stock.packaging) === searchPackaging &&
                    normalize(stock.location) === searchLocation &&
                    normalize(stock.bagSizeKg ? `${stock.bagSizeKg}kg` : 'Unknown') === searchBagSize;
            });
        };

        // Helper function to format any rice transaction (Production or Movement)
        const formatTransaction = (item) => {
            const isProduction = item.productType !== undefined && item.movementType !== 'purchase' && item.movementType !== 'sale' && item.movementType !== 'palti';

            let variety, type, product, packaging, location, bagSizeKg;
            let displayLocation = 'N/A';
            let displayOutturn = 'N/A';

            if (isProduction) {
                // CRITICAL FIX: Production type variety integration with outturn
                // Combine allottedVariety and type to create consistent variety string
                const baseVariety = item.outturn ? item.outturn.allottedVariety : 'Unknown';
                const outturnType = item.outturn ? item.outturn.type : '';
                variety = outturnType ? `${baseVariety} ${outturnType}`.toUpperCase().trim() : baseVariety.toUpperCase().trim();
                type = outturnType; // Keep original type for reference
                product = item.productType;
                packaging = item.packaging ? item.packaging.brandName : 'N/A';
                bagSizeKg = item.packaging ? parseFloat(item.packaging.allottedKg) : 0;

                if (item.movementType === 'kunchinittu') {
                    displayLocation = item.locationCode ? item.locationCode.toUpperCase() : 'N/A';
                    location = displayLocation;
                } else {
                    displayLocation = `Lorry: ${item.lorryNumber || 'N/A'}, Bill: ${item.billNumber || 'N/A'}`;
                    location = item.locationCode || 'LOADING';
                }
                displayOutturn = item.outturn ? `${item.outturn.code} - ${item.outturn.allottedVariety} ${item.outturn.type}` : 'N/A';
            } else {
                // UPDATED: Movement variety standardization using outturn-based variety
                // Use the standardized variety from the SQL query (already handles outturn vs free-text)
                variety = item.variety ? item.variety.toUpperCase().trim() : 'Unknown';
                type = ''; // Movements already have variety strings like "BPT RAW"
                product = item.productType;
                packaging = item.packaging_brand || 'N/A';
                bagSizeKg = parseFloat(item.bagSizeKg) || 0;
                location = item.locationCode || 'N/A';
                displayLocation = location;

                // Enhanced display with outturn information when available
                if (item.outturn_id && item.outturn_code) {
                    displayOutturn = `${item.outturn_code} - ${item.outturn_variety || ''} ${item.outturn_type || ''}`.trim();
                } else {
                    displayOutturn = 'Legacy Variety';
                }

                if (item.movementType === 'purchase') {
                    displayLocation = `Purchase: ${item.from_location || 'Supplier'}`;
                } else if (item.movementType === 'sale') {
                    displayLocation = `Sale: ${item.to_location || 'Customer'}`;
                } else if (item.movementType === 'palti') {
                    displayLocation = `Palti: ${item.locationCode || 'Stock'}`;
                }
            }

            return {
                id: item.id,
                date: item.date,
                movementType: item.movementType,
                qtls: parseFloat(item.quantityQuintals) || 0,
                bags: parseInt(item.bags) || 0,
                sourceBags: parseInt(item.sourceBags) || 0,
                bagSizeKg,
                variety,
                type,
                product,
                packaging,
                location,
                displayLocation,
                displayOutturn,
                // Include outturn information for traceability
                outturnId: item.outturn_id || null,
                outturnCode: item.outturn_code || null,
                varietySource: item.outturn_id ? 'outturn-based' : 'legacy-string',
                // Palti location fields - CRITICAL for correct stock deduction
                from_location: item.from_location || item.locationCode || location,
                to_location: item.to_location || location,
                // Palti specific
                source_packaging: item.source_packaging_brand,
                target_packaging: item.target_packaging_brand,
                source_packaging_kg: item.source_packaging_kg,
                target_packaging_kg: item.target_packaging_kg,
                shortage_qtls: (parseFloat(item.conversion_shortage_kg) || 0) / 100
            };
        };


        // Helper function to process a transaction and update running stock
        const processTransaction = (trans, runningStock) => {
            const movementType = trans.movementType;

            if (movementType === 'loading' || movementType === 'sale') {
                // SUBTRACT from existing stock
                const matchingKey = findMatchingStockForDeduction(trans, runningStock);
                if (matchingKey) {
                    runningStock[matchingKey].qtls -= trans.qtls;
                    runningStock[matchingKey].bags -= trans.bags;
                    // Use a small epsilon for float comparison
                    if (runningStock[matchingKey].qtls <= 0.001) delete runningStock[matchingKey];
                } else {
                    console.warn(`Deduction without matching stock: ${trans.product} ${trans.variety} (${movementType})`);
                }
            } else if (movementType === 'palti') {
                // PALTI: Subtract from source location, add to target location
                const sourceLocation = trans.from_location || trans.location;
                const targetLocation = trans.to_location || trans.location;

                const normSourceLoc = normalize(sourceLocation);
                const normSourcePkg = normalize(trans.source_packaging || trans.packaging);
                const normProduct = normalize(trans.product);
                const normVariety = normalize(trans.variety);

                // CRITICAL FIX: STRICT MATCH for source deduction - product type + rice stock location + packaging name + packaging size
                let sourceKey = Object.keys(runningStock).find(k => {
                    const s = runningStock[k];
                    const sVariety = normalize(s.variety);
                    const sType = normalize(s.type);
                    const fullSVariety = sType ? `${sVariety} ${sType}` : sVariety;

                    // EXACT MATCH on all 4 conditions: product type + rice stock location + packaging name + packaging size
                    return normalize(s.product) === normProduct &&
                        normalize(s.location) === normSourceLoc &&
                        normalize(s.packaging) === normSourcePkg &&
                        fullSVariety === normVariety;
                });

                if (sourceKey) {
                    // CRITICAL FIX: Deduct original source bags and total weight (including shrinkage/shortage)
                    // trans.qtls in Palti is the NET (target) weight, so we add shortage to get the GROSS (source) weight.
                    // trans.bags is the target bag count, so we use trans.sourceBags for the source deduction.
                    const deductQtls = trans.qtls + (trans.shortage_qtls || 0);

                    // FIX: Calculate source bags from quintals if sourceBags is not stored
                    // This handles existing records where source_bags was NULL
                    let deductBags;
                    if (trans.sourceBags && trans.sourceBags > 0) {
                        deductBags = trans.sourceBags;
                    } else {
                        // Calculate from quintals and source packaging kg
                        // CRITICAL: Use the stock entry's bagSizeKg (original packaging size like 50kg)
                        // NOT the Palti movement's bagSizeKg which is the TARGET size (26kg)
                        const stockBagSize = runningStock[sourceKey]?.bagSizeKg;
                        const transSourcePkgKg = trans.source_packaging_kg;
                        const sourceKg = parseFloat(stockBagSize) || parseFloat(transSourcePkgKg) || 26;
                        deductBags = Math.round((deductQtls * 100) / sourceKg);

                        console.log(`📦 PALTI SOURCE BAG CALC: stockBagSize=${stockBagSize}, transSourcePkgKg=${transSourcePkgKg}, using=${sourceKg}kg, qtls=${deductQtls.toFixed(2)}, bags=${deductBags}`);
                    }

                    console.log(`🔄 PALTI DEDUCTION: ${normProduct} ${normVariety} from ${normSourceLoc} -${deductQtls.toFixed(2)} QTL, -${deductBags} bags (source: ${trans.sourceBags ? 'stored' : 'calculated'})`);


                    runningStock[sourceKey].qtls -= deductQtls;
                    runningStock[sourceKey].bags -= deductBags;


                    // Use a small epsilon for float comparison to avoid residual crumbs like 0.0000000001
                    if (runningStock[sourceKey].qtls <= 0.001) delete runningStock[sourceKey];
                } else {
                    console.warn(`❌ PALTI DEDUCTION FAILED - No exact match found: ${normProduct} ${normVariety} (${normSourcePkg}) at ${normSourceLoc}`);
                    console.warn('Available stock keys:', Object.keys(runningStock));
                }

                // Add to target location with target packaging
                const targetKey = createStockKey({
                    variety: trans.variety,
                    type: trans.type,
                    product: trans.product,
                    packaging: trans.target_packaging,
                    location: targetLocation
                });

                if (!runningStock[targetKey]) {
                    runningStock[targetKey] = {
                        qtls: 0, bags: 0, bagSizeKg: trans.target_packaging_kg,
                        product: trans.product, packaging: trans.target_packaging, location: targetLocation,
                        variety: trans.variety, type: trans.type
                    };
                }

                console.log(`➕ PALTI ADDITION: ${normProduct} ${normVariety} to ${targetLocation} +${trans.qtls.toFixed(2)} QTL, +${trans.bags} bags`);
                runningStock[targetKey].qtls += trans.qtls;
                runningStock[targetKey].bags += trans.bags;
            } else {
                // ADD to stock (kunchinittu, purchase, etc.)
                const key = createStockKey(trans);
                if (!runningStock[key]) {
                    runningStock[key] = {
                        qtls: 0, bags: 0, bagSizeKg: trans.bagSizeKg,
                        product: trans.product, packaging: trans.packaging, location: trans.location,
                        variety: trans.variety, type: trans.type, outturn: trans.displayOutturn
                    };
                }
                runningStock[key].qtls += trans.qtls;
                runningStock[key].bags += trans.bags;
            }
        };


        // Combine and Sort all transactions
        const allTransactions = [
            ...productions.map(p => formatTransaction(p)),
            ...movements.map(m => formatTransaction(m))
        ].sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            // If same date, productions first, then loading/sales
            const order = { 'kunchinittu': 1, 'purchase': 2, 'palti': 3, 'loading': 4, 'sale': 5 };
            return (order[a.movementType] || 9) - (order[b.movementType] || 9);
        });

        // Group by date for the requested range
        const groupedByDate = {};
        allTransactions.forEach(trans => {
            const date = trans.date;
            // Only group transactions that fall within the requested date range
            if (where.date) {
                const startDate = where.date[Op.gte];
                const endDate = where.date[Op.lte];
                if (date < startDate || date > endDate) return;
            }

            if (!groupedByDate[date]) {
                groupedByDate[date] = {
                    date,
                    openingStock: {},
                    productions: [],
                    closingStock: {}
                };
            }
            groupedByDate[date].productions.push(trans);
        });

        const dates = Object.keys(groupedByDate).sort();
        let runningStock = {};

        // Process ALL transactions before the start date to calculate the initial opening stock
        const firstDateRequested = dates.length > 0 ? dates[0] : (dateFrom || '2000-01-01');

        // Productions before range
        const priorProductions = await RiceProduction.findAll({
            where: {
                status: 'approved',
                date: { [Op.lt]: firstDateRequested },
                [Op.or]: [{ locationCode: { [Op.ne]: 'CLEARING' } }, { locationCode: null }]
            },
            include: [
                { model: Outturn, as: 'outturn', attributes: ['allottedVariety', 'type', 'code'] },
                { model: Packaging, as: 'packaging', attributes: ['brandName', 'allottedKg'] }
            ],
            order: [['date', 'ASC']]
        });

        // Movements before range - UPDATED: Include standardized variety format
        const [priorMovements] = await sequelize.query(`
            SELECT 
                rsm.date, rsm.movement_type as "movementType", rsm.product_type as "productType",
                -- STANDARDIZED VARIETY: Prefer outturn-based variety over free-text
                CASE 
                    WHEN rsm.outturn_id IS NOT NULL AND o.allotted_variety IS NOT NULL THEN 
                        UPPER(TRIM(CONCAT(o.allotted_variety, ' ', COALESCE(o.type, ''))))
                    ELSE 
                        UPPER(TRIM(rsm.variety))
                END as variety,
                rsm.outturn_id,
                o.code as outturn_code,
                rsm.bags, rsm.source_bags as "sourceBags", rsm.bag_size_kg as "bagSizeKg", rsm.quantity_quintals as "quantityQuintals",
                rsm.location_code as "locationCode",
                rsm.from_location,
                rsm.to_location,
                rsm.conversion_shortage_kg,
                p1."brandName" as packaging_brand,
                p2."brandName" as source_packaging_brand,
                p2."allottedKg" as source_packaging_kg,
                p3."brandName" as target_packaging_brand,
                p3."allottedKg" as target_packaging_kg
            FROM rice_stock_movements rsm
            LEFT JOIN packagings p1 ON rsm.packaging_id = p1.id
            LEFT JOIN packagings p2 ON rsm.source_packaging_id = p2.id
            LEFT JOIN packagings p3 ON rsm.target_packaging_id = p3.id
            LEFT JOIN outturns o ON rsm.outturn_id = o.id
            WHERE rsm.status = 'approved' AND rsm.date < '${firstDateRequested}'
            ORDER BY rsm.date ASC
        `);

        // Combine and process prior transactions
        const priorTransactions = [
            ...priorProductions.map(p => formatTransaction(p)),
            ...priorMovements.map(m => formatTransaction(m))
        ].sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            // Consistent sorting: additions first, then deductions/transfers
            const order = { 'kunchinittu': 1, 'purchase': 2, 'palti': 3, 'loading': 4, 'sale': 5 };
            return (order[a.movementType] || 9) - (order[b.movementType] || 9);
        });

        priorTransactions.forEach(trans => processTransaction(trans, runningStock));

        // CRITICAL: Cleanup DIRECT_LOAD from running stock BEFORE starting the requested range
        // This ensures the initial opening stock is clean
        Object.keys(runningStock).forEach(key => {
            const normalizedKey = key.toLowerCase();
            if (normalizedKey.includes('|direct load') || normalizedKey.includes('|loading')) {
                delete runningStock[key];
            }
        });


        // Process each date and calculate opening/closing stock
        dates.forEach(date => {
            const dayData = groupedByDate[date];

            // CRITICAL FIX: Opening stock variety-wise bifurcation
            // Ensure proper variety-wise opening stock calculation
            dayData.openingStock = JSON.parse(JSON.stringify(runningStock));

            // Log opening stock for debugging
            const openingStockCount = Object.keys(dayData.openingStock).length;
            if (openingStockCount > 0) {
                console.log(`📊 ${date} Opening Stock: ${openingStockCount} varieties`);
                Object.entries(dayData.openingStock).forEach(([key, stock]) => {
                    console.log(`  - ${stock.product} ${stock.variety} (${stock.packaging}) at ${stock.location}: ${stock.qtls.toFixed(2)} QTL`);
                });
            }

            // CRITICAL FIX: processTransactions array was actually called 'productions' but contained all trans
            // We iterate through and update runningStock for each transaction
            dayData.productions.forEach(trans => {
                processTransaction(trans, runningStock);
            });

            // CRITICAL FIX: Exclude DIRECT_LOAD from closing stock carry-over
            Object.keys(runningStock).forEach(key => {
                const normalizedKey = key.toLowerCase();
                if (normalizedKey.includes('|direct load') || normalizedKey.includes('|loading')) {
                    delete runningStock[key];
                }
            });

            dayData.closingStock = JSON.parse(JSON.stringify(runningStock));

            // Log closing stock for debugging
            const closingStockCount = Object.keys(dayData.closingStock).length;
            if (closingStockCount > 0) {
                console.log(`📊 ${date} Closing Stock: ${closingStockCount} varieties`);
                Object.entries(dayData.closingStock).forEach(([key, stock]) => {
                    console.log(`  - ${stock.product} ${stock.variety} (${stock.packaging}) at ${stock.location}: ${stock.qtls.toFixed(2)} QTL`);
                });
            }
        });

        // Validate stock continuity between consecutive days
        for (let i = 1; i < dates.length; i++) {
            const prevDate = dates[i - 1];
            const currDate = dates[i];

            const prevClosing = groupedByDate[prevDate].closingStock;
            const currOpening = groupedByDate[currDate].openingStock;

            // Compare stock objects
            const prevKeys = Object.keys(prevClosing).sort();
            const currKeys = Object.keys(currOpening).sort();

            if (JSON.stringify(prevKeys) !== JSON.stringify(currKeys)) {
                console.warn(`Stock continuity warning: ${prevDate} -> ${currDate}`);
                console.warn('Previous closing keys:', prevKeys);
                console.warn('Current opening keys:', currKeys);
            }

            // Compare quantities for matching keys
            prevKeys.forEach(key => {
                if (prevClosing[key] && currOpening[key]) {
                    if (Math.abs(prevClosing[key].qtls - currOpening[key].qtls) > 0.01) {
                        console.warn(`Quantity mismatch for ${key}: ${prevDate} closing=${prevClosing[key].qtls}, ${currDate} opening=${currOpening[key].qtls}`);
                    }
                }
            });
        }

        // Format response - use consistent structure for opening and closing stock with standardized variety format
        const allRiceStock = dates.map(date => {
            const dayData = groupedByDate[date];

            return {
                date,
                openingStock: Object.values(dayData.openingStock).map(stock => ({
                    qtls: stock.qtls,
                    bags: stock.bags,
                    bagSizeKg: stock.bagSizeKg,
                    product: stock.product,
                    packaging: stock.packaging,
                    location: stock.location,
                    variety: stock.variety, // Now uses standardized variety format
                    outturn: stock.outturn,
                    outturnId: stock.outturnId || null,
                    varietySource: stock.varietySource || 'legacy'
                })),
                productions: dayData.productions,
                closingStock: Object.values(dayData.closingStock).map(stock => ({
                    qtls: stock.qtls,
                    bags: stock.bags,
                    bagSizeKg: stock.bagSizeKg,
                    product: stock.product,
                    packaging: stock.packaging,
                    location: stock.location,
                    variety: stock.variety, // Now uses standardized variety format
                    outturn: stock.outturn,
                    outturnId: stock.outturnId || null,
                    varietySource: stock.varietySource || 'legacy'
                })),
                openingStockTotal: Object.values(dayData.openingStock).reduce((sum, s) => sum + s.qtls, 0),
                closingStockTotal: Object.values(dayData.closingStock).reduce((sum, s) => sum + s.qtls, 0)
            };
        });

        // Get available months for pagination
        const monthsQuery = await sequelize.query(`
      SELECT DISTINCT 
        TO_CHAR(date, 'YYYY-MM') as month,
        TO_CHAR(date, 'Month YYYY') as month_label
      FROM rice_productions
      WHERE status = 'approved'
      ORDER BY month DESC
    `);

        const availableMonths = monthsQuery[0];

        // Apply pagination only if not using month filter
        let responseData;

        if (month) {
            // Month-wise view: Return all records for the month
            responseData = {
                riceStock: allRiceStock,
                pagination: {
                    currentMonth: month,
                    availableMonths: availableMonths,
                    totalRecords: allRiceStock.length
                }
            };
        } else if (page && limit) {
            // Date range view: Use pagination
            const pageNum = parseInt(page) || 1;
            const limitNum = parseInt(limit) || 10;
            const startIndex = (pageNum - 1) * limitNum;
            const endIndex = startIndex + limitNum;
            const paginatedRiceStock = allRiceStock.slice(startIndex, endIndex);

            responseData = {
                riceStock: paginatedRiceStock,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.ceil(allRiceStock.length / limitNum),
                    totalRecords: allRiceStock.length,
                    recordsPerPage: limitNum,
                    availableMonths: availableMonths
                }
            };
        } else {
            // No pagination: Return all records
            responseData = {
                riceStock: allRiceStock,
                pagination: {
                    totalRecords: allRiceStock.length,
                    availableMonths: availableMonths
                }
            };
        }

        res.json(responseData);
    } catch (error) {
        console.error('Get rice stock error:', error);

        // Handle specific error types
        if (error.name === 'SequelizeConnectionError' || error.name === 'SequelizeDatabaseError') {
            return res.status(503).json({ error: 'Database connection error. Please try again.' });
        }

        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({ error: 'Invalid data format' });
        }

        res.status(500).json({ error: 'Failed to fetch rice stock' });
    }
});

module.exports = router;
