/**
 * PhysicalInspection Model
 * 
 * Stores physical inspection data by Physical Supervisors.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PhysicalInspection = sequelize.define('PhysicalInspection', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sampleEntryId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'sample_entry_id',
    references: {
      model: 'sample_entries',
      key: 'id'
    }
  },
  lotAllotmentId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'lot_allotment_id',
    references: {
      model: 'lot_allotments',
      key: 'id'
    }
  },
  reportedByUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'reported_by_user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  inspectionDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'inspection_date'
  },
  bags: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  lorryNumber: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'lorry_number'
  },
  cutting1: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    field: 'cutting1'
  },
  cutting2: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    field: 'cutting2'
  },
  bend: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false
  },
  bend2: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    field: 'bend2'
  },
  halfLorryImageUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'half_lorry_image_url'
  },
  fullLorryImageUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'full_lorry_image_url'
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isComplete: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_complete'
  }
}, {
  tableName: 'physical_inspections',
  underscored: true,
  indexes: [
    { fields: ['sample_entry_id'] },
    { fields: ['lot_allotment_id'] },
    { fields: ['reported_by_user_id'] },
    { fields: ['inspection_date'] },
    { fields: ['lorry_number'] },
    { fields: ['sample_entry_id', 'is_complete'] }
  ]
});

PhysicalInspection.associate = (models) => {
  PhysicalInspection.belongsTo(models.SampleEntry, {
    foreignKey: 'sampleEntryId',
    as: 'sampleEntry'
  });

  PhysicalInspection.belongsTo(models.LotAllotment, {
    foreignKey: 'lotAllotmentId',
    as: 'lotAllotment'
  });

  PhysicalInspection.belongsTo(models.User, {
    foreignKey: 'reportedByUserId',
    as: 'reportedBy'
  });

  PhysicalInspection.hasOne(models.InventoryData, {
    foreignKey: 'physicalInspectionId',
    as: 'inventoryData'
  });
};

module.exports = PhysicalInspection;
