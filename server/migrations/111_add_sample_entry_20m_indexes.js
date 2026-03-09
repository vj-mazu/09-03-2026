'use strict';

/**
 * Migration 111: 20M-scale sample workflow indexes
 *
 * Focus:
 * - composite cursor pagination on sample_entries using entry_date + created_at + id
 * - faster audit-history lookups for loading-lots enrichment
 * - faster latest-child lookups on quality/cooking/offering tables
 */
module.exports = {
  up: async () => {
    const { sequelize } = require('../config/database');

    const indexes = [
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_se_workflow_type_entrydate_created_id
       ON sample_entries (workflow_status, entry_type, entry_date DESC, created_at DESC, id DESC)`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_se_entrytype_entrydate_created_id
       ON sample_entries (entry_type, entry_date DESC, created_at DESC, id DESC)`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_se_entrydate_created_id
       ON sample_entries (entry_date DESC, created_at DESC, id DESC)`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_se_audit_table_action_record_created
       ON sample_entry_audit_logs (table_name, action_type, record_id, created_at DESC)`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qp_sample_entry_updated_created
       ON quality_parameters (sample_entry_id, updated_at DESC, created_at DESC)`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cr_sample_entry_updated_created
       ON cooking_reports (sample_entry_id, updated_at DESC, created_at DESC)`,
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seo_sample_entry_updated
       ON sample_entry_offerings (sample_entry_id, updated_at DESC)`
    ];

    for (const sql of indexes) {
      try {
        await sequelize.query(sql);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.log(`Migration 111 index warning: ${error.message}`);
        }
      }
    }

    console.log('Migration 111 complete: 20M sample workflow indexes added');
  },

  down: async () => {
    const { sequelize } = require('../config/database');

    const dropIndexes = [
      'DROP INDEX IF EXISTS idx_se_workflow_type_entrydate_created_id',
      'DROP INDEX IF EXISTS idx_se_entrytype_entrydate_created_id',
      'DROP INDEX IF EXISTS idx_se_entrydate_created_id',
      'DROP INDEX IF EXISTS idx_se_audit_table_action_record_created',
      'DROP INDEX IF EXISTS idx_qp_sample_entry_updated_created',
      'DROP INDEX IF EXISTS idx_cr_sample_entry_updated_created',
      'DROP INDEX IF EXISTS idx_seo_sample_entry_updated'
    ];

    for (const sql of dropIndexes) {
      await sequelize.query(sql).catch(() => { });
    }
  }
};
