const express = require('express');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Get unified rice varieties for dropdown (from both outturns and rice_stock_movements)
router.get('/unified-varieties', auth, async (req, res) => {
    try {
        // Get varieties from outturns (production source)
        const [outturnVarieties] = await sequelize.query(`
            SELECT DISTINCT 
                TRIM(UPPER(CONCAT(allottedVariety, ' ', type))) as variety,
                'outturn' as source
            FROM outturns 
            WHERE allottedVariety IS NOT NULL 
            AND allottedVariety != ''
            ORDER BY variety
        `);

        // Get varieties from rice_stock_movements (purchase/sale/palti source)
        const [movementVarieties] = await sequelize.query(`
            SELECT DISTINCT 
                TRIM(UPPER(variety)) as variety,
                'movement' as source
            FROM rice_stock_movements 
            WHERE variety IS NOT NULL 
            AND variety != ''
            AND status = 'approved'
            ORDER BY variety
        `);

        // Combine and deduplicate
        const allVarieties = [...outturnVarieties, ...movementVarieties];
        const uniqueVarieties = [...new Map(allVarieties.map(v => [v.variety, v])).values()];

        // Sort alphabetically
        uniqueVarieties.sort((a, b) => a.variety.localeCompare(b.variety));

        res.json({ varieties: uniqueVarieties });
    } catch (error) {
        console.error('Error fetching unified varieties:', error);
        res.status(500).json({ error: 'Failed to fetch varieties' });
    }
});

module.exports = router;