const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const { sequelize } = require('../config/database');
const router = express.Router();

// Get pending rice hamali entries for approval (managers/admins only)
router.get('/pending-list', auth, async (req, res) => {
  try {
    // Only managers and admins can view pending list
    if (req.user.role === 'staff') {
      return res.status(403).json({ success: false, error: 'Access denied. Manager or Admin role required.' });
    }

    // Check if rice_hamali_entries table exists first
    const [tableExists] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'rice_hamali_entries'
    `);

    if (tableExists.length === 0) {
      return res.json({ success: true, entries: [] });
    }

    // Check if status column exists
    const [statusColumn] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'rice_hamali_entries' 
      AND column_name = 'status'
    `);

    if (statusColumn.length === 0) {
      // Status column doesn't exist yet - return empty array
      console.log('⚠️ rice_hamali_entries status column not found, returning empty pending list');
      return res.json({ success: true, entries: [] });
    }

    const [entries] = await sequelize.query(`
      SELECT 
        rhe.id,
        rhe.rice_production_id,
        rhe.rice_stock_movement_id,
        rhe.rice_hamali_rate_id,
        rhe.bags,
        rhe.rate,
        rhe.amount,
        rhe.status,
        rhe.remarks,
        rhe.created_at as "createdAt",
        rhr.work_type as "workType",
        rhr.work_detail as "workDetail",
        rp.date as "productionDate",
        rp."productType" as "productType",
        rsm.date as "movementDate",
        rsm.movement_type as "movementType",
        u.username as "creatorUsername",
        u.role as "creatorRole"
      FROM rice_hamali_entries rhe
      LEFT JOIN rice_hamali_rates rhr ON rhe.rice_hamali_rate_id = rhr.id
      LEFT JOIN rice_productions rp ON rhe.rice_production_id = rp.id
      LEFT JOIN rice_stock_movements rsm ON rhe.rice_stock_movement_id = rsm.id
      LEFT JOIN users u ON rhe.created_by = u.id
      WHERE rhe.status = 'pending' AND rhe.is_active = true
      ORDER BY rhe.created_at DESC
      LIMIT 500
    `);

    res.json({ success: true, entries });
  } catch (error) {
    console.error('Get pending rice hamali entries error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pending rice hamali entries' });
  }
});

// Bulk approve rice hamali entries
router.post('/bulk-approve', auth, async (req, res) => {
  try {
    if (req.user.role === 'staff') {
      return res.status(403).json({ success: false, error: 'Access denied. Manager or Admin role required.' });
    }

    const { entryIds } = req.body;
    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Entry IDs are required' });
    }

    await sequelize.query(`
      UPDATE rice_hamali_entries 
      SET status = 'approved', 
          approved_by = :userId, 
          approved_at = NOW(),
          updated_at = NOW()
      WHERE id IN (:ids) AND status = 'pending'
    `, {
      replacements: { userId: req.user.userId, ids: entryIds },
      type: sequelize.QueryTypes.UPDATE
    });

    res.json({ success: true, message: `${entryIds.length} rice hamali entry/entries approved successfully` });
  } catch (error) {
    console.error('Bulk approve rice hamali entries error:', error);
    res.status(500).json({ success: false, error: 'Failed to approve rice hamali entries' });
  }
});

// Bulk reject rice hamali entries
router.post('/bulk-reject', auth, async (req, res) => {
  try {
    if (req.user.role === 'staff') {
      return res.status(403).json({ success: false, error: 'Access denied. Manager or Admin role required.' });
    }

    const { entryIds, remarks } = req.body;
    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Entry IDs are required' });
    }

    await sequelize.query(`
      UPDATE rice_hamali_entries 
      SET status = 'rejected',
          rejection_remarks = :remarks,
          rejected_by = :userId,
          rejected_at = NOW(),
          updated_at = NOW()
      WHERE id IN (:ids) AND status = 'pending'
    `, {
      replacements: { ids: entryIds, remarks: remarks || null, userId: req.user.userId },
      type: sequelize.QueryTypes.UPDATE
    });

    res.json({ success: true, message: `${entryIds.length} rice hamali entry/entries rejected` });
  } catch (error) {
    console.error('Bulk reject rice hamali entries error:', error);
    res.status(500).json({ success: false, error: 'Failed to reject rice hamali entries' });
  }
});

