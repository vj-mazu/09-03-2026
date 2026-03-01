const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const { Warehouse, Kunchinittu, Variety } = require('../models/Location');
const RiceStockLocation = require('../models/RiceStockLocation');
const RiceVariety = require('../models/RiceVariety');
const Broker = require('../models/Broker');
const User = require('../models/User');

const router = express.Router();

// In-memory cache for location data (changes rarely, queried constantly)
const locationCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const entry = locationCache.get(key);
  if (entry && Date.now() - entry.time < CACHE_TTL) return entry.data;
  locationCache.delete(key);
  return null;
}

function setCache(key, data) {
  locationCache.set(key, { data, time: Date.now() });
}

function invalidateCache(prefix) {
  for (const key of locationCache.keys()) {
    if (key.startsWith(prefix)) locationCache.delete(key);
  }
}

// ===== WAREHOUSES =====

// Get all warehouses
router.get('/warehouses', auth, async (req, res) => {
  try {
    const cached = getCached('warehouses');
    if (cached) { res.set('Cache-Control', 'public, max-age=300'); return res.json(cached); }

    const warehouses = await Warehouse.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'code', 'location'],
      order: [['name', 'ASC']],
      include: [{
        model: Kunchinittu,
        as: 'kunchinittus',
        attributes: ['id', 'name', 'code'],
        required: false
      }],
      raw: false,
      nest: true
    });

    const result = { warehouses };
    setCache('warehouses', result);
    res.set('Cache-Control', 'public, max-age=300');
    res.json(result);
  } catch (error) {
    console.error('Get warehouses error:', error);
    res.status(500).json({ error: 'Failed to fetch warehouses' });
  }
});

// Create warehouse (Manager/Admin only)
router.post('/warehouses', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { name, code, location, capacity } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    // Check for duplicate
    const existing = await Warehouse.findOne({
      where: { code }
    });

    if (existing) {
      return res.status(400).json({ error: 'Warehouse code already exists' });
    }

    invalidateCache('warehouses');
    const warehouse = await Warehouse.create({
      name,
      code,
      location,
      capacity
    });

    res.status(201).json({
      message: 'Warehouse created successfully',
      warehouse
    });
  } catch (error) {
    console.error('Create warehouse error:', error);
    res.status(500).json({ error: 'Failed to create warehouse' });
  }
});

// Update warehouse (Manager/Admin only)
router.put('/warehouses/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const warehouse = await Warehouse.findByPk(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    const { name, code, location, capacity } = req.body;

    // Check for duplicate code (excluding current warehouse)
    if (code && code !== warehouse.code) {
      const existing = await Warehouse.findOne({
        where: { code, id: { [require('sequelize').Op.ne]: req.params.id } }
      });
      if (existing) {
        return res.status(400).json({ error: 'Warehouse code already exists' });
      }
    }

    invalidateCache('warehouses');
    await warehouse.update({ name, code, location, capacity });

    res.json({
      message: 'Warehouse updated successfully',
      warehouse
    });
  } catch (error) {
    console.error('Update warehouse error:', error);
    res.status(500).json({ error: 'Failed to update warehouse' });
  }
});

// Delete warehouse (Manager/Admin only)
router.delete('/warehouses/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const warehouse = await Warehouse.findByPk(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    // Soft delete - mark as inactive instead of deleting
    invalidateCache('warehouses');
    await warehouse.update({ isActive: false });

    res.json({ message: 'Warehouse deleted successfully' });
  } catch (error) {
    console.error('Delete warehouse error:', error);
    res.status(500).json({ error: 'Failed to delete warehouse' });
  }
});

// ===== KUNCHINITTUS =====

// Get all kunchinittus (for dropdowns - excludes closed by default)
router.get('/kunchinittus', auth, async (req, res) => {
  try {
    const { includeClosed } = req.query;
    const cacheKey = `kunchinittus_${includeClosed || 'false'}`;
    const cached = getCached(cacheKey);
    if (cached) { res.set('Cache-Control', 'public, max-age=300'); return res.json(cached); }

    const where = { isActive: true };
    if (includeClosed !== 'true') {
      where.isClosed = false;
    }

    const kunchinittus = await Kunchinittu.findAll({
      where,
      attributes: ['id', 'name', 'code', 'warehouseId', 'varietyId', 'isClosed'],
      order: [['name', 'ASC']],
      include: [
        { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'code'], required: false },
        { model: Variety, as: 'variety', attributes: ['id', 'name', 'code'], required: false }
      ],
      raw: false,
      nest: true
    });

    const result = { kunchinittus };
    setCache(cacheKey, result);
    res.set('Cache-Control', 'public, max-age=300');
    res.json(result);
  } catch (error) {
    console.error('Get kunchinittus error:', error);
    res.status(500).json({ error: 'Failed to fetch kunchinittus' });
  }
});

