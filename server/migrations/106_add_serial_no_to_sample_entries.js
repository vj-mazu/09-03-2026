/**
 * Migration 106: Add serial_no to sample_entries table
 * 
 * This adds an auto-incrementing serial number to provide a constant
 * Sl No for user display that doesn't change when data is moved or re-sorted.
 */

const { sequelize } = require('../config/database');

async function up() {
    const queryInterface = sequelize.getQueryInterface();

    try {
        console.log('🔄 Migration 106: Adding serial_no to sample_entries...');

        // Add serial_no column as SERIAL (auto-incrementing integer)
        // In Postgres, SERIAL is a shorthand for an integer column with a sequence.
        await sequelize.query(`
      ALTER TABLE sample_entries 
      ADD COLUMN serial_no SERIAL;
    `);

        // Optional: Add index for faster sorting/lookup by serial number
        await queryInterface.addIndex('sample_entries', ['serial_no'], {
            name: 'idx_sample_entries_serial_no'
        });

        console.log('✅ Migration 106: serial_no added successfully');

    } catch (error) {
        console.error('❌ Migration 106 error:', error.message);
        // If it already exists, don't fail the whole startup
        if (error.message.includes('already exists')) {
            console.log('⚠️ Migration 106: serial_no already exists, skipping.');
        } else {
            throw error;
        }
    }
}

async function down() {
    const queryInterface = sequelize.getQueryInterface();

    try {
        console.log('🔄 Rolling back Migration 106...');

        await queryInterface.removeColumn('sample_entries', 'serial_no');

        console.log('✅ Migration 106: Rolled back successfully');

    } catch (error) {
        console.error('❌ Migration 106 rollback error:', error.message);
        throw error;
    }
}

module.exports = { up, down };