// Get all rice hamali entries
router.get('/', auth, async (req, res) => {
  try {
    const { riceProductionId, page = 1, limit = 500 } = req.query;
    const offset = (Number.parseInt(page) - 1) * Number.parseInt(limit);
    const limitVal = Number.parseInt(limit);

    // Check if rice_hamali_entries table exists first
    const [tableExists] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'rice_hamali_entries'
    `);

    if (tableExists.length === 0) {
      console.log('⚠️ rice_hamali_entries table does not exist yet');
      return res.json({
        success: true,
        data: { entries: [] }
      });
    }

    let whereClause = 'WHERE rhe.is_active = true';
    const replacements = {};

    if (riceProductionId) {
      whereClause += ' AND rhe.rice_production_id = :riceProductionId';
      replacements.riceProductionId = riceProductionId;
    }

    const [entries] = await sequelize.query(`
      SELECT 
        rhe.id,
        rhe.rice_production_id,
        rhe.rice_hamali_rate_id,
        rhe.bags,
        rhe.remarks,
        rhe.created_at,
        rhe.updated_at,
        rhr.work_type,
        rhr.work_detail,
        rhr.rate_18_21,
        rhr.rate_21_24,
        rhr.rate_24_27,
        rp.date as production_date,
        rp."productType" as product_type,
        rp.bags as total_bags,
        u.username as created_by_username
      FROM rice_hamali_entries rhe
      LEFT JOIN rice_hamali_rates rhr ON rhe.rice_hamali_rate_id = rhr.id
      LEFT JOIN rice_productions rp ON rhe.rice_production_id = rp.id
      LEFT JOIN users u ON rhe.created_by = u.id
      ${whereClause}
      ORDER BY rhe.created_at DESC
      LIMIT :limitVal OFFSET :offset
    `, {
      replacements: { ...replacements, limitVal, offset }
    });

    res.json({
      success: true,
      data: { entries }
    });
  } catch (error) {
    console.error('Error fetching rice hamali entries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rice hamali entries'
    });
  }
});

// Get rice hamali entries by rice production IDs (batch)
router.post('/batch', auth, async (req, res) => {
  try {
    const { riceProductionIds = [], stockMovementIds = [] } = req.body;

    console.log('🔍 Batch hamali request:', {
      riceProductionIds: riceProductionIds?.length || 0,
      stockMovementIds: stockMovementIds?.length || 0
    });

    if ((!riceProductionIds || riceProductionIds.length === 0) &&
      (!stockMovementIds || stockMovementIds.length === 0)) {
      console.log('ℹ️ No IDs provided for hamali batch fetch');
      return res.json({
        success: true,
        data: { entries: {} }
      });
    }

    // Check if rice_hamali_entries table exists first
    const [tableExists] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'rice_hamali_entries'
    `);

    if (tableExists.length === 0) {
      console.log('⚠️ rice_hamali_entries table does not exist yet');
      return res.json({
        success: true,
        data: { entries: {} }
      });
    }

    const entries = {};

    // Fetch entries for rice productions
    if (riceProductionIds && riceProductionIds.length > 0) {
      console.log('📊 Fetching hamali for rice productions:', riceProductionIds.length);
      const [productionEntries] = await sequelize.query(`
        SELECT 
          rhe.id,
          rhe.rice_production_id,
          rhe.rice_stock_movement_id,
          rhe.bags,
          rhe.remarks,
          rhe.created_at,
          rhe.updated_at,
          rhr.work_type,
          rhr.work_detail,
          rhr.rate_18_21,
          rhr.rate_21_24,
          rhr.rate_24_27,
          u.username as created_by_username
        FROM rice_hamali_entries rhe
        LEFT JOIN rice_hamali_rates rhr ON rhe.rice_hamali_rate_id = rhr.id
        LEFT JOIN users u ON rhe.created_by = u.id
        WHERE rhe.rice_production_id IN (:riceProductionIds) 
        AND rhe.is_active = true
        ORDER BY rhe.created_at DESC
      `, {
        replacements: { riceProductionIds }
      });

      // Group by rice production ID
      productionEntries.forEach(entry => {
        const key = entry.rice_production_id.toString();
        if (!entries[key]) entries[key] = [];
        entries[key].push(entry);
      });
    }

    // Fetch entries for stock movements
    if (stockMovementIds && stockMovementIds.length > 0) {
      console.log('📦 Fetching hamali for stock movements:', stockMovementIds.length);
      const [movementEntries] = await sequelize.query(`
        SELECT 
          rhe.id,
          rhe.rice_production_id,
          rhe.rice_stock_movement_id,
          rhe.bags,
          rhe.remarks,
          rhe.created_at,
          rhe.updated_at,
          rhr.work_type,
          rhr.work_detail,
          rhr.rate_18_21,
          rhr.rate_21_24,
          rhr.rate_24_27,
          u.username as created_by_username
        FROM rice_hamali_entries rhe
        LEFT JOIN rice_hamali_rates rhr ON rhe.rice_hamali_rate_id = rhr.id
        LEFT JOIN users u ON rhe.created_by = u.id
        WHERE rhe.rice_stock_movement_id IN (:stockMovementIds) 
        AND rhe.is_active = true
        ORDER BY rhe.created_at DESC
      `, {
        replacements: { stockMovementIds }
      });

      // Group by stock movement ID
      movementEntries.forEach(entry => {
        const key = `movement-${entry.rice_stock_movement_id}`;
        if (!entries[key]) entries[key] = [];
        entries[key].push(entry);
      });
    }

    console.log(`✅ Found hamali entries for ${Object.keys(entries).length} records`);
    res.json({
      success: true,
      data: { entries }
    });
  } catch (error) {
    console.error('Error fetching rice hamali entries batch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rice hamali entries'
    });
  }
});