// Create kunchinittu (Manager/Admin only)
router.post('/kunchinittus', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { name, code, warehouseId, varietyId, capacity } = req.body;

    if (!name || !code || !warehouseId) {
      return res.status(400).json({ error: 'Name, code, and warehouseId are required' });
    }

    // Check if warehouse exists
    const warehouse = await Warehouse.findByPk(warehouseId);
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    // Check for duplicate name (must be unique globally)
    const existingName = await Kunchinittu.findOne({
      where: { name }
    });

    if (existingName) {
      return res.status(400).json({
        error: `Kunchinittu name '${name}' already exists. Please use a unique name.`
      });
    }

    // Check for duplicate code (can be same across warehouses, but not within same warehouse)
    const existingCode = await Kunchinittu.findOne({
      where: {
        code,
        warehouseId
      }
    });

    if (existingCode) {
      return res.status(400).json({
        error: `Kunchinittu code '${code}' already exists in this warehouse. You can use the same code in different warehouses.`
      });
    }

    invalidateCache('kunchinittus');
    invalidateCache('warehouses');
    const kunchinittu = await Kunchinittu.create({
      name,
      code,
      warehouseId,
      varietyId: varietyId || null,
      capacity
    });

    // Fetch with warehouse and variety data
    const createdKunchinittu = await Kunchinittu.findByPk(kunchinittu.id, {
      include: [
        { model: Warehouse, as: 'warehouse' },
        { model: Variety, as: 'variety' }
      ]
    });

    res.status(201).json({
      message: 'Kunchinittu created successfully',
      kunchinittu: createdKunchinittu
    });
  } catch (error) {
    console.error('Create kunchinittu error:', error);
    res.status(500).json({ error: 'Failed to create kunchinittu' });
  }
});

// Update kunchinittu (Manager/Admin only)
router.put('/kunchinittus/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const kunchinittu = await Kunchinittu.findByPk(req.params.id);
    if (!kunchinittu) {
      return res.status(404).json({ error: 'Kunchinittu not found' });
    }

    const { name, code, warehouseId, varietyId, capacity } = req.body;

    const { Op } = require('sequelize');

    // Check for duplicate name (excluding current kunchinittu)
    if (name && name !== kunchinittu.name) {
      const existingName = await Kunchinittu.findOne({
        where: {
          name,
          id: { [Op.ne]: req.params.id }
        }
      });
      if (existingName) {
        return res.status(400).json({
          error: `Kunchinittu name '${name}' already exists. Please use a unique name.`
        });
      }
    }

    // Check for duplicate code in the same warehouse (excluding current kunchinittu)
    if ((code && code !== kunchinittu.code) || (warehouseId && warehouseId !== kunchinittu.warehouseId)) {
      const existingCode = await Kunchinittu.findOne({
        where: {
          code: code || kunchinittu.code,
          warehouseId: warehouseId || kunchinittu.warehouseId,
          id: { [Op.ne]: req.params.id }
        }
      });
      if (existingCode) {
        return res.status(400).json({
          error: `Kunchinittu code '${code || kunchinittu.code}' already exists in this warehouse. You can use the same code in different warehouses.`
        });
      }
    }

    invalidateCache('kunchinittus');
    invalidateCache('warehouses');
    await kunchinittu.update({ name, code, warehouseId, varietyId, capacity });

    const updatedKunchinittu = await Kunchinittu.findByPk(kunchinittu.id, {
      include: [
        { model: Warehouse, as: 'warehouse' },
        { model: Variety, as: 'variety' }
      ]
    });

    res.json({
      message: 'Kunchinittu updated successfully',
      kunchinittu: updatedKunchinittu
    });
  } catch (error) {
    console.error('Update kunchinittu error:', error);
    res.status(500).json({ error: 'Failed to update kunchinittu' });
  }
});

// Delete kunchinittu (Manager/Admin only)
router.delete('/kunchinittus/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const kunchinittu = await Kunchinittu.findByPk(req.params.id);
    if (!kunchinittu) {
      return res.status(404).json({ error: 'Kunchinittu not found' });
    }

    // Soft delete
    invalidateCache('kunchinittus');
    invalidateCache('warehouses');
    await kunchinittu.update({ isActive: false });

    res.json({ message: 'Kunchinittu deleted successfully' });
  } catch (error) {
    console.error('Delete kunchinittu error:', error);
    res.status(500).json({ error: 'Failed to delete kunchinittu' });
  }
});

