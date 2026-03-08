'use strict';

/**
 * Migration 107: Final Pass Lots query indexes
 *
 * Targets:
 * - fast cursor pagination for final-pass-lots tab
 * - fast join/filter for cooking status PASS/MEDIUM
 * - scalable behavior on very large row counts
 */
module.exports = {
  up: async () => {
    const { sequelize } = require('../config/database');

    const indexes = [
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_se_final_pass_cursor
       ON sample_entries (workflow_status, lot_selection_decision, entry_type, created_at DESC, id DESC)`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_se_final_pass_date_filters
       ON sample_entries (entry_date DESC, broker_name, variety)`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cr_status_sample_entry
       ON cooking_reports (status, sample_entry_id)`
    ];

    for (const sql of indexes) {
      try {
        await sequelize.query(sql);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.log(`Migration 107 index warning: ${error.message}`);
        }
      }
    }

    console.log('Migration 107 complete: Final Pass Lots indexes added');
  },

  down: async () => {
    const { sequelize } = require('../config/database');

    const dropIndexes = [
      'DROP INDEX IF EXISTS idx_se_final_pass_cursor',
      'DROP INDEX IF EXISTS idx_se_final_pass_date_filters',
      'DROP INDEX IF EXISTS idx_cr_status_sample_entry'
    ];

    for (const sql of dropIndexes) {
      await sequelize.query(sql).catch(() => { });
    }
  }
};

