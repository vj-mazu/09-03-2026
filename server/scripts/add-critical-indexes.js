/**
 * Critical Database Indexes for 30 Lakh (3 Million) Record Performance
 * 
 * Run this script once: node server/scripts/add-critical-indexes.js
 * 
 * These indexes are designed to make pagination, filtering, and JOINs
 * perform under 100ms even with 30 lakh records per table.
 */

const { sequelize } = require('../config/database');

const INDEXES = [
    // ============ ARRIVALS (largest table) ============
    // Pagination + date filtering (most common query pattern)
    `CREATE INDEX IF NOT EXISTS idx_arrivals_created_desc ON arrivals ("createdAt" DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_arrivals_date_desc ON arrivals ("arrivalDate" DESC)`,
    // Filtering by party, broker, variety (common filters)
    `CREATE INDEX IF NOT EXISTS idx_arrivals_party ON arrivals ("partyName")`,
    `CREATE INDEX IF NOT EXISTS idx_arrivals_broker ON arrivals ("brokerName")`,
    `CREATE INDEX IF NOT EXISTS idx_arrivals_variety ON arrivals (variety)`,
    // Composite index for filtered pagination
    `CREATE INDEX IF NOT EXISTS idx_arrivals_date_party ON arrivals ("arrivalDate" DESC, "partyName")`,
    // Status-based queries
    `CREATE INDEX IF NOT EXISTS idx_arrivals_status ON arrivals (status)`,

    // ============ SAMPLE ENTRIES ============
    `CREATE INDEX IF NOT EXISTS idx_sample_entries_created_desc ON sample_entries ("createdAt" DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_sample_entries_date_desc ON sample_entries ("entryDate" DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_sample_entries_party ON sample_entries ("partyName")`,
    `CREATE INDEX IF NOT EXISTS idx_sample_entries_broker ON sample_entries ("brokerName")`,
    `CREATE INDEX IF NOT EXISTS idx_sample_entries_variety ON sample_entries (variety)`,
    `CREATE INDEX IF NOT EXISTS idx_sample_entries_location ON sample_entries (location)`,
    `CREATE INDEX IF NOT EXISTS idx_sample_entries_status ON sample_entries ("workflowStatus")`,
    `CREATE INDEX IF NOT EXISTS idx_sample_entries_type ON sample_entries ("entryType")`,
    // Composite: date + status (for filtered pagination)
    `CREATE INDEX IF NOT EXISTS idx_sample_entries_date_status ON sample_entries ("entryDate" DESC, "workflowStatus")`,
    // Offering/Final price lookups
    `CREATE INDEX IF NOT EXISTS idx_sample_entries_offering ON sample_entries ("offeringPrice") WHERE "offeringPrice" IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_sample_entries_final ON sample_entries ("finalPrice") WHERE "finalPrice" IS NOT NULL`,

    // ============ RICE PRODUCTIONS ============
    `CREATE INDEX IF NOT EXISTS idx_rice_productions_created_desc ON rice_productions ("createdAt" DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_rice_productions_date ON rice_productions ("productionDate" DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_rice_productions_type ON rice_productions ("productType")`,
    `CREATE INDEX IF NOT EXISTS idx_rice_productions_variety ON rice_productions (variety)`,
    `CREATE INDEX IF NOT EXISTS idx_rice_productions_outturn ON rice_productions ("outturnId")`,

    // ============ RICE STOCK MOVEMENTS ============
    `CREATE INDEX IF NOT EXISTS idx_rice_stock_movements_created_desc ON rice_stock_movements ("createdAt" DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_rice_stock_movements_date ON rice_stock_movements ("movementDate" DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_rice_stock_movements_type ON rice_stock_movements ("movementType")`,
    `CREATE INDEX IF NOT EXISTS idx_rice_stock_movements_variety ON rice_stock_movements (variety)`,
    `CREATE INDEX IF NOT EXISTS idx_rice_stock_movements_location ON rice_stock_movements ("locationId")`,
    `CREATE INDEX IF NOT EXISTS idx_rice_stock_movements_packaging ON rice_stock_movements ("packagingId")`,
    // Composite for stock calculations
    `CREATE INDEX IF NOT EXISTS idx_rice_stock_movements_loc_var ON rice_stock_movements ("locationId", variety)`,

    // ============ KUNCHINITTUS (Ledger) ============
    `CREATE INDEX IF NOT EXISTS idx_kunchinittus_created_desc ON kunchinittus ("createdAt" DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_kunchinittus_name ON kunchinittus (name)`,
    `CREATE INDEX IF NOT EXISTS idx_kunchinittus_closed ON kunchinittus ("isClosed")`,

    // ============ PURCHASE RATES ============
    `CREATE INDEX IF NOT EXISTS idx_purchase_rates_arrival ON purchase_rates ("arrivalId")`,
    `CREATE INDEX IF NOT EXISTS idx_purchase_rates_created ON purchase_rates ("createdAt" DESC)`,

    // ============ HAMALI ENTRIES ============
    `CREATE INDEX IF NOT EXISTS idx_hamali_entries_date ON hamali_entries ("entryDate" DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_hamali_entries_status ON hamali_entries (status)`,
    `CREATE INDEX IF NOT EXISTS idx_paddy_hamali_entries_date ON paddy_hamali_entries ("entryDate" DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_rice_hamali_entries_date ON rice_hamali_entries ("entryDate" DESC)`,

    // ============ OUTTURNS ============
    `CREATE INDEX IF NOT EXISTS idx_outturns_created_desc ON outturns ("createdAt" DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_outturns_cleared ON outturns ("isCleared")`,
    `CREATE INDEX IF NOT EXISTS idx_outturns_arrival ON outturns ("arrivalId")`,

    // ============ BYPRODUCTS ============
    `CREATE INDEX IF NOT EXISTS idx_byproducts_outturn ON byproducts ("outturnId")`,
    `CREATE INDEX IF NOT EXISTS idx_byproducts_created ON byproducts ("createdAt" DESC)`,

    // ============ PACKAGINGS ============
    `CREATE INDEX IF NOT EXISTS idx_packagings_brand ON packagings ("brandName")`,

    // ============ USERS ============
    `CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)`,
    `CREATE INDEX IF NOT EXISTS idx_users_role ON users (role)`,
    `CREATE INDEX IF NOT EXISTS idx_users_active ON users ("isActive")`,
];

async function addCriticalIndexes() {
    console.log('🔧 Adding critical indexes for 30 lakh record performance...\n');

    let success = 0;
    let skipped = 0;
    let failed = 0;

    for (const sql of INDEXES) {
        try {
            await sequelize.query(sql);
            const match = sql.match(/idx_\w+/);
            console.log(`  ✅ ${match ? match[0] : 'index'}`);
            success++;
        } catch (err) {
            if (err.message.includes('already exists') || err.message.includes('relation')) {
                skipped++;
            } else if (err.message.includes('does not exist')) {
                // Table doesn't exist yet — skip silently
                skipped++;
            } else {
                console.log(`  ⚠️ ${err.message.substring(0, 80)}`);
                failed++;
            }
        }
    }

    console.log(`\n📊 Results: ${success} created, ${skipped} skipped, ${failed} failed`);
    console.log('✅ Index optimization complete!\n');
}

// Run if called directly
if (require.main === module) {
    addCriticalIndexes()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
}

module.exports = addCriticalIndexes;
