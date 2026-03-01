const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const { sequelize } = require('../config/database');
const router = express.Router();

// Get all rice hamali rates with all rate columns
router.get('/', auth, async (req, res) => {
  try {
    const [rates] = await sequelize.query(`
      SELECT 
        id,
        work_type,
        work_detail,
        COALESCE(rate_24_27, 0) as rate_24_27,
        is_active,
        display_order
      FROM rice_hamali_rates 
      WHERE is_active = true
      ORDER BY display_order ASC, work_type ASC, work_detail ASC
    `);

    // Group by work_type for better organization
    const groupedRates = rates.reduce((acc, rate) => {
      if (!acc[rate.work_type]) {
        acc[rate.work_type] = [];
      }
      acc[rate.work_type].push(rate);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        rates: groupedRates,
        flatRates: rates
      }
    });
  } catch (error) {
    console.error('Error fetching rice hamali rates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rice hamali rates'
    });
  }
});

// Get rice hamali rates by work type with all rate columns
router.get('/work-type/:workType', auth, async (req, res) => {
  try {
    const { workType } = req.params;

    const [rates] = await sequelize.query(`
      SELECT 
        id,
        work_type,
        work_detail,
        COALESCE(rate_24_27, 0) as rate_24_27,
        is_active,
        display_order
      FROM rice_hamali_rates 
      WHERE work_type = :workType 
      AND is_active = true
      ORDER BY display_order ASC, work_detail ASC
    `, {
      replacements: { workType }
    });

    res.json({
      success: true,
      data: rates
    });
  } catch (error) {
    console.error('Error fetching rice hamali rates by work type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rice hamali rates'
    });
  }
});

// Add new rice hamali rate
router.post('/', auth, async (req, res) => {
  try {
    const {
      work_type,
      work_detail,
      rate_18_21,
      rate_21_24,
      rate_24_27,
      display_order
    } = req.body;

    const [result] = await sequelize.query(`
      INSERT INTO rice_hamali_rates 
      (work_type, work_detail, rate_18_21, rate_21_24, rate_24_27, display_order)
      VALUES (:work_type, :work_detail, :rate_18_21, :rate_21_24, :rate_24_27, :display_order)
      RETURNING *
    `, {
      replacements: {
        work_type,
        work_detail,
        rate_18_21: rate_18_21 || 0,
        rate_21_24: rate_21_24 || 0,
        rate_24_27: rate_24_27 || 0,
        display_order: display_order || 0
      }
    });

    res.json({
      success: true,
      message: 'Rice hamali rate added successfully',
      data: result[0]
    });
  } catch (error) {
    console.error('Error adding rice hamali rate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add rice hamali rate'
    });
  }
});

// Update rice hamali rate
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      work_type,
      work_detail,
      rate_18_21,
      rate_21_24,
      rate_24_27,
      display_order,
      is_active = true // Default to true if not provided
    } = req.body;

    console.log('Updating rice hamali rate:', { id, work_type, work_detail, rate_18_21, rate_21_24, rate_24_27, display_order, is_active });

    const [result] = await sequelize.query(`
      UPDATE rice_hamali_rates 
      SET 
        work_type = :work_type,
        work_detail = :work_detail,
        rate_18_21 = :rate_18_21,
        rate_21_24 = :rate_21_24,
        rate_24_27 = :rate_24_27,
        display_order = :display_order,
        is_active = :is_active,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = :id
      RETURNING *
    `, {
      replacements: {
        id,
        work_type,
        work_detail,
        rate_18_21,
        rate_21_24,
        rate_24_27,
        display_order,
        is_active
      }
    });

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rice hamali rate not found'
      });
    }

    res.json({
      success: true,
      message: 'Rice hamali rate updated successfully',
      data: result[0]
    });
  } catch (error) {
    console.error('Error updating rice hamali rate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update rice hamali rate'
    });
  }
});

// Delete rice hamali rate
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await sequelize.query(`
      UPDATE rice_hamali_rates 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = :id
      RETURNING *
    `, {
      replacements: { id }
    });

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rice hamali rate not found'
      });
    }

    res.json({
      success: true,
      message: 'Rice hamali rate deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting rice hamali rate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete rice hamali rate'
    });
  }
});

module.exports = router;