// ===== VARIETIES =====

// Get all varieties
router.get('/varieties', auth, async (req, res) => {
  try {
    const cached = getCached('varieties');
    if (cached) { res.set('Cache-Control', 'public, max-age=600'); return res.json(cached); }

    const varieties = await Variety.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'code'],
      order: [['name', 'ASC']],
      raw: true
    });

    const result = { varieties };
    setCache('varieties', result);
    res.set('Cache-Control', 'public, max-age=600');
    res.json(result);
  } catch (error) {
    console.error('Get varieties error:', error);
    res.status(500).json({ error: 'Failed to fetch varieties' });
  }
});

// Create variety (Manager/Admin only)
router.post('/varieties', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { name, code, description } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    const { Op } = require('sequelize');

    // Check for duplicate name or code
    const existing = await Variety.findOne({
      where: {
        [Op.or]: [
          { code: code.trim().toUpperCase() },
          { name: name.trim().toUpperCase() }
        ]
      }
    });

    if (existing) {
      if (existing.name === name.trim().toUpperCase()) {
        return res.status(400).json({ error: `Variety name '${name}' already exists` });
      }
      return res.status(400).json({ error: `Variety code '${code}' already exists` });
    }

    invalidateCache('varieties');
    const variety = await Variety.create({
      name: name.trim().toUpperCase(),
      code: code.trim().toUpperCase(),
      description
    });

    res.status(201).json({
      message: 'Variety created successfully',
      variety
    });
  } catch (error) {
    console.error('Create variety error:', error);
    res.status(500).json({ error: 'Failed to create variety' });
  }
});

// Update variety (Manager/Admin only)
router.put('/varieties/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const variety = await Variety.findByPk(req.params.id);
    if (!variety) {
      return res.status(404).json({ error: 'Variety not found' });
    }

    const { name, code, description } = req.body;
    const oldName = variety.name; // Store old name for cascade update

    // Check for duplicate code (excluding current variety)
    if (code && code !== variety.code) {
      const { Op } = require('sequelize');
      const existing = await Variety.findOne({
        where: { code, id: { [Op.ne]: req.params.id } }
      });
      if (existing) {
        return res.status(400).json({ error: 'Variety code already exists' });
      }
    }

    invalidateCache('varieties');
    await variety.update({ name, code, description });

    // CASCADE UPDATE: If variety name changed, update all Arrivals with the old variety name
    if (name && name.trim().toUpperCase() !== oldName.trim().toUpperCase()) {
      const Arrival = require('../models/Arrival');
      const updatedCount = await Arrival.update(
        { variety: name.trim().toUpperCase() },
        {
          where: {
            variety: oldName.trim().toUpperCase()
          }
        }
      );
      console.log(`✅ Cascade update: Updated ${updatedCount[0]} arrivals from variety "${oldName}" to "${name}"`);
    }

    res.json({
      message: 'Variety updated successfully',
      variety
    });
  } catch (error) {
    console.error('Update variety error:', error);
    res.status(500).json({ error: 'Failed to update variety' });
  }
});

// Delete variety (Manager/Admin only)
router.delete('/varieties/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const variety = await Variety.findByPk(req.params.id);
    if (!variety) {
      return res.status(404).json({ error: 'Variety not found' });
    }

    // Soft delete
    invalidateCache('varieties');
    await variety.update({ isActive: false });

    res.json({ message: 'Variety deleted successfully' });
  } catch (error) {
    console.error('Delete variety error:', error);
    res.status(500).json({ error: 'Failed to delete variety' });
  }
});

// ===== RICE STOCK LOCATIONS =====

// Get all rice stock locations
router.get('/rice-stock-locations', auth, async (req, res) => {
  try {
    const { includeInactive } = req.query;

    const where = {};
    if (!includeInactive) {
      where.isActive = true;
    }

    // Fetch locations without User association to avoid circular dependency issues
    const locations = await RiceStockLocation.findAll({
      where,
      attributes: ['id', 'code', 'name', 'isActive', 'is_direct_load', 'createdAt', 'createdBy'],
      order: [['code', 'ASC']],
      raw: true
    });



    // Manually fetch creator usernames if needed
    if (locations.length > 0) {
      const creatorIds = [...new Set(locations.map(l => l.createdBy))];
      const creators = await User.findAll({
        where: { id: creatorIds },
        attributes: ['id', 'username'],
        raw: true
      });

      const creatorMap = {};
      creators.forEach(c => {
        creatorMap[c.id] = c.username;
      });

      // Add creator username to each location
      locations.forEach(loc => {
        loc.creator = { username: creatorMap[loc.createdBy] || 'Unknown' };
      });
    }

    // Cache headers for 5 minutes
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ locations });
  } catch (error) {
    console.error('❌ Get rice stock locations error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch rice stock locations' });
  }
});

