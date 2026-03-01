const express = require('express');
const { Op } = require('sequelize');
const { auth, authorize } = require('../middleware/auth');
const ByProduct = require('../models/ByProduct');
const Outturn = require('../models/Outturn');
const User = require('../models/User');
const YieldCalculationService = require('../services/YieldCalculationService');

const router = express.Router();

// Get by-products for an outturn
router.get('/outturn/:outturnId', auth, async (req, res) => {
  try {
    const { outturnId } = req.params;

    const byProducts = await ByProduct.findAll({
      where: { outturnId },
      include: [
        { model: Outturn, as: 'outturn' },
        { model: User, as: 'creator', attributes: ['username'] }
      ],
      order: [['date', 'DESC']]
    });

    res.json(byProducts);
  } catch (error) {
    console.error('Error fetching by-products:', error);
    res.status(500).json({ error: 'Failed to fetch by-products' });
  }
});

// Create or update by-product entry
router.post('/', auth, async (req, res) => {
  try {
    const {
      outturnId,
      date,
      rice,
      rejectionRice,
      rjRice1,
      rjRice2,
      broken,
      rejectionBroken,
      zeroBroken,
      faram,
      bran,
      unpolished
    } = req.body;

    if (!outturnId || !date) {
      return res.status(400).json({ error: 'Outturn and date are required' });
    }

    // Check if entry already exists for this outturn and date
    let byProduct = await ByProduct.findOne({
      where: { outturnId, date }
    });

    if (byProduct) {
      // Update existing - ADD to existing values (accumulate), don't replace
      const updateData = {};

      // Only update fields that have actual values provided - ADD to existing
      if (rice !== undefined && rice !== null && rice !== '') {
        updateData.rice = parseFloat(byProduct.rice || 0) + parseFloat(rice);
      }
      if (rejectionRice !== undefined && rejectionRice !== null && rejectionRice !== '') {
        updateData.rejectionRice = parseFloat(byProduct.rejectionRice || 0) + parseFloat(rejectionRice);
      }
      if (rjRice1 !== undefined && rjRice1 !== null && rjRice1 !== '') {
        updateData.rjRice1 = parseFloat(byProduct.rjRice1 || 0) + parseFloat(rjRice1);
      }
      if (rjRice2 !== undefined && rjRice2 !== null && rjRice2 !== '') {
        updateData.rjRice2 = parseFloat(byProduct.rjRice2 || 0) + parseFloat(rjRice2);
      }
      if (broken !== undefined && broken !== null && broken !== '') {
        updateData.broken = parseFloat(byProduct.broken || 0) + parseFloat(broken);
      }
      if (rejectionBroken !== undefined && rejectionBroken !== null && rejectionBroken !== '') {
        updateData.rejectionBroken = parseFloat(byProduct.rejectionBroken || 0) + parseFloat(rejectionBroken);
      }
      if (zeroBroken !== undefined && zeroBroken !== null && zeroBroken !== '') {
        updateData.zeroBroken = parseFloat(byProduct.zeroBroken || 0) + parseFloat(zeroBroken);
      }
      if (faram !== undefined && faram !== null && faram !== '') {
        updateData.faram = parseFloat(byProduct.faram || 0) + parseFloat(faram);
      }
      if (bran !== undefined && bran !== null && bran !== '') {
        updateData.bran = parseFloat(byProduct.bran || 0) + parseFloat(bran);
      }
      if (unpolished !== undefined && unpolished !== null && unpolished !== '') {
        updateData.unpolished = parseFloat(byProduct.unpolished || 0) + parseFloat(unpolished);
      }

      // Only update if there's something to update
      if (Object.keys(updateData).length > 0) {
        await byProduct.update(updateData);
      }
    } else {
      // Create new
      byProduct = await ByProduct.create({
        outturnId,
        date,
        rice: rice || 0,
        rejectionRice: rejectionRice || 0,
        rjRice1: rjRice1 || 0,
        rjRice2: rjRice2 || 0,
        broken: broken || 0,
        rejectionBroken: rejectionBroken || 0,
        zeroBroken: zeroBroken || 0,
        faram: faram || 0,
        bran: bran || 0,
        unpolished: unpolished || 0,
        createdBy: req.user.userId
      });
    }

    // Automatically recalculate yield percentage for this outturn
    await YieldCalculationService.calculateAndUpdateYield(outturnId);

    const created = await ByProduct.findByPk(byProduct.id, {
      include: [
        { model: Outturn, as: 'outturn' },
        { model: User, as: 'creator', attributes: ['username'] }
      ]
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating by-product:', error);
    res.status(500).json({ error: 'Failed to create by-product' });
  }
});

module.exports = router;
