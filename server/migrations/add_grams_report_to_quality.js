const { sequelize } = require('../config/database');

/**
 * Migration to add grams_report column to quality_parameters table
 */
const addGramsReportToQuality = async () => {
    try {
        const queryInterface = sequelize.getQueryInterface();
        const tableInfo = await queryInterface.describeTable('quality_parameters');

        if (!tableInfo.grams_report) {
            console.log('🔄 Adding grams_report column to quality_parameters table...');
            await queryInterface.addColumn('quality_parameters', 'grams_report', {
                type: sequelize.Sequelize.STRING(20),
                allowNull: true
            });
            console.log('✅ grams_report column added successfully.');
        } else {
            console.log('ℹ️ grams_report column already exists.');
        }
    } catch (error) {
        console.error('❌ Error in addGramsReportToQuality migration:', error);
        throw error;
    }
};

module.exports = addGramsReportToQuality;