// Create rice stock location (Manager/Admin only)
router.post('/rice-stock-locations', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    console.log('📍 Creating rice stock location...');
    console.log('Request body:', req.body);
    console.log('User:', req.user);

    const { code, name } = req.body;

    if (!code) {
      console.log('❌ No code provided');
      return res.status(400).json({ error: 'Location code is required' });
    }

    // Check if code already exists
    const existing = await RiceStockLocation.findOne({
      where: { code: code.trim().toUpperCase() }
    });

    if (existing) {
      console.log('❌ Code already exists:', code);
      return res.status(400).json({ error: 'Location code already exists' });
    }

    console.log('Creating location with:', {
      code: code.trim().toUpperCase(),
      name: name ? name.trim() : null,
      createdBy: req.user.userId
    });

    const location = await RiceStockLocation.create({
      code: code.trim().toUpperCase(),
      name: name ? name.trim() : null,
      createdBy: req.user.userId
    });

    console.log('✅ Location created:', location.id);

    const created = await RiceStockLocation.findByPk(location.id, {
      attributes: ['id', 'code', 'name', 'isActive', 'createdAt', 'createdBy'],
      raw: true
    });

    // Manually add creator username
    const creator = await User.findByPk(req.user.userId, {
      attributes: ['username'],
      raw: true
    });

    created.creator = { username: creator ? creator.username : 'Unknown' };

    console.log('✅ Returning location:', created);

    res.status(201).json({
      message: 'Rice stock location created successfully',
      location: created
    });
  } catch (error) {
    console.error('❌ Create rice stock location error:', error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Failed to create rice stock location' });
  }
});

// Update rice stock location (Manager/Admin only)
router.put('/rice-stock-locations/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { code, name, isActive } = req.body;

    const location = await RiceStockLocation.findByPk(req.params.id);
    if (!location) {
      return res.status(404).json({ error: 'Rice stock location not found' });
    }

    // Check if new code already exists (if code is being changed)
    if (code && code.trim().toUpperCase() !== location.code) {
      const { Op } = require('sequelize');
      const existing = await RiceStockLocation.findOne({
        where: {
          code: code.trim().toUpperCase(),
          id: { [Op.ne]: req.params.id }
        }
      });

      if (existing) {
        return res.status(400).json({ error: 'Location code already exists' });
      }
    }

    await location.update({
      code: code ? code.trim().toUpperCase() : location.code,
      name: name !== undefined ? (name ? name.trim() : null) : location.name,
      isActive: isActive !== undefined ? isActive : location.isActive
    });

    const updated = await RiceStockLocation.findByPk(location.id, {
      include: [
        { model: User, as: 'creator', attributes: ['username'] }
      ]
    });

    res.json({
      message: 'Rice stock location updated successfully',
      location: updated
    });
  } catch (error) {
    console.error('Update rice stock location error:', error);
    res.status(500).json({ error: 'Failed to update rice stock location' });
  }
});

// Delete rice stock location (Admin only)
router.delete('/rice-stock-locations/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const location = await RiceStockLocation.findByPk(req.params.id);
    if (!location) {
      return res.status(404).json({ error: 'Rice stock location not found' });
    }

    // Soft delete
    await location.update({ isActive: false });

    res.json({ message: 'Rice stock location deleted successfully' });
  } catch (error) {
    console.error('Delete rice stock location error:', error);
    res.status(500).json({ error: 'Failed to delete rice stock location' });
  }
});

// ===== RICE VARIETIES =====

// Get all rice varieties
router.get('/rice-varieties', auth, async (req, res) => {
  try {
    const cached = getCached('rice-varieties');
    if (cached) { res.set('Cache-Control', 'public, max-age=300'); return res.json(cached); }

    const varieties = await RiceVariety.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'code'],
      order: [['name', 'ASC']],
      raw: true
    });

    const result = { varieties };
    setCache('rice-varieties', result);
    res.set('Cache-Control', 'public, max-age=300');
    res.json(result);
  } catch (error) {
    console.error('Get rice varieties error:', error);
    res.status(500).json({ error: 'Failed to fetch rice varieties' });
  }
});

