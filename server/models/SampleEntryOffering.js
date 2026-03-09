/**
 * SampleEntryOffering Model
 * 
 * Stores detailed offer price and final price data per sample entry.
 * Used in Lots Passed tab for Admin and Manager pricing workflow.
 * 
 * Offering Price Flow:
 *   Admin sets: offerRate, sute (per_kg/per_ton), baseRateType (PD_LOOSE/PD_WB/MD_WB/MD_LOOSE),
 *               baseRateUnit (per_bag/per_quintal), offerBaseRateValue,
 *               hamaliEnabled, brokerageEnabled
 *   When hamali=yes: hamaliPerKg, hamaliPerQuintal, moistureValue, brokerage, lf, egb
 *   When MD_LOOSE: customDivisor shown
 *   When PD_WB or MD_WB: egb hidden
 * 
 * Final Price Flow:
 *   Auto-fetches sute and base rate from offering
 *   Admin sets: hamaliEnabled (yes/no), brokerageEnabled (yes/no)
 *   Manager fills: hamali, brokerage, lf values
 *   LF: manager only
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SampleEntryOffering = sequelize.define('SampleEntryOffering', {
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
    // === OFFERING PRICE FIELDS ===
    offerRate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'offer_rate'
    },
    sute: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0
    },
    suteUnit: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'per_kg',
        field: 'sute_unit'
    },
    baseRateType: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'base_rate_type'
    },
    suteEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
        field: 'sute_enabled'
    },
    baseRateUnit: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'per_bag',
        field: 'base_rate_unit'
    },
    offerBaseRateValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'offer_base_rate_value'
    },
    // === HAMALI FIELDS ===
    hamali: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0
    },
    hamaliUnit: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'per_bag',
        field: 'hamali_unit'
    },
    hamaliBy: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'admin',
        field: 'hamali_by'
    },
    hamaliEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        field: 'hamali_enabled'
    },
    hamaliPerKg: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        field: 'hamali_per_kg'
    },
    hamaliPerQuintal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        field: 'hamali_per_quintal'
    },
    moistureValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        field: 'moisture_value'
    },
    moistureEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
        field: 'moisture_enabled'
    },
    // === BROKERAGE FIELDS ===
    brokerage: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0
    },
    brokerageUnit: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'per_bag',
        field: 'brokerage_unit'
    },
    brokerageBy: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'admin',
        field: 'brokerage_by'
    },
    brokerageEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        field: 'brokerage_enabled'
    },
    // === LF FIELDS ===
    lf: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0
    },
    lfUnit: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'per_bag',
        field: 'lf_unit'
    },
    lfEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        field: 'lf_enabled'
    },
    lfBy: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'manager',
        field: 'lf_by'
    },
    // === EGB FIELDS ===
    egbType: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'mill',
        field: 'egb_type'
    },
    egbValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        field: 'egb_value'
    },
    // === CUSTOM DIVISOR (MD/Loose only) ===
    customDivisor: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'custom_divisor'
    },
    offerVersions: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        field: 'offer_versions'
    },
    activeOfferKey: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'active_offer_key'
    },
    cdEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        field: 'cd_enabled'
    },
    cdValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        field: 'cd_value'
    },
    cdUnit: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'lumps',
        field: 'cd_unit'
    },
    bankLoanEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        field: 'bank_loan_enabled'
    },
    bankLoanValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        field: 'bank_loan_value'
    },
    bankLoanUnit: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'lumps',
        field: 'bank_loan_unit'
    },
    paymentConditionValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 15,
        field: 'payment_condition_value'
    },
    paymentConditionUnit: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'days',
        field: 'payment_condition_unit'
    },
    // === FINAL PRICE FIELDS ===
    finalBaseRate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'final_base_rate'
    },
    finalSute: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'final_sute'
    },
    finalSuteUnit: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'final_sute_unit'
    },
    finalPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'final_price'
    },
    finalRemarks: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'final_remarks'
    },
    isFinalized: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_finalized'
    },
    // === TRACKING ===
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'created_by',
        references: {
            model: 'users',
            key: 'id'
        }
    },
    updatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'updated_by',
        references: {
            model: 'users',
            key: 'id'
        }
    }
}, {
    tableName: 'sample_entry_offerings',
    underscored: true,
    indexes: [
        { fields: ['sample_entry_id'] },
        { fields: ['is_finalized'] }
    ]
});

// Associations
SampleEntryOffering.associate = (models) => {
    SampleEntryOffering.belongsTo(models.SampleEntry, {
        foreignKey: 'sampleEntryId',
        as: 'sampleEntry'
    });
};

module.exports = SampleEntryOffering;