// Bulk create rice hamali entries
router.post('/bulk', auth, async (req, res) => {
  try {
    const { riceProductionId, stockMovementId, movementType, isStockMovement, entries } = req.body;

    console.log('🔄 Rice hamali bulk creation request:', {
      riceProductionId,
      stockMovementId,
      movementType,
      isStockMovement,
      entriesCount: entries?.length || 0,
      userId: req.user.userId
    });

    // Enhanced validation with detailed error messages
    if (!riceProductionId && !stockMovementId) {
      console.log('❌ Validation failed: No production or stock movement ID provided');
      return res.status(400).json({
        success: false,
        error: 'Either rice production ID or stock movement ID is required',
        code: 'MISSING_REFERENCE_ID'
      });
    }

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      console.log('❌ Validation failed: Invalid entries array');
      return res.status(400).json({
        success: false,
        error: 'Entries array is required and must contain at least one entry',
        code: 'INVALID_ENTRIES_ARRAY'
      });
    }

    let totalBags = 0;
    let referenceId = null;

    if (isStockMovement && stockMovementId) {
      // Handle stock movement (Purchase/Sale/Palti)
      console.log('🔍 Validating stock movement:', stockMovementId);
      const [stockMovement] = await sequelize.query(`
        SELECT id, bags as total_bags, movement_type, date FROM rice_stock_movements WHERE id = :stockMovementId
      `, {
        replacements: { stockMovementId }
      });

      if (stockMovement.length === 0) {
        console.log('❌ Stock movement not found:', stockMovementId);
        return res.status(404).json({
          success: false,
          error: 'Stock movement not found',
          code: 'STOCK_MOVEMENT_NOT_FOUND'
        });
      }

      totalBags = stockMovement[0].total_bags;
      referenceId = stockMovementId;

      console.log('✅ Stock movement validated:', {
        stockMovementId,
        movementType: stockMovement[0].movement_type,
        date: stockMovement[0].date,
        totalBags
      });
    } else {
      // Handle regular rice production
      console.log('🔍 Validating rice production:', riceProductionId);
      const [riceProduction] = await sequelize.query(`
        SELECT id, bags as total_bags, date FROM rice_productions WHERE id = :riceProductionId
      `, {
        replacements: { riceProductionId }
      });

      if (riceProduction.length === 0) {
        console.log('❌ Rice production not found:', riceProductionId);
        return res.status(404).json({
          success: false,
          error: 'Rice production not found',
          code: 'RICE_PRODUCTION_NOT_FOUND'
        });
      }

      totalBags = riceProduction[0].total_bags;
      referenceId = riceProductionId;

      console.log('✅ Rice production validated:', {
        riceProductionId,
        date: riceProduction[0].date,
        totalBags
      });
    }

    const transaction = await sequelize.transaction();

    try {
      const createdEntries = [];
      console.log(`🔄 Creating ${entries.length} rice hamali entries...`);

      for (const [index, entry] of entries.entries()) {
        const { workType, workDetail, rate, bags, workerName, batchNumber } = entry;

        console.log(`  Processing entry ${index + 1}/${entries.length}:`, { workType, workDetail, bags });

        // Enhanced validation for each entry
        if (!workType || !workDetail || !rate || !bags) {
          throw new Error(`Entry ${index + 1}: Missing required fields (workType, workDetail, rate, bags)`);
        }

        if (bags <= 0) {
          throw new Error(`Entry ${index + 1}: Bags must be greater than 0`);
        }

        // Find the rice hamali rate ID based on work type and detail
        const [rateResult] = await sequelize.query(`
          SELECT id, rate_24_27 FROM rice_hamali_rates 
          WHERE work_type = :workType AND work_detail = :workDetail AND is_active = true
          LIMIT 1
        `, {
          replacements: { workType, workDetail },
          transaction
        });

        if (rateResult.length === 0) {
          throw new Error(`Entry ${index + 1}: Rice hamali rate not found for ${workType} - ${workDetail}`);
        }

        const riceHamaliRateId = rateResult[0].id;
        const actualRate = rateResult[0].rate_24_27;

        console.log(`    Found rate ID: ${riceHamaliRateId}, Rate: ₹${actualRate}`);

        const [result] = await sequelize.query(`
          INSERT INTO rice_hamali_entries (
            rice_production_id, 
            rice_stock_movement_id,
            entry_type,
            rice_hamali_rate_id, 
            bags,
            rate,
            amount,
            remarks,
            status,
            is_active,
            created_by,
            created_at,
            updated_at
          ) VALUES (:riceProductionId, :stockMovementId, :entryType, :riceHamaliRateId, :bags, :rate, :amount, :remarks, :status, true, :createdBy, NOW(), NOW())
          RETURNING *
        `, {
          replacements: {
            riceProductionId: isStockMovement ? null : riceProductionId,
            stockMovementId: isStockMovement ? stockMovementId : null,
            entryType: isStockMovement ? movementType : 'production',
            riceHamaliRateId,
            bags,
            rate: actualRate,
            amount: bags * actualRate,
            remarks: `${workerName ? `Worker: ${workerName}, ` : ''}${batchNumber ? `Batch: ${batchNumber}, ` : ''}${movementType ? `Type: ${movementType}, ` : ''}Rate: ₹${rate}`,
            status: req.user.role === 'staff' ? 'pending' : 'approved',
            createdBy: req.user.userId
          },
          transaction
        });

        console.log(`    ✅ Entry ${index + 1} created with ID: ${result[0].id}`);
        createdEntries.push(result[0]);
      }

      await transaction.commit();
      console.log(`🎉 Successfully created ${createdEntries.length} rice hamali entries`);

      // Verify entries were saved by querying them back
      const entryIds = createdEntries.map(e => e.id);
      const [verificationResult] = await sequelize.query(`
        SELECT COUNT(*) as count FROM rice_hamali_entries WHERE id IN (${entryIds.join(',')})
      `);

      console.log(`✅ Verification: ${verificationResult[0].count} entries confirmed in database`);

      res.json({
        success: true,
        message: `${createdEntries.length} rice hamali entries created successfully`,
        data: {
          entries: createdEntries,
          verified: verificationResult[0].count === createdEntries.length
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.log('❌ Transaction rolled back due to error:', error.message);
      throw error;
    }

  } catch (error) {
    console.error('Error creating bulk rice hamali entries:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create rice hamali entries'
    });
  }
});

// Add new rice hamali entry
router.post('/', auth, async (req, res) => {
  try {
    const {
      riceProductionId,
      riceHamaliRateId,
      bags,
      remarks
    } = req.body;

    // Validate required fields
    if (!riceProductionId || !riceHamaliRateId || !bags) {
      return res.status(400).json({
        success: false,
        error: 'Rice production ID, rice hamali rate ID, and bags are required'
      });
    }

    // Check if rice production exists
    const [riceProduction] = await sequelize.query(`
      SELECT id, bags as total_bags FROM rice_productions WHERE id = :riceProductionId
    `, {
      replacements: { riceProductionId }
    });

    if (riceProduction.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rice production not found'
      });
    }

    // Check if rice hamali rate exists
    const [riceHamaliRate] = await sequelize.query(`
      SELECT id FROM rice_hamali_rates WHERE id = :riceHamaliRateId AND is_active = true
    `, {
      replacements: { riceHamaliRateId }
    });

    if (riceHamaliRate.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rice hamali rate not found'
      });
    }

    // Validate bags don't exceed total
    if (bags > riceProduction[0].total_bags) {
      return res.status(400).json({
        success: false,
        error: `Bags cannot exceed total production bags (${riceProduction[0].total_bags})`
      });
    }

    const [result] = await sequelize.query(`
      INSERT INTO rice_hamali_entries 
      (rice_production_id, rice_hamali_rate_id, bags, remarks, status, created_by)
      VALUES (:riceProductionId, :riceHamaliRateId, :bags, :remarks, :status, :createdBy)
      RETURNING *
    `, {
      replacements: {
        riceProductionId,
        riceHamaliRateId,
        bags,
        remarks: remarks || null,
        status: req.user.role === 'staff' ? 'pending' : 'approved',
        createdBy: req.user.userId
      }
    });

    res.json({
      success: true,
      message: 'Rice hamali entry added successfully',
      data: result[0]
    });
  } catch (error) {
    console.error('Error adding rice hamali entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add rice hamali entry'
    });
  }
});

// Update rice hamali entry
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { bags, remarks } = req.body;

    const [result] = await sequelize.query(`
      UPDATE rice_hamali_entries 
      SET 
        bags = :bags,
        remarks = :remarks,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = :id AND is_active = true
      RETURNING *
    `, {
      replacements: {
        id,
        bags,
        remarks
      }
    });

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rice hamali entry not found'
      });
    }

    res.json({
      success: true,
      message: 'Rice hamali entry updated successfully',
      data: result[0]
    });
  } catch (error) {
    console.error('Error updating rice hamali entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update rice hamali entry'
    });
  }
});

// Delete rice hamali entry
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await sequelize.query(`
      UPDATE rice_hamali_entries 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = :id
      RETURNING *
    `, {
      replacements: { id }
    });

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rice hamali entry not found'
      });
    }

    res.json({
      success: true,
      message: 'Rice hamali entry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting rice hamali entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete rice hamali entry'
    });
  }
});

// Get rice hamali summary by date (like paddy hamali)
router.get('/summary/:date', auth, async (req, res) => {
  try {
    const { date } = req.params;

    // Check if rice_hamali_entries table exists first
    const [tableExists] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'rice_hamali_entries'
    `);

    if (tableExists.length === 0) {
      console.log('⚠️ rice_hamali_entries table does not exist yet');
      return res.json({
        success: true,
        summary: {
          riceHamaliEntries: {},
          grandTotal: 0,
          totalEntries: 0
        }
      });
    }

    // Get rice productions for the date
    const [riceProductions] = await sequelize.query(`
      SELECT id, "productType", date, "locationCode", "outturnId", "packagingId"
      FROM rice_productions 
      WHERE date = :date
    `, {
      replacements: { date }
    });

    // Also get rice stock movements for the date
    const [riceStockMovements] = await sequelize.query(`
      SELECT id, movement_type, variety, location_code, date, product_type, bill_number, lorry_number
      FROM rice_stock_movements 
      WHERE date = :date
    `, {
      replacements: { date }
    });

    if (riceProductions.length === 0 && riceStockMovements.length === 0) {
      return res.json({
        success: true,
        summary: {
          riceHamaliEntries: {},
          grandTotal: 0,
          totalEntries: 0
        }
      });
    }

    let allEntries = [];

    // Fetch rice hamali entries for rice productions
    if (riceProductions.length > 0) {
      const riceProductionIds = riceProductions.map(rp => rp.id);
      const prodPlaceholders = riceProductionIds.map((_, index) => `:prodId${index}`).join(',');
      const prodReplacements = {};
      riceProductionIds.forEach((id, index) => {
        prodReplacements[`prodId${index}`] = id;
      });

      const [prodEntries] = await sequelize.query(`
        SELECT 
          rhe.id,
          rhe.rice_production_id,
          rhe.rice_stock_movement_id,
          rhe.entry_type,
          rhe.rice_hamali_rate_id,
          rhe.bags,
          rhe.remarks,
          rhe.created_at,
          rhr.work_type,
          rhr.work_detail,
          rhr.rate_18_21,
          rhr.rate_21_24,
          rhr.rate_24_27,
          u.username as created_by_username,
          -- Extract worker name from remarks field using regex
          CASE 
            WHEN rhe.remarks LIKE 'Worker: %' THEN 
              TRIM(SUBSTRING(rhe.remarks FROM 'Worker: ([^,]+)'))
            ELSE u.username
          END as worker_name,
          -- Add rice production details with variety and location
          rp."productType" as product_type,
          rp.date as production_date,
          rp."locationCode" as location_code,
          o.code as outturn_code,
          o."allottedVariety" as variety,
          p."brandName" as packaging_brand,
          p."allottedKg" as packaging_kg,
          -- Add movement type for display
          COALESCE(rhe.entry_type, 'production') as movement_type,
          -- Add bill and lorry info if available from stock movements
          null as bill_number,
          null as lorry_number
        FROM rice_hamali_entries rhe
        LEFT JOIN rice_hamali_rates rhr ON rhe.rice_hamali_rate_id = rhr.id
        LEFT JOIN users u ON rhe.created_by = u.id
        LEFT JOIN rice_productions rp ON rhe.rice_production_id = rp.id
        LEFT JOIN outturns o ON rp."outturnId" = o.id
        LEFT JOIN packagings p ON rp."packagingId" = p.id
        WHERE rhe.rice_production_id IN (${prodPlaceholders}) 
          AND rhe.is_active = true
          AND (rhe.remarks IS NULL OR rhe.remarks NOT LIKE 'Other Hamali:%')
        ORDER BY rhe.rice_production_id, rhe.created_at DESC
      `, {
        replacements: prodReplacements
      });

      allEntries = allEntries.concat(prodEntries);
    }

    // Fetch rice hamali entries for stock movements
    if (riceStockMovements.length > 0) {
      const stockMovementIds = riceStockMovements.map(rsm => rsm.id);
      const moveReplacements = {};
      const movePlaceholders = stockMovementIds.map((_, index) => `:moveId${index}`).join(',');
      stockMovementIds.forEach((id, index) => {
        moveReplacements[`moveId${index}`] = id;
      });

      const [moveEntries] = await sequelize.query(`
        SELECT 
          rhe.id,
          rhe.rice_production_id,
          rhe.rice_stock_movement_id,
          rhe.entry_type,
          rhe.rice_hamali_rate_id,
          rhe.bags,
          rhe.remarks,
          rhe.created_at,
          rhr.work_type,
          rhr.work_detail,
          rhr.rate_18_21,
          rhr.rate_21_24,
          rhr.rate_24_27,
          u.username as created_by_username,
          -- Extract worker name from remarks field using regex
          CASE 
            WHEN rhe.remarks LIKE 'Worker: %' THEN 
              TRIM(SUBSTRING(rhe.remarks FROM 'Worker: ([^,]+)'))
            ELSE u.username
          END as worker_name,
          -- Add stock movement details
          rsm.movement_type as movement_type,
          rsm.variety as variety,
          rsm.location_code as location_code,
          rsm.date as movement_date,
          rsm.product_type as product_type,
          p."brandName" as packaging_brand,
          p."allottedKg" as packaging_kg,
          -- Add bill and lorry info
          rsm.bill_number as bill_number,
          rsm.lorry_number as lorry_number,
          null as outturn_code
        FROM rice_hamali_entries rhe
        LEFT JOIN rice_hamali_rates rhr ON rhe.rice_hamali_rate_id = rhr.id
        LEFT JOIN users u ON rhe.created_by = u.id
        LEFT JOIN rice_stock_movements rsm ON rhe.rice_stock_movement_id = rsm.id
        LEFT JOIN packagings p ON rsm."packagingId" = p.id
        WHERE rhe.rice_stock_movement_id IN (${movePlaceholders}) 
          AND rhe.is_active = true
          AND (rhe.remarks IS NULL OR rhe.remarks NOT LIKE 'Other Hamali:%')
        ORDER BY rhe.rice_stock_movement_id, rhe.created_at DESC
      `, {
        replacements: moveReplacements
      });

      allEntries = allEntries.concat(moveEntries);
    }

    // Group entries like paddy hamali - each entry group represents a hamali work item
    const entryGroups = {};

    allEntries.forEach(entry => {
      // Create unique key for each hamali entry group 
      const entryKey = `${entry.rice_production_id || entry.rice_stock_movement_id}-${entry.work_type}-${entry.work_detail}-${entry.rate_18_21}-${Math.floor(new Date(entry.created_at).getTime() / 10000)}`;

      if (!entryGroups[entryKey]) {
        entryGroups[entryKey] = {
          workType: entry.work_type,
          workDetail: entry.work_detail,
          riceProductionId: entry.rice_production_id,
          riceStockMovementId: entry.rice_stock_movement_id,
          rate: entry.rate_18_21,
          totalBags: 0,
          totalAmount: 0,
          variety: entry.variety || entry.outturn_code || 'Unknown Variety',
          location: entry.location_code || entry.packaging_brand || 'Unknown Location',
          movementType: entry.movement_type || 'production',
          productType: entry.product_type || 'Rice',
          billNumber: entry.bill_number || '',
          lorryNumber: entry.lorry_number || '',
          splits: [],
          createdAt: entry.created_at
        };
      }

      // Add to totals
      entryGroups[entryKey].totalBags += entry.bags;
      entryGroups[entryKey].totalAmount += (entry.rate_18_21 || 0) * entry.bags;

      // Add split information
      entryGroups[entryKey].splits.push({
        workerName: entry.worker_name || entry.created_by_username || 'Main Entry',
        bags: entry.bags,
        amount: (entry.rate_18_21 || 0) * entry.bags
      });
    });

    const grandTotal = Object.values(entryGroups).reduce((sum, group) => sum + group.totalAmount, 0);

    res.json({
      success: true,
      summary: {
        riceHamaliEntries: entryGroups,
        grandTotal,
        totalEntries: Object.keys(entryGroups).length
      }
    });
  } catch (error) {
    console.error('Error fetching rice hamali summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rice hamali summary'
    });
  }
});

module.exports = router;
