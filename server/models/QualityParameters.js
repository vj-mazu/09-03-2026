/**
 * QualityParameters Model
 * 
 * Stores quality parameters added by Quality Supervisors.
 * Contains all quality measurement fields for rice sample evaluation.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const QualityParameters = sequelize.define('QualityParameters', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sampleEntryId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    field: 'sample_entry_id',
    references: {
      model: 'sample_entries',
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
  moisture: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    }
  },
  dryMoisture: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: null,
    field: 'dryMoisture'
  },
  cutting1: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0,
    field: 'cutting_1'
  },
  cutting2: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0,
    field: 'cutting_2'
  },
  bend: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0
  },
  bend1: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0,
    field: 'bend_1'
  },
  bend2: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0,
    field: 'bend_2'
  },
  mixS: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0,
    field: 'mix_s'
  },
  mixL: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0,
    field: 'mix_l'
  },
  mix: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0
  },
  kandu: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0
  },
  oil: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0
  },
  sk: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0
  },
  grainsCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    field: 'grains_count',
    validate: {
      min: 0
    }
  },
  gramsReport: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'grams_report'
  },
  wbR: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0,
    field: 'wb_r'
  },
  wbBk: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0,
    field: 'wb_bk'
  },
  wbT: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0,
    field: 'wb_t'
  },
  paddyWb: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0,
    field: 'paddy_wb'
  },
  smixEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
    field: 'smix_enabled'
  },
  lmixEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
    field: 'lmix_enabled'
  },
  paddyWbEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
    field: 'paddy_wb_enabled'
  },
  reportedBy: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'reported_by'
  },
  uploadFileUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'upload_file_url'
  }
}, {
  tableName: 'quality_parameters',
  underscored: true,
  indexes: [
    { fields: ['sample_entry_id'], unique: true },
    { fields: ['reported_by_user_id'] }
  ]
});

// Associations
QualityParameters.associate = (models) => {
  QualityParameters.belongsTo(models.SampleEntry, {
    foreignKey: 'sampleEntryId',
    as: 'sampleEntry'
  });

  QualityParameters.belongsTo(models.User, {
    foreignKey: 'reportedByUserId',
    as: 'reportedByUser'
  });
};

module.exports = QualityParameters;
