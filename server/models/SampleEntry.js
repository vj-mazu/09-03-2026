/**
 * SampleEntry Model
 * 
 * Represents initial sample entries created by Staff users.
 * Tracks workflow status through the entire sample-to-purchase lifecycle.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SampleEntry = sequelize.define('SampleEntry', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  createdByUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'created_by_user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  entryDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'entry_date'
  },
  brokerName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'broker_name'
  },
  variety: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  partyName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'party_name'
  },
  location: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  sampleCollected: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'sample_collected'
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
    allowNull: true,
    field: 'lorry_number'
  },
  entryType: {
    type: DataTypes.ENUM('CREATE_NEW', 'DIRECT_LOADED_VEHICLE', 'NEW_PADDY_SAMPLE', 'READY_LORRY', 'LOCATION_SAMPLE', 'RICE_SAMPLE'),
    allowNull: false,
    field: 'entry_type'
  },
  packaging: {
    type: DataTypes.STRING(10),
    allowNull: true,
    defaultValue: '75'
  },
  sampleCollectedBy: {
    type: DataTypes.STRING(200),
    allowNull: true,
    field: 'sample_collected_by'
  },
  sampleGivenToOffice: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
    field: 'sample_given_to_office'
  },
  workflowStatus: {
    type: DataTypes.ENUM(
      'STAFF_ENTRY',
      'QUALITY_CHECK',
      'LOT_SELECTION',
      'COOKING_REPORT',
      'FINAL_REPORT',
      'LOT_ALLOTMENT',
      'PHYSICAL_INSPECTION',
      'INVENTORY_ENTRY',
      'OWNER_FINANCIAL',
      'MANAGER_FINANCIAL',
      'FINAL_REVIEW',
      'COMPLETED',
      'FAILED'
    ),
    allowNull: false,
    defaultValue: 'STAFF_ENTRY',
    field: 'workflow_status'
  },
  offeringPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'offering_price'
  },
  priceType: {
    type: DataTypes.ENUM('BAGS', 'LOOSE'),
    allowNull: true,
    field: 'price_type'
  },
  offeringRemarks: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'offering_remarks'
  },
  finalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'final_price'
  },
  lotSelectionDecision: {
    type: DataTypes.ENUM('PASS_WITHOUT_COOKING', 'PASS_WITH_COOKING', 'FAIL', 'SOLDOUT'),
    allowNull: true,
    field: 'lot_selection_decision'
  },
  lotSelectionByUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'lot_selection_by_user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  lotSelectionAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'lot_selection_at'
  },
  serialNo: {
    type: DataTypes.INTEGER,
    allowNull: false,
    autoIncrement: true,
    field: 'serial_no'
  }
}, {
  tableName: 'sample_entries',
  underscored: true,
  indexes: [
    { fields: ['workflow_status'] },
    { fields: ['created_by_user_id'] },
    { fields: ['entry_date'] },
    { fields: ['broker_name'] },
    { fields: ['variety'] },
    { fields: ['lot_selection_decision'] },
    { fields: ['workflow_status', 'entry_date'] }
  ]
});

// Associations
SampleEntry.associate = (models) => {
  SampleEntry.belongsTo(models.User, {
    foreignKey: 'createdByUserId',
    as: 'creator'
  });

  SampleEntry.belongsTo(models.User, {
    foreignKey: 'lotSelectionByUserId',
    as: 'lotSelectionByUser'
  });

  SampleEntry.hasOne(models.QualityParameters, {
    foreignKey: 'sampleEntryId',
    as: 'qualityParameters'
  });

  SampleEntry.hasOne(models.CookingReport, {
    foreignKey: 'sampleEntryId',
    as: 'cookingReport'
  });

  SampleEntry.hasOne(models.LotAllotment, {
    foreignKey: 'sampleEntryId',
    as: 'lotAllotment'
  });

  SampleEntry.hasOne(models.SampleEntryOffering, {
    foreignKey: 'sampleEntryId',
    as: 'offering'
  });
};

// Instance methods
SampleEntry.prototype.canTransitionTo = function (newStatus, userRole) {
  // Workflow transition validation logic
  const transitions = {
    'STAFF_ENTRY': {
      'QUALITY_CHECK': ['quality_supervisor']
    },
    'QUALITY_CHECK': {
      'LOT_SELECTION': ['admin', 'manager']
    },
    'LOT_SELECTION': {
      'COOKING_REPORT': ['admin', 'manager'],
      'FINAL_REPORT': ['admin', 'manager'],
      'FAILED': ['admin', 'manager']
    },
    'COOKING_REPORT': {
      'FINAL_REPORT': ['admin', 'manager'],
      'FAILED': ['admin', 'manager']
    },
    'FINAL_REPORT': {
      'LOT_ALLOTMENT': ['manager']
    },
    'LOT_ALLOTMENT': {
      'PHYSICAL_INSPECTION': ['physical_supervisor']
    },
    'PHYSICAL_INSPECTION': {
      'INVENTORY_ENTRY': ['inventory_staff']
    },
    'INVENTORY_ENTRY': {
      'OWNER_FINANCIAL': ['admin', 'manager']
    },
    'OWNER_FINANCIAL': {
      'MANAGER_FINANCIAL': ['manager']
    },
    'MANAGER_FINANCIAL': {
      'FINAL_REVIEW': ['admin', 'manager']
    },
    'FINAL_REVIEW': {
      'COMPLETED': ['admin', 'manager']
    }
  };

  const allowedTransitions = transitions[this.workflowStatus];
  if (!allowedTransitions || !allowedTransitions[newStatus]) {
    return false;
  }

  return allowedTransitions[newStatus].includes(userRole);
};

module.exports = SampleEntry;