// Create rice variety (Manager/Admin only)
router.post('/rice-varieties', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { name, code } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    // Check for duplicate
    const existing = await RiceVariety.findOne({
      where: { code: code.trim().toUpperCase() }
    });

    if (existing) {
      return res.status(400).json({ error: 'Rice variety code already exists' });
    }

    const variety = await RiceVariety.create({
      name: name.trim().toUpperCase(),
      code: code.trim().toUpperCase()
    });

    res.status(201).json({
      message: 'Rice variety created successfully',
      variety
    });
  } catch (error) {
    console.error('Create rice variety error:', error);
    res.status(500).json({ error: 'Failed to create rice variety' });
  }
});

// Update rice variety (Manager/Admin only)
router.put('/rice-varieties/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const variety = await RiceVariety.findByPk(req.params.id);
    if (!variety) {
      return res.status(404).json({ error: 'Rice variety not found' });
    }

    const { name, code, isActive } = req.body;

    // Check for duplicate code if changed
    if (code && code.trim().toUpperCase() !== variety.code) {
      const { Op } = require('sequelize');
      const existing = await RiceVariety.findOne({
        where: {
          code: code.trim().toUpperCase(),
          id: { [Op.ne]: req.params.id }
        }
      });
      if (existing) {
        return res.status(400).json({ error: 'Rice variety code already exists' });
      }
    }

    await variety.update({
      name: name ? name.trim().toUpperCase() : variety.name,
      code: code ? code.trim().toUpperCase() : variety.code,
      isActive: isActive !== undefined ? isActive : variety.isActive
    });

    res.json({
      message: 'Rice variety updated successfully',
      variety
    });
  } catch (error) {
    console.error('Update rice variety error:', error);
    res.status(500).json({ error: 'Failed to update rice variety' });
  }
});

// Delete rice variety (Admin only)
router.delete('/rice-varieties/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const variety = await RiceVariety.findByPk(req.params.id);
    if (!variety) {
      return res.status(404).json({ error: 'Rice variety not found' });
    }

    // Soft delete
    await variety.update({ isActive: false });

    res.json({ message: 'Rice variety deleted successfully' });
  } catch (error) {
    console.error('Delete rice variety error:', error);
    res.status(500).json({ error: 'Failed to delete rice variety' });
  }
});

// ===== BROKERS =====

// Get all brokers
router.get('/brokers', auth, async (req, res) => {
  try {
    const brokers = await Broker.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'description'],
      order: [['name', 'ASC']],
      raw: true
    });

    res.set('Cache-Control', 'public, max-age=300');
    res.json({ brokers });
  } catch (error) {
    console.error('Get brokers error:', error);
    res.status(500).json({ error: 'Failed to fetch brokers' });
  }
});

// Create broker (Manager/Admin only)
router.post('/brokers', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Broker name is required' });
    }

    // Check for duplicate name
    const existingName = await Broker.findOne({
      where: { name: name.trim().toUpperCase() }
    });

    if (existingName) {
      return res.status(400).json({ error: 'Broker name already exists' });
    }

    const broker = await Broker.create({
      name: name.trim().toUpperCase(),
      description: description ? description.trim() : null
    });

    res.status(201).json({
      message: 'Broker created successfully',
      broker
    });
  } catch (error) {
    console.error('Create broker error:', error);
    res.status(500).json({ error: 'Failed to create broker' });
  }
});

// Update broker (Manager/Admin only)
router.put('/brokers/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const broker = await Broker.findByPk(req.params.id);
    if (!broker) {
      return res.status(404).json({ error: 'Broker not found' });
    }

    const { name, description, isActive } = req.body;
    const { Op } = require('sequelize');

    // Check for duplicate name (excluding current broker)
    if (name && name.trim().toUpperCase() !== broker.name) {
      const existingName = await Broker.findOne({
        where: {
          name: name.trim().toUpperCase(),
          id: { [Op.ne]: req.params.id }
        }
      });
      if (existingName) {
        return res.status(400).json({ error: 'Broker name already exists' });
      }
    }

    await broker.update({
      name: name ? name.trim().toUpperCase() : broker.name,
      description: description !== undefined ? (description ? description.trim() : null) : broker.description,
      isActive: isActive !== undefined ? isActive : broker.isActive
    });

    res.json({
      message: 'Broker updated successfully',
      broker
    });
  } catch (error) {
    console.error('Update broker error:', error);
    res.status(500).json({ error: 'Failed to update broker' });
  }
});

// Delete broker (Admin only)
router.delete('/brokers/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const broker = await Broker.findByPk(req.params.id);
    if (!broker) {
      return res.status(404).json({ error: 'Broker not found' });
    }

    // Soft delete
    await broker.update({ isActive: false });

    res.json({ message: 'Broker deleted successfully' });
  } catch (error) {
    console.error('Delete broker error:', error);
    res.status(500).json({ error: 'Failed to delete broker' });
  }
});

module.exports = router;