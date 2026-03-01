const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const { sequelize } = require('../config/database');
const cacheService = require('../services/cacheService');
const router = express.Router();

// Get rice hamali entries by rice production IDs (batch) - CACHED VERSION
router.post('/batch', auth, async (req, res) => {
  try {
    const { riceProductionIds = [], stockMovementIds = [] } = req.body;

    if ((!riceProductionIds || riceProductionIds.length === 0) &&
      (!stockMovementIds || stockMovementIds.length === 0)) {
      return res.json({
        success: true,
        data: { entries: {} }
      });
    }

    // SAFE CACHING: Create cache key based on sorted IDs
    const sortedProdIds = [...riceProductionIds].sort((a, b) => a - b);
    const sortedMoveIds = [...stockMovementIds].sort((a, b) => a - b);
    const cacheKey = `rice-hamali-batch:${sortedProdIds.join(',')}:${sortedMoveIds.join(',')}`;

    // Try cache first (safe - won't crash on error)
    try {
      const cachedData = await cacheService.get(cacheKey);
      if (cachedData) {
        return res.json({
          success: true,
          data: cachedData,
          fromCache: true
        });
      }
    } catch (cacheError) {
      console.warn('Rice hamali batch cache read failed (safe):', cacheError.message);
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

    const groupedEntries = {};

    // Fetch entries for rice productions
    if (riceProductionIds.length > 0) {
      const prodPlaceholders = riceProductionIds.map((_, index) => `$${index + 1}`).join(',');

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
          u.username as created_by_username,
          u.username as worker_name,
          rp."productType" as product_type,
          rp.date as production_date,
          'production' as movement_type
        FROM rice_hamali_entries rhe
        LEFT JOIN rice_hamali_rates rhr ON rhe.rice_hamali_rate_id = rhr.id
        LEFT JOIN users u ON rhe.created_by = u.id
        LEFT JOIN rice_productions rp ON rhe.rice_production_id = rp.id
        WHERE rhe.rice_production_id IN (${prodPlaceholders}) AND rhe.is_active = true
        ORDER BY rhe.rice_production_id, rhe.created_at DESC
      `, {
        bind: riceProductionIds
      });

      // Group by rice production ID
      prodEntries.forEach(entry => {
        const key = entry.rice_production_id;
        if (!groupedEntries[key]) {
          groupedEntries[key] = [];
        }
        groupedEntries[key].push(entry);
      });
    }

    // Fetch entries for stock movements
    if (stockMovementIds.length > 0) {
      const movePlaceholders = stockMovementIds.map((_, index) => `$${index + 1}`).join(',');

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
          u.username as created_by_username,
          u.username as worker_name,
          rsm.movement_type as movement_type,
          rsm.variety as variety,
          rsm.location_code as location_code,
          rsm.date as movement_date,
          rsm.product_type as product_type
        FROM rice_hamali_entries rhe
        LEFT JOIN rice_hamali_rates rhr ON rhe.rice_hamali_rate_id = rhr.id
        LEFT JOIN users u ON rhe.created_by = u.id
        LEFT JOIN rice_stock_movements rsm ON rhe.rice_stock_movement_id = rsm.id
        WHERE rhe.rice_stock_movement_id IN (${movePlaceholders}) AND rhe.is_active = true
        ORDER BY rhe.rice_stock_movement_id, rhe.created_at DESC
      `, {
        bind: stockMovementIds
      });

      // Group by stock movement ID with "movement-" prefix
      moveEntries.forEach(entry => {
        const key = `movement-${entry.rice_stock_movement_id}`;
        if (!groupedEntries[key]) {
          groupedEntries[key] = [];
        }
        groupedEntries[key].push(entry);
      });
    }

    const responseData = { entries: groupedEntries };

    // SAFE CACHE SET (won't crash on error)
    try {
      await cacheService.set(cacheKey, responseData, 30); // 30 second cache
    } catch (cacheError) {
      console.warn('Rice hamali batch cache write failed (safe):', cacheError.message);
    }

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error fetching rice hamali entries batch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rice hamali entries',
      details: error.message
    });
  }
});

// Bulk create rice hamali entries - SIMPLIFIED VERSION
router.post('/bulk', auth, async (req, res) => {
  try {
    const { riceProductionId, stockMovementId, movementType, isStockMovement, entries } = req.body;

    // Validate required fields
    if ((!riceProductionId && !stockMovementId) || !entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Rice production ID or stock movement ID and entries array are required'
      });
    }

    let totalBags = 0;
    let referenceId = null;

    if (isStockMovement && stockMovementId) {
      // Handle stock movement (Purchase/Sale/Palti)
      const [stockMovement] = await sequelize.query(`
        SELECT id, bags as total_bags FROM rice_stock_movements WHERE id = $1
      `, {
        bind: [stockMovementId]
      });

      if (stockMovement.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Stock movement not found'
        });
      }

      totalBags = stockMovement[0].total_bags;
      referenceId = stockMovementId;

      console.log('✅ Processing hamali for stock movement:', { stockMovementId, movementType, totalBags });
    } else {
      // Handle regular rice production
      const [riceProduction] = await sequelize.query(`
        SELECT id, bags as total_bags FROM rice_productions WHERE id = $1
      `, {
        bind: [riceProductionId]
      });

      if (riceProduction.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Rice production not found'
        });
      }

      totalBags = riceProduction[0].total_bags;
      referenceId = riceProductionId;

      console.log('✅ Processing hamali for rice production:', { riceProductionId, totalBags });
    }

    const transaction = await sequelize.transaction();

    try {
      const createdEntries = [];

      for (const entry of entries) {
        const { workType, workDetail, rate, bags, workerName, batchNumber } = entry;

        // Validate entry fields
        if (!workType || !workDetail || !rate || !bags) {
          throw new Error('Each entry must have workType, workDetail, rate, and bags');
        }

        // Find the rice hamali rate ID based on work type and detail
        const [rateResult] = await sequelize.query(`
          SELECT id, rate_24_27 FROM rice_hamali_rates 
          WHERE work_type = $1 AND work_detail = $2 AND is_active = true
          LIMIT 1
        `, {
          bind: [workType, workDetail],
          transaction
        });

        if (rateResult.length === 0) {
          throw new Error(`Rice hamali rate not found for ${workType} - ${workDetail}`);
        }

        const riceHamaliRateId = rateResult[0].id;
        const actualRate = rateResult[0].rate_24_27;

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
            created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10)
          RETURNING *
        `, {
          bind: [
            isStockMovement ? null : riceProductionId,
            isStockMovement ? stockMovementId : null,
            isStockMovement ? movementType : 'production',
            riceHamaliRateId,
            bags,
            actualRate,
            bags * actualRate,
            `${workerName ? `Worker: ${workerName}, ` : ''}${batchNumber ? `Batch: ${batchNumber}, ` : ''}${movementType ? `Type: ${movementType}, ` : ''}Rate: ₹${rate}`,
            req.user.role === 'staff' ? 'pending' : 'approved',
            req.user.userId
          ],
          transaction
        });

        createdEntries.push(result[0]);
      }

      await transaction.commit();

      res.json({
        success: true,
        message: `${createdEntries.length} rice hamali entries created successfully`,
        data: { entries: createdEntries }
      });

    } catch (error) {
      await transaction.rollback();
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

module.exports = router;