require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { sequelize } = require('./config/database');
const authRoutes = require('./routes/auth');
const arrivalsRoutes = require('./routes/arrivals');
const recordsRoutes = require('./routes/records');
const locationsRoutes = require('./routes/locations');
const exportRoutes = require('./routes/export');
const ledgerRoutes = require('./routes/ledger');
const outturnsRoutes = require('./routes/outturns');
const byproductsRoutes = require('./routes/byproducts');
const outturnExportRoutes = require('./routes/outturn_export');
const dateExportRoutes = require('./routes/date_export');
const dashboardRoutes = require('./routes/dashboard');
const packagingsRoutes = require('./routes/packagings');
const riceProductionsRoutes = require('./routes/rice-productions');
const { router: purchaseRatesRoutes } = require('./routes/purchase-rates');
const hamaliRatesRoutes = require('./routes/hamali-rates');
const hamaliEntriesRoutes = require('./routes/hamali-entries');
const hamaliBookRoutes = require('./routes/hamali-book');
const statusRoutes = require('./routes/status');
const paddyHamaliRatesRoutes = require('./routes/paddy-hamali-rates');
const paddyHamaliEntriesRoutes = require('./routes/paddy-hamali-entries');
const riceHamaliRatesRoutes = require('./routes/riceHamaliRates');
const riceHamaliEntriesRoutes = require('./routes/riceHamaliEntries');
const riceHamaliEntriesSimpleRoutes = require('./routes/riceHamaliEntriesSimple');
const metricsRoutes = require('./routes/metrics');
const performanceMetricsRoutes = require('./routes/performance-metrics');
const riceStockRoutes = require('./routes/rice-stock');
const riceStockManagementRoutes = require('./routes/riceStockManagement');
const riceStockVarietiesRoutes = require('./routes/rice-stock-varieties');
const yieldRoutes = require('./routes/yield');
const adminUsersRoutes = require('./routes/admin-users');
const unifiedVarietiesRoutes = require('./routes/unified-varieties');
const sampleEntriesRoutes = require('./routes/sample-entries');

const compression = require('compression');
const performanceMonitor = require('./middleware/performanceMonitor');
// queryTimingMiddleware removed — duplicates performanceMonitor

const app = express();
const PORT = process.env.PORT || 5000;

// Performance monitoring (tracks response times)
app.use(performanceMonitor);

// queryTimingMiddleware removed — was duplicating performanceMonitor

// Performance: Enable gzip compression
app.use(compression({
  level: 6, // Compression level (0-9, 6 is good balance)
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Security middleware
app.use(helmet());

// CORS Configuration - Support multiple origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://complete-paddy-rice-management-syst.vercel.app',
  'https://complete-paddy-rice-management-system.vercel.app',
  process.env.CLIENT_URL
].filter(Boolean).map(url => {
  // Strip any trailing paths (like /login) from URLs
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}`;
  } catch {
    return url;
  }
});

app.use(cors({
  origin: function (origin, callback) {
    // In production, block requests with no origin (prevents some CSRF attacks)
    if (!origin) {
      if (process.env.NODE_ENV === 'production') {
        return callback(new Error('CORS: No origin header'));
      }
      return callback(null, true);
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma']
}));

// Rate limiting - General API protection
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 5000 : 1000, // 1000 in production (SPA needs ~5-10 calls per page load)
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Strict rate limiter for auth endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 1000, // Increased limit to prevent testing logouts
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth/login', authLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization — strips HTML/XSS from all incoming data
const { sanitizeRequest } = require('./middleware/validateRequest');
app.use(sanitizeRequest);

// Structured request logging — logs every HTTP request with timing
const logger = require('./utils/logger');
app.use(logger.requestLogger);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/arrivals', arrivalsRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/export/pdf/outturn', outturnExportRoutes);
app.use('/api/export/date', dateExportRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/outturns', outturnsRoutes);
app.use('/api/byproducts', byproductsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/packagings', packagingsRoutes);
app.use('/api/rice-productions', riceProductionsRoutes);
app.use('/api/purchase-rates', purchaseRatesRoutes);
app.use('/api/hamali-rates', hamaliRatesRoutes);
app.use('/api/hamali-entries', hamaliEntriesRoutes);
app.use('/api/hamali-book', hamaliBookRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/paddy-hamali-rates', paddyHamaliRatesRoutes);
app.use('/api/paddy-hamali-entries', paddyHamaliEntriesRoutes);
app.use('/api/rice-hamali-rates', riceHamaliRatesRoutes);
app.use('/api/rice-hamali-entries', riceHamaliEntriesRoutes);
app.use('/api/rice-hamali-entries-simple', riceHamaliEntriesSimpleRoutes);
app.use('/api/other-hamali-works', require('./routes/otherHamaliWorks'));
app.use('/api/other-hamali-entries', require('./routes/otherHamaliEntries'));
app.use('/api/metrics', metricsRoutes);
app.use('/api/performance-metrics', performanceMetricsRoutes);
app.use('/api/rice-stock', riceStockRoutes);
app.use('/api/rice-stock-management', riceStockManagementRoutes);
app.use('/api', riceStockVarietiesRoutes); // Rice stock varieties API endpoints
app.use('/api/yield', yieldRoutes);
app.use('/api/admin', adminUsersRoutes);
app.use('/api/unified-varieties', unifiedVarietiesRoutes);
app.use('/api/sample-entries', sampleEntriesRoutes);


const { execFile } = require('child_process');
const path = require('path');
const { auth, authorize } = require('./middleware/auth');

// Seeding route — requires admin JWT authentication (no hardcoded keys)
app.get('/api/admin/seed-render', auth, authorize('admin'), (req, res) => {
  console.log(`🌱 Remote seeding triggered by admin: ${req.user.username}`);
  const seederPath = path.join(__dirname, 'seeders', 'render-lightweight-seeder.js');

  // Use execFile (not exec) to prevent command injection
  execFile('node', [seederPath], (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Seeding Error: ${error.message}`);
      return;
    }
    console.log(`✅ Seeding Output: ${stdout}`);
  });

  res.json({
    message: 'Seeding process started in the background.',
    target: '25,000 records',
    triggeredBy: req.user.username
  });
});

// Health check (cached 30s to avoid DB pings every request)
const { cacheMiddleware, getCacheStats } = require('./middleware/cache');

app.get('/api/health', cacheMiddleware(30), async (req, res) => {
  try {
    // Test database connection
    await sequelize.authenticate();

    // Check if tables exist
    const tables = await sequelize.getQueryInterface().showAllTables();

    res.json({
      status: 'OK',
      message: 'Mother India Stock Management Server is running',
      database: 'Connected',
      tables: tables.length,
      cache: getCacheStats()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// Cache stats endpoint (admin only)
app.get('/api/cache-stats', auth, authorize('admin'), (req, res) => {
  res.json(getCacheStats());
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Database connection and server start
const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    // Check if tables exist, if not create them
    try {
      const tables = await sequelize.getQueryInterface().showAllTables();

      if (tables.length === 0) {
        console.log('🔄 Empty database detected. Creating initial schema...');
        // Force sync to create all tables on fresh database
        await sequelize.sync({ force: false, alter: false });
        console.log('✅ Initial database schema created.');
      } else {
        console.log('✅ Database ready (using migrations for schema management).');
      }
    } catch (syncError) {
      console.log('⚠️ Schema check warning:', syncError.message);
      console.log('✅ Proceeding with migrations...');
    }

    // Run migrations automatically
    const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL;

    if (isVercel) {
      console.log('☁️ Running on Vercel: Skipping migrations for performance.');
    } else {
      console.log('🔄 Running migrations...');

      // Migration 0: Fix rate type enum (cleanup)
      try {
        const fixRateTypeEnum = require('./migrations/fix_rate_type_enum');
        await fixRateTypeEnum();
      } catch (error) {
        console.log('⚠️ Migration 0 warning:', error.message);
      }

      // Migration 1: Add linked shifting ID
      try {
        const { addLinkedShiftingId } = require('./migrations/add_linked_shifting_id');
        await addLinkedShiftingId();
      } catch (error) {
        console.log('⚠️ Migration 1 warning:', error.message);
      }

      // Migration 2: Create opening balances table
      try {
        const createOpeningBalancesTable = require('./migrations/create_opening_balances_table');
        const queryInterface = sequelize.getQueryInterface();
        await createOpeningBalancesTable.up(queryInterface, sequelize.Sequelize);
      } catch (error) {
        console.log('⚠️ Migration 2 warning:', error.message);
      }

      // Migration 3: Update kunchinittu constraints
      try {
        const updateKunchinintuConstraints = require('./migrations/update_kunchinittu_constraints');
        const queryInterface = sequelize.getQueryInterface();
        await updateKunchinintuConstraints.up(queryInterface, sequelize.Sequelize);
      } catch (error) {
        console.log('⚠️ Migration 3 warning:', error.message);
      }

      // Migration 4: Create balance audit trails table
      try {
        const createBalanceAuditTrailsTable = require('./migrations/create_balance_audit_trails_table');
        const queryInterface = sequelize.getQueryInterface();
        await createBalanceAuditTrailsTable.up(queryInterface, sequelize.Sequelize);
      } catch (error) {
        console.log('⚠️ Migration 4 warning:', error.message);
      }

      // Migration 5: Add performance indexes
      try {
        const addPerformanceIndexes = require('./migrations/add_performance_indexes');
        await addPerformanceIndexes.up();
      } catch (error) {
        console.log('⚠️ Migration 5 warning:', error.message);
      }

      // Migration 6: Add fromOutturnId for purchase from production
      try {
        const addFromOutturnId = require('./migrations/add_from_outturn_id');
        await addFromOutturnId();
      } catch (error) {
        console.log('⚠️ Migration 6 warning:', error.message);
      }

      // Migration 6.5: Create rice production tables
      try {
        const createRiceProductionTables = require('./migrations/create_rice_production_tables');
        await createRiceProductionTables();
      } catch (error) {
        console.log('⚠️ Migration 6.5 warning:', error.message);
      }

      // Migration 7: Update rice production product types
      try {
        const updateRiceProductionProductTypes = require('./migrations/update_rice_production_product_types');
        await updateRiceProductionProductTypes();
      } catch (error) {
        console.log('⚠️ Migration 7 warning:', error.message);
      }

      // Migration 8: Add rice production indexes
      try {
        const addRiceProductionIndexes = require('./migrations/add_rice_production_indexes');
        await addRiceProductionIndexes();
        console.log('✅ Migration 8: Rice production indexes added');
      } catch (error) {
        console.log('⚠️ Migration 8 warning:', error.message);
      }

      // Migration 9: Add unpolished to byproducts
      try {
        const addUnpolishedToByproducts = require('./migrations/add_unpolished_to_byproducts');
        const queryInterface = sequelize.getQueryInterface();
        await addUnpolishedToByproducts.up(queryInterface, sequelize.Sequelize);
      } catch (error) {
        console.log('⚠️ Migration 9 warning:', error.message);
      }

      // Migration 10: Fix net weight
      try {
        const fixNetWeight = require('./migrations/fix_net_weight');
        const queryInterface = sequelize.getQueryInterface();
        await fixNetWeight.up(queryInterface, sequelize.Sequelize);
      } catch (error) {
        console.log('⚠️ Migration 10 warning:', error.message);
      }

      // Migration 11: Create purchase rates table
      try {
        const createPurchaseRatesTable = require('./migrations/create_purchase_rates_table');
        const queryInterface = sequelize.getQueryInterface();
        await createPurchaseRatesTable.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 11: Purchase rates table created');
      } catch (error) {
        console.log('⚠️ Migration 11 warning:', error.message);
      }

      // Migration 12: Add RJ Rice 1 and RJ Rice 2 to byproducts
      try {
        const addRjRiceToByproducts = require('./migrations/add_rj_rice_to_byproducts');
        const queryInterface = sequelize.getQueryInterface();
        await addRjRiceToByproducts.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 12: RJ Rice columns added to byproducts');
      } catch (error) {
        console.log('⚠️ Migration 11 warning:', error.message);
      }

      // Migration 12: Add sute column to purchase rates
      try {
        const addSuteToPurchaseRates = require('./migrations/add_sute_to_purchase_rates');
        const queryInterface = sequelize.getQueryInterface();
        await addSuteToPurchaseRates.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 12: Sute column added to purchase rates');
      } catch (error) {
        console.log('⚠️ Migration 12 warning:', error.message);
      }

      // Migration 13: Create hamali rates table
      try {
        const createHamaliRatesTable = require('./migrations/create_hamali_rates_table');
        const queryInterface = sequelize.getQueryInterface();
        await createHamaliRatesTable.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 13: Hamali rates table created');
      } catch (error) {
        console.log('⚠️ Migration 13 warning:', error.message);
      }

      // Migration 14: Create hamali entries table
      try {
        const createHamaliEntriesTable = require('./migrations/create_hamali_entries_table');
        const queryInterface = sequelize.getQueryInterface();
        await createHamaliEntriesTable.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 14: Hamali entries table created');
      } catch (error) {
        console.log('⚠️ Migration 14 warning:', error.message);
      }

      // Migration 15: Add status to hamali entries
      try {
        const addStatusToHamaliEntries = require('./migrations/add_status_to_hamali_entries');
        const queryInterface = sequelize.getQueryInterface();
        await addStatusToHamaliEntries.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 15: Status added to hamali entries');
      } catch (error) {
        console.log('⚠️ Migration 15 warning:', error.message);
      }

      // Migration 16: Add unique kunchinittu name constraint
      try {
        const addUniqueKunchinintuName = require('./migrations/add_unique_kunchinittu_name');
        const queryInterface = sequelize.getQueryInterface();
        await addUniqueKunchinintuName.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 16: Unique kunchinittu name constraint added');
      } catch (error) {
        console.log('⚠️ Migration 16 warning:', error.message);
      }

      // Migration 17: Add loose movement type
      try {
        const addLooseMovementType = require('./migrations/add_loose_movement_type');
        await addLooseMovementType();
        console.log('✅ Migration 17: Loose movement type added');
      } catch (error) {
        console.log('⚠️ Migration 17 warning:', error.message);
      }

      // Migration 18: Add paddy bags deducted column
      try {
        const addPaddyBagsDeducted = require('./migrations/add_paddy_bags_deducted_column');
        await addPaddyBagsDeducted.up();
        console.log('✅ Migration 18: Paddy bags deducted column added');
      } catch (error) {
        console.log('⚠️ Migration 18 warning:', error.message);
      }

      // Migration 19: Update rate type enum
      try {
        const updateRateTypeEnum = require('./migrations/update_rate_type_enum');
        const queryInterface = sequelize.getQueryInterface();
        await updateRateTypeEnum.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 19: Rate type enum updated');
      } catch (error) {
        console.log('⚠️ Migration 19 warning:', error.message);
      }

      // Migration 20: Drop RAG system tables
      try {
        const dropRagTables = require('./migrations/drop_rag_tables');
        const queryInterface = sequelize.getQueryInterface();
        await dropRagTables.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 20: RAG system tables dropped');
      } catch (error) {
        console.log('⚠️ Migration 20 warning:', error.message);
      }

      // Migration 21: Update for-production to purchase
      try {
        const updateForProductionToPurchase = require('./migrations/update_for_production_to_purchase');
        await updateForProductionToPurchase.up();
        console.log('✅ Migration 21: For-production records updated to purchase');
      } catch (error) {
        console.log('⚠️ Migration 21 warning:', error.message);
      }

      // Migration 22: Add comprehensive performance indexes
      try {
        const addComprehensiveIndexes = require('./migrations/add_comprehensive_indexes');
        await addComprehensiveIndexes.up();
        console.log('✅ Migration 22: Comprehensive performance indexes added');
      } catch (error) {
        console.log('⚠️ Migration 22 warning:', error.message);
      }

      // Migration 23: Create rice stock locations table
      try {
        const createRiceStockLocationsTable = require('./migrations/create_rice_stock_locations_table');
        await createRiceStockLocationsTable.up();
        console.log('✅ Migration 23: Rice stock locations table created');
      } catch (error) {
        console.log('⚠️ Migration 23 warning:', error.message);
      }

      // Migration 24: Update packaging kg to decimal
      try {
        const updatePackagingKgToDecimal = require('./migrations/update_packaging_kg_to_decimal');
        await updatePackagingKgToDecimal.up();
        console.log('✅ Migration 24: Packaging KG converted to decimal');
      } catch (error) {
        console.log('⚠️ Migration 24 warning:', error.message);
      }

      // Migration 25: Add yield percentage to outturns
      try {
        const addYieldPercentageToOutturns = require('./migrations/25_add_yield_percentage_to_outturns');
        await addYieldPercentageToOutturns.up();
        console.log('✅ Migration 25: Yield percentage column added to outturns');
      } catch (error) {
        console.log('⚠️ Migration 25 warning:', error.message);
      }

      // Migration 26: Create paddy hamali rates table
      try {
        const createPaddyHamaliRatesTable = require('./migrations/create_paddy_hamali_rates_table');
        const queryInterface = sequelize.getQueryInterface();
        await createPaddyHamaliRatesTable.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 26: Paddy hamali rates table created with default rates');
      } catch (error) {
        console.log('⚠️ Migration 26 warning:', error.message);
      }

      // Migration 27: Create paddy hamali entries table
      try {
        const createPaddyHamaliEntriesTable = require('./migrations/create_paddy_hamali_entries_table');
        const queryInterface = sequelize.getQueryInterface();
        await createPaddyHamaliEntriesTable.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 27: Paddy hamali entries table created');
      } catch (error) {
        console.log('⚠️ Migration 27 warning:', error.message);
      }

      // Migration 28: Add Sizer Broken to rice_productions
      try {
        const addSizerBrokenToRiceProduction = require('./migrations/add_sizer_broken_to_rice_production');
        await addSizerBrokenToRiceProduction();
        console.log('✅ Migration 28: "Sizer Broken" added to rice_productions productType');
      } catch (error) {
        console.log('⚠️ Migration 28 warning:', error.message);
      }

      // Migration 29: Add base_rate_calculation_method to purchase_rates
      try {
        const addBaseRateCalculationMethod = require('./migrations/add_base_rate_calculation_method');
        await addBaseRateCalculationMethod();
        console.log('✅ Migration 29: base_rate_calculation_method added to purchase_rates');
      } catch (error) {
        console.log('⚠️ Migration 29 warning:', error.message);
      }

      // Migration 30: Add average_rate and last_rate_calculation to kunchinittus
      try {
        const addAverageRateToKunchinittus = require('./migrations/30_add_average_rate_to_kunchinittus');
        const queryInterface = sequelize.getQueryInterface();
        await addAverageRateToKunchinittus.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 30: average_rate and last_rate_calculation added to kunchinittus');
      } catch (error) {
        console.log('⚠️ Migration 30 warning:', error.message);
      }

      // Migration 31: Add Sizer Broken to rice_productions ENUM
      try {
        const addSizerBrokenToRiceProduction = require('./migrations/add_sizer_broken_to_rice_production');
        const queryInterface = sequelize.getQueryInterface();
        await addSizerBrokenToRiceProduction.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 31: Sizer Broken added to rice_productions product types');
      } catch (error) {
        console.log('⚠️ Migration 31 warning:', error.message);
      }

      // Migration 32: Add worker_name and batch_number to paddy_hamali_entries
      try {
        const addWorkerBatchToPaddyHamali = require('./migrations/add_worker_batch_to_paddy_hamali');
        const queryInterface = sequelize.getQueryInterface();
        await addWorkerBatchToPaddyHamali.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 32: Worker name and batch number added to paddy hamali entries');
      } catch (error) {
        console.log('⚠️ Migration 32 warning:', error.message);
      }

      // Migration 33: Create other_hamali_works table
      try {
        const createOtherHamaliWorksTable = require('./migrations/create_other_hamali_works_table');
        const queryInterface = sequelize.getQueryInterface();
        await createOtherHamaliWorksTable.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 33: Other hamali works table created');
      } catch (error) {
        console.log('⚠️ Migration 33 warning:', error.message);
      }

      // Migration 34: Create other_hamali_entries table
      try {
        const createOtherHamaliEntriesTable = require('./migrations/create_other_hamali_entries_table');
        const queryInterface = sequelize.getQueryInterface();
        await createOtherHamaliEntriesTable.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 34: Other hamali entries table created');
      } catch (error) {
        console.log('⚠️ Migration 34 warning:', error.message);
      }

      // Migration 32: Fix Sizer Broken CHECK constraint
      try {
        const fixSizerBrokenCheckConstraint = require('./migrations/32_fix_sizer_broken_check_constraint');
        const queryInterface = sequelize.getQueryInterface();
        await fixSizerBrokenCheckConstraint.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 32: Sizer Broken CHECK constraint fixed');
      } catch (error) {
        console.log('⚠️ Migration 32 warning:', error.message);
      }

      // Migration 35: Add Rice Hamali System
      try {
        const addRiceHamaliSystem = require('./migrations/add_rice_hamali_system');
        await addRiceHamaliSystem.up();
        console.log('✅ Migration 35: Rice Hamali System added');
      } catch (error) {
        console.log('⚠️ Migration 35 warning:', error.message);
      }

      // Migration 36: Add Complete Rice Hamali Rates (69 work types)
      try {
        const addCompleteRiceHamaliRates = require('./migrations/36_add_complete_rice_hamali_rates');
        await addCompleteRiceHamaliRates.up();
        console.log('✅ Migration 36: Complete Rice Hamali Rates added');
      } catch (error) {
        console.log('⚠️ Migration 36 warning:', error.message);
      }

      // Migration 37: Fix Rice Hamali Rates with exact data from images
      try {
        const fixRiceHamaliRatesFromImages = require('./migrations/37_fix_rice_hamali_rates_from_images');
        await fixRiceHamaliRatesFromImages.up();
        console.log('✅ Migration 37: Rice Hamali Rates from images fixed');
      } catch (error) {
        console.log('⚠️ Migration 37 warning:', error.message);
      }

      // Migration 38: Create Rice Hamali Entries Table
      try {
        const createRiceHamaliEntriesTable = require('./migrations/38_create_rice_hamali_entries_table');
        await createRiceHamaliEntriesTable();
        console.log('✅ Migration 38: Rice Hamali Entries table created');
      } catch (error) {
        console.log('⚠️ Migration 38 warning:', error.message);
      }

      // Migration 39: Fix Rice Hamali Entries Table Structure
      try {
        const fixRiceHamaliEntriesTable = require('./migrations/39_fix_rice_hamali_entries_table');
        await fixRiceHamaliEntriesTable();
        console.log('✅ Migration 39: Rice Hamali Entries table structure fixed');
      } catch (error) {
        console.log('⚠️ Migration 39 warning:', error.message);
      }

      // Migration 40: Create Rice Stock Management System
      try {
        const createRiceStockManagementSystem = require('./migrations/40_create_rice_stock_management_system');
        await createRiceStockManagementSystem();
        console.log('✅ Migration 40: Rice Stock Management System created');
      } catch (error) {
        console.log('⚠️ Migration 40 warning:', error.message);
      }

      // Migration 40.5: Comprehensive System Enhancements
      try {
        const migration40_5 = require('./migrations/40_comprehensive_system_enhancements');
        await migration40_5.up();
        console.log('✅ Migration 40.5: Comprehensive system enhancements completed');
      } catch (error) {
        console.log('⚠️ Migration 40.5 warning:', error.message);
      }

      // Migration 41: Add Rice Stock Movement Hamali Support
      try {
        const addRiceStockMovementHamaliSupport = require('./migrations/41_add_rice_stock_movement_hamali_support');
        await addRiceStockMovementHamaliSupport();
        console.log('✅ Migration 41: Rice Stock Movement Hamali Support added');
      } catch (error) {
        console.log('⚠️ Migration 41 warning:', error.message);
      }

      // Migration 42: Add Rice Stock Approval System and Palti Feature
      try {
        const addRiceStockApprovalAndPaltiSystem = require('./migrations/42_add_rice_stock_approval_and_palti_system');
        await addRiceStockApprovalAndPaltiSystem.up();
        console.log('✅ Migration 42: Rice Stock Approval System + Palti Feature added');
      } catch (error) {
        console.log('⚠️ Migration 42 warning:', error.message);
      }

      // Migration 43: Fix Rice Hamali Constraint for Palti
      try {
        const fixRiceHamaliConstraint = require('./migrations/42_fix_rice_hamali_constraint');
        await fixRiceHamaliConstraint();
        console.log('✅ Migration 43: Rice Hamali Constraint fixed for Palti');
      } catch (error) {
        console.log('⚠️ Migration 43 warning:', error.message);
      }

      // Migration 44: Automatic Rice Hamali System (NEW - CRITICAL)
      try {
        const automaticRiceHamaliSystem = require('./migrations/43_create_automatic_rice_hamali_system');
        await automaticRiceHamaliSystem.up();
        console.log('✅ Migration 44: Automatic Rice Hamali System created - Rice Hamali Book will work perfectly!');
      } catch (error) {
        console.log('⚠️ Migration 44 warning:', error.message);
        console.log('🔧 Rice Hamali system may need manual setup. Run: node run_rice_hamali_migration.js');
      }

      // Migration 45: Fix purchase_rates table columns (add missing columns like rate_type)
      try {
        const fixPurchaseRatesColumns = require('./migrations/fix_purchase_rates_columns');
        const queryInterface = sequelize.getQueryInterface();
        await fixPurchaseRatesColumns.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 45: Purchase rates columns fixed');
      } catch (error) {
        console.log('⚠️ Migration 45 warning:', error.message);
      }

      // Migration 46: 10 Lakh Record Performance Optimization Indexes
      try {
        const add10LakhOptimizationIndexes = require('./migrations/46_add_10_lakh_optimization_indexes');
        await add10LakhOptimizationIndexes.up();
        console.log('✅ Migration 46: 10 Lakh Record Performance Optimization indexes added');
      } catch (error) {
        console.log('⚠️ Migration 46 warning:', error.message);
      }

      // Migration 47: Fix loose entries missing variety (Quick Info stock count fix)
      try {
        const updateLooseEntriesVariety = require('./migrations/update_loose_entries_variety');
        await updateLooseEntriesVariety();
        console.log('✅ Migration 47: Loose entries variety field updated');
      } catch (error) {
        console.log('⚠️ Migration 47 warning:', error.message);
      }

      // Migration 48: Disable Automatic Rice Hamali Trigger (FIX for production)
      // This removes the triggers that were auto-creating hamali entries
      try {
        const disableAutoHamaliTrigger = require('./migrations/44_disable_auto_hamali_trigger');
        await disableAutoHamaliTrigger.up();
        console.log('✅ Migration 48: Automatic hamali trigger disabled - Users must now manually add hamali entries');
      } catch (error) {
        console.log('⚠️ Migration 48 warning:', error.message);
      }

      // Migration 49: Add h_calculation_method to purchase_rates
      try {
        const addHCalculationMethod = require('./migrations/47_add_h_calculation_method_to_purchase_rates');
        await addHCalculationMethod();
        console.log('✅ Migration 49: h_calculation_method added to purchase_rates');
      } catch (error) {
        console.log('⚠️ Migration 49 warning:', error.message);
      }

      // Migration 50: Add isClosed to kunchinittus (for Kunchinittu Close feature)
      // SAFE: Only adds new columns with default values (is_closed = false)
      try {
        const addIsClosedToKunchinittus = require('./migrations/48_add_is_closed_to_kunchinittus');
        const queryInterface = sequelize.getQueryInterface();
        await addIsClosedToKunchinittus.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 50: isClosed fields added to kunchinittus');
      } catch (error) {
        console.log('⚠️ Migration 50 warning:', error.message);
      }

      // Migration 51: Add outturn clearing fields (is_cleared, cleared_at, cleared_by, remaining_bags)
      // CRITICAL: Fixes 'column o.isCleared does not exist' error in production
      try {
        const addOutturnClearingFields = require('./migrations/add_outturn_clearing_fields');
        await addOutturnClearingFields.up();
        console.log('✅ Migration 51: Outturn clearing fields added (is_cleared, cleared_at, cleared_by, remaining_bags)');
      } catch (error) {
        console.log('⚠️ Migration 51 warning:', error.message);
      }

      // Migration 52: Add is_direct_load column to rice_stock_locations
      // Adds support for "Direct Load" location type for temporary single-day use
      try {
        const addIsDirectLoadToRiceStockLocations = require('./migrations/52_add_is_direct_load_to_rice_stock_locations');
        await addIsDirectLoadToRiceStockLocations.up();
        console.log('✅ Migration 52: is_direct_load column added to rice_stock_locations');
      } catch (error) {
        console.log('⚠️ Migration 52 warning:', error.message);
      }

      // Migration 53: Create rice varieties table
      // Adds RiceVariety model and initial seed varieties
      try {
        const createRiceVarietiesTable = require('./migrations/53_create_rice_varieties');
        const queryInterface = sequelize.getQueryInterface();
        await createRiceVarietiesTable.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 53: Rice varieties table created with initial seed data');
      } catch (error) {
        console.log('⚠️ Migration 53 warning:', error.message);
      }

      // Migration 54: Seed DIRECT_LOAD rice stock location
      // Adds a special location for direct loading that doesn't carry forward stock
      try {
        const seedDirectLoad = require('./migrations/54_seed_direct_load');
        const queryInterface = sequelize.getQueryInterface();
        await seedDirectLoad.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 54: DIRECT_LOAD location seeded');
      } catch (error) {
        console.log('⚠️ Migration 54 warning:', error.message);
      }

      // Migration 55: Add closed_remaining_bags to kunchinittus
      try {
        const addClosedRemainingBags = require('./migrations/55_add_closed_remaining_bags');
        const queryInterface = sequelize.getQueryInterface();
        await addClosedRemainingBags.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 55: closed_remaining_bags field added to kunchinittus');
      } catch (error) {
        console.log('⚠️ Migration 55 warning:', error.message);
      }

      // Migration 56: Relax Packaging Constraints
      try {
        const relaxPackagingConstraints = require('./migrations/56_relax_packaging_constraints');
        const queryInterface = sequelize.getQueryInterface();
        await relaxPackagingConstraints.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 56: Packaging constraints relaxed');
      } catch (error) {
        console.log('⚠️ Migration 56 warning:', error.message);
      }

      // Migration 56.5: Add grams_report to quality_parameters
      try {
        const addGramsReportToQuality = require('./migrations/add_grams_report_to_quality');
        await addGramsReportToQuality();
        console.log('✅ Migration 56.5: grams_report column added');
      } catch (error) {
        console.log('⚠️ Migration 56.5 warning:', error.message);
      }

      // Migration 57: Add source_bags column to rice_stock_movements
      // Stores original source bags separately for Palti operations (30kg → 26kg conversions)
      try {
        const addSourceBagsToRiceStockMovements = require('./migrations/57_add_source_bags_to_rice_stock_movements');
        const queryInterface = sequelize.getQueryInterface();
        await addSourceBagsToRiceStockMovements.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 57: source_bags column added to rice_stock_movements');
      } catch (error) {
        console.log('⚠️ Migration 57 warning:', error.message);
      }

      // Migration 58: Backfill source_bags for existing Palti movements
      // Calculates source_bags from quintals for records where it was NULL
      try {
        const backfillSourceBagsForPalti = require('./migrations/58_backfill_source_bags_for_palti');
        const queryInterface = sequelize.getQueryInterface();
        await backfillSourceBagsForPalti.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 58: source_bags backfilled for existing Palti movements');
      } catch (error) {
        console.log('⚠️ Migration 58 warning:', error.message);
      }

      // Migration: Add description to other hamali entries
      try {
        const addDescription = require('./migrations/add_description_to_other_hamali_entries');
        const queryInterface = sequelize.getQueryInterface();
        await addDescription.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration: Description column added to other hamali entries');
      } catch (error) {
        console.log('⚠️ Migration (description) warning:', error.message);
      }

      // Migration: Add type to outturns
      try {
        const addTypeToOutturns = require('./migrations/add_type_to_outturns');
        await addTypeToOutturns.up();
        console.log('✅ Migration: Type column added to outturns');
      } catch (error) {
        console.log('⚠️ Migration (outturn type) warning:', error.message);
      }

      // Migration: Update yield percentage precision
      try {
        const updateYieldPrecision = require('./migrations/update_yield_percentage_precision');
        await updateYieldPrecision.up();
        console.log('✅ Migration: Yield percentage precision updated');
      } catch (error) {
        console.log('⚠️ Migration (yield precision) warning:', error.message);
      }

      // Migration: Create edit propagation logs
      try {
        const createEditLogs = require('./migrations/create_edit_propagation_logs');
        await createEditLogs();
        console.log('✅ Migration: Edit propagation logs table created');
      } catch (error) {
        console.log('⚠️ Migration (edit logs) warning:', error.message);
      }

      // Migration: Fix purchase rates null rate type
      try {
        const fixNullRateType = require('./migrations/fix_purchase_rates_null_rate_type');
        const queryInterface = sequelize.getQueryInterface();
        await fixNullRateType.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration: NULL rate types fixed in purchase rates');
      } catch (error) {
        console.log('⚠️ Migration (fix rate type) warning:', error.message);
      }
      // Migration 60: Rice Stock Variety Standardization
      try {
        const migration60 = require('./migrations/60_add_rice_stock_variety_standardization');
        await migration60.up();
        console.log('✅ Migration 60: Rice stock variety standardization completed');
      } catch (error) {
        console.log('⚠️ Migration 60 warning:', error.message);
      }

      // Migration 61: Add stock group index
      try {
        const migration61 = require('./migrations/61_add_stock_group_index');
        const queryInterface = sequelize.getQueryInterface();
        await migration61.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 61: Stock group index added');
      } catch (error) {
        console.log('⚠️ Migration 61 warning:', error.message);
      }

      // Migration 62: Add performance indexes
      try {
        const migration62 = require('./migrations/62_add_performance_indexes');
        const queryInterface = sequelize.getQueryInterface();
        await migration62.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 62: Performance indexes added');
      } catch (error) {
        console.log('⚠️ Migration 62 warning:', error.message);
      }

      // Migration 63: Add rate and amount columns to rice_hamali_entries
      try {
        console.log('🔄 Migration 63: Adding rate and amount columns to rice_hamali_entries...');

        // Check if columns already exist
        const [existingColumns] = await sequelize.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'rice_hamali_entries'
            AND column_name IN ('rate', 'amount')
        `);

        const hasRate = existingColumns.some(col => col.column_name === 'rate');
        const hasAmount = existingColumns.some(col => col.column_name === 'amount');

        if (hasRate && hasAmount) {
          console.log('✅ Migration 63: Rate and amount columns already exist, skipping');
        } else {
          // Add rate column if missing
          if (!hasRate) {
            await sequelize.query(`
              ALTER TABLE rice_hamali_entries
              ADD COLUMN rate DECIMAL(10, 2)
            `);
            console.log('  ✅ Rate column added');
          }

          // Add amount column if missing
          if (!hasAmount) {
            await sequelize.query(`
              ALTER TABLE rice_hamali_entries
              ADD COLUMN amount DECIMAL(10, 2)
            `);
            console.log('  ✅ Amount column added');
          }

          // Backfill existing entries
          await sequelize.query(`
            UPDATE rice_hamali_entries rhe
            SET 
              rate = rhr.rate_24_27,
              amount = (rhe.bags * rhr.rate_24_27)
            FROM rice_hamali_rates rhr
            WHERE rhe.rice_hamali_rate_id = rhr.id
              AND (rhe.rate IS NULL OR rhe.amount IS NULL)
          `);
          console.log('  ✅ Backfilled existing entries');

          // Make columns NOT NULL
          await sequelize.query(`
            ALTER TABLE rice_hamali_entries
            ALTER COLUMN rate SET NOT NULL
          `);
          await sequelize.query(`
            ALTER TABLE rice_hamali_entries
            ALTER COLUMN amount SET NOT NULL
          `);
          console.log('  ✅ Columns set to NOT NULL');

          // Add indexes
          try {
            await sequelize.query(`
              CREATE INDEX IF NOT EXISTS idx_rice_hamali_entries_rate 
              ON rice_hamali_entries(rate)
            `);
            await sequelize.query(`
              CREATE INDEX IF NOT EXISTS idx_rice_hamali_entries_amount 
              ON rice_hamali_entries(amount)
            `);
            console.log('  ✅ Indexes added');
          } catch (indexError) {
            console.log('  ℹ️ Indexes might already exist');
          }

          console.log('✅ Migration 63: Rice hamali rate and amount columns added successfully');
          console.log('  📝 Historical rates are now preserved!');
        }
      } catch (error) {
        console.log('⚠️ Migration 63 warning:', error.message);
      }

      // Migration 64: Create performance metrics table
      try {
        const createPerformanceMetricsTable = require('./migrations/64_create_performance_metrics_table');
        await createPerformanceMetricsTable.up();
        console.log('✅ Migration 64: Performance metrics table created');
      } catch (error) {
        console.log('⚠️ Migration 64 warning:', error.message);
      }

      // Migration 65: Add comprehensive performance indexes
      try {
        const addComprehensivePerformanceIndexes = require('./migrations/65_add_comprehensive_performance_indexes');
        await addComprehensivePerformanceIndexes.up();
      } catch (error) {
        console.log('⚠️ Migration 65 warning:', error.message);
      }

      // Migration 66: Fix performance indexes with correct column names
      try {
        const fixPerformanceIndexes = require('./migrations/66_fix_performance_indexes_correct_columns');
        await fixPerformanceIndexes.up(sequelize.getQueryInterface());
      } catch (error) {
        console.log('⚠️ Migration 66 warning:', error.message);
      }

      // Migration 67: Final performance indexes (schema-verified)
      try {
        const finalPerformanceIndexes = require('./migrations/67_final_performance_indexes_verified');
        await finalPerformanceIndexes.up(sequelize.getQueryInterface());
      } catch (error) {
        console.log('⚠️ Migration 67 warning:', error.message);
      }

      // Migration 68: Add purchase rate approval workflow columns
      try {
        const addPurchaseRateApprovalWorkflow = require('./migrations/68_add_purchase_rate_approval_workflow');
        const queryInterface = sequelize.getQueryInterface();
        await addPurchaseRateApprovalWorkflow.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 68: Purchase rate approval workflow columns added');
      } catch (error) {
        console.log('⚠️ Migration 68 warning:', error.message);
      }

      // Migration 69: Add status column to rice_hamali_entries
      try {
        const addStatusToRiceHamaliEntries = require('./migrations/69_add_status_to_rice_hamali_entries');
        await addStatusToRiceHamaliEntries();
      } catch (error) {
        console.log('⚠️ Migration 69 warning:', error.message);
      }

      // Migration 70: Add rejection columns to rice_stock_movements
      try {
        const addRejectionColumns = require('./migrations/70_add_rejection_columns_to_rice_stock_movements');
        await addRejectionColumns.up();
      } catch (error) {
        console.log('⚠️ Migration 70 warning:', error.message);
      }

      // Migration 71: Add rejection columns to hamali entries tables
      try {
        const addHamaliRejectionColumns = require('./migrations/71_add_rejection_columns_to_hamali_entries');
        await addHamaliRejectionColumns.up();
      } catch (error) {
        console.log('⚠️ Migration 71 warning:', error.message);
      }

      // Migration 72: Add performance indexes for outturn and purchase operations
      try {
        const addPerformanceIndexes = require('./migrations/72_add_performance_indexes_outturn_purchase');
        await addPerformanceIndexes.up();
      } catch (error) {
        console.log('⚠️ Migration 72 warning:', error.message);
      }

      // Migration 73: Add hamali book performance indexes
      try {
        const addHamaliBookPerformanceIndexes = require('./migrations/73_add_hamali_book_performance_indexes');
        await addHamaliBookPerformanceIndexes.up(sequelize.getQueryInterface(), sequelize.Sequelize);
        console.log('✅ Migration 73: Hamali Book performance indexes added');
      } catch (error) {
        console.log('⚠️ Migration 73 warning:', error.message);
      }

      // Migration 74: Add Sample Entry user roles
      try {
        const addSampleEntryUserRoles = require('./migrations/74_add_sample_entry_user_roles');
        await addSampleEntryUserRoles.up();
        console.log('✅ Migration 74: Sample Entry user roles added');
      } catch (error) {
        console.log('⚠️ Migration 74 warning:', error.message);
      }

      // Migration 75: Create sample_entries table
      try {
        const createSampleEntriesTable = require('./migrations/75_create_sample_entries_table');
        await createSampleEntriesTable.up();
        console.log('✅ Migration 75: sample_entries table created');
      } catch (error) {
        console.log('⚠️ Migration 75 warning:', error.message);
      }

      // Migration 76: Create quality_parameters table
      try {
        const createQualityParametersTable = require('./migrations/76_create_quality_parameters_table');
        await createQualityParametersTable.up();
        console.log('✅ Migration 76: quality_parameters table created');
      } catch (error) {
        console.log('⚠️ Migration 76 warning:', error.message);
      }

      // Migration 77: Create cooking_reports table
      try {
        const createCookingReportsTable = require('./migrations/77_create_cooking_reports_table');
        await createCookingReportsTable.up();
        console.log('✅ Migration 77: cooking_reports table created');
      } catch (error) {
        console.log('⚠️ Migration 77 warning:', error.message);
      }

      // Migration 78: Create lot_allotments table
      try {
        const createLotAllotmentsTable = require('./migrations/78_create_lot_allotments_table');
        await createLotAllotmentsTable.up();
        console.log('✅ Migration 78: lot_allotments table created');
      } catch (error) {
        console.log('⚠️ Migration 78 warning:', error.message);
      }

      // Migration 79: Create physical_inspections table
      try {
        const createPhysicalInspectionsTable = require('./migrations/79_create_physical_inspections_table');
        await createPhysicalInspectionsTable.up();
        console.log('✅ Migration 79: physical_inspections table created');
      } catch (error) {
        console.log('⚠️ Migration 79 warning:', error.message);
      }

      // Migration 80: Create inventory_data table
      try {
        const createInventoryDataTable = require('./migrations/80_create_inventory_data_table');
        await createInventoryDataTable.up();
        console.log('✅ Migration 80: inventory_data table created');
      } catch (error) {
        console.log('⚠️ Migration 80 warning:', error.message);
      }

      // Migration 81: Create financial_calculations table
      try {
        const createFinancialCalculationsTable = require('./migrations/81_create_financial_calculations_table');
        await createFinancialCalculationsTable.up();
        console.log('✅ Migration 81: financial_calculations table created');
      } catch (error) {
        console.log('⚠️ Migration 81 warning:', error.message);
      }

      // Migration 82: Create sample_entry_audit_logs table
      try {
        const createSampleEntryAuditLogsTable = require('./migrations/82_create_sample_entry_audit_logs_table');
        await createSampleEntryAuditLogsTable.up();
        console.log('✅ Migration 82: sample_entry_audit_logs table created');
      } catch (error) {
        console.log('⚠️ Migration 82 warning:', error.message);
      }

      // Migration 83: Create brokers table
      try {
        const createBrokersTable = require('./migrations/83_create_brokers_table');
        const queryInterface = sequelize.getQueryInterface();
        await createBrokersTable.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 83: Brokers table created');
      } catch (error) {
        console.log('⚠️ Migration 83 warning:', error.message);
      }

      // Migration 84: Add reported_by text field to quality_parameters
      try {
        const addReportedByField = require('./migrations/84_add_reported_by_text_to_quality_parameters');
        await addReportedByField.up();
        console.log('✅ Migration 84: reported_by field added to quality_parameters');
      } catch (error) {
        console.log('⚠️ Migration 84 warning:', error.message);
      }

      // Migration 85: Remove phoo column from quality_parameters
      try {
        const removePhooField = require('./migrations/85_remove_phoo_from_quality_parameters');
        await removePhooField.up();
        console.log('✅ Migration 85: phoo column removed from quality_parameters');
      } catch (error) {
        console.log('⚠️ Migration 85 warning:', error.message);
      }

      // Migration 86: Add offering price fields to sample_entries
      try {
        const addOfferingPriceFields = require('./migrations/86_add_offering_price_to_sample_entries');
        const queryInterface = sequelize.getQueryInterface();
        await addOfferingPriceFields.up(queryInterface);
        console.log('✅ Migration 86: offering price fields added to sample_entries');
      } catch (error) {
        console.log('⚠️ Migration 86 warning:', error.message);
      }

      // Migration 87: Enable multiple physical inspections per entry
      try {
        const enableMultipleInspections = require('./migrations/87_enable_multiple_physical_inspections');
        const queryInterface = sequelize.getQueryInterface();
        await enableMultipleInspections.up(queryInterface);
        console.log('✅ Migration 87: Multiple physical inspections enabled');
      } catch (error) {
        console.log('⚠️ Migration 87 warning:', error.message);
      }

      // Auto-fix: RJ Broken and Rejection Rice product types
      try {
        console.log('🔄 Auto-fixing product types (RJ Broken, Rejection Rice)...');
        await sequelize.query('ALTER TABLE rice_productions DROP CONSTRAINT IF EXISTS "rice_productions_producttype_check"');
        await sequelize.query(`ALTER TYPE "enum_rice_productions_productType" ADD VALUE IF NOT EXISTS 'RJ Broken'`);
        await sequelize.query(`ALTER TYPE "enum_rice_productions_productType" ADD VALUE IF NOT EXISTS 'Rejection Rice'`);
        await sequelize.query(`
          ALTER TABLE rice_productions 
          ADD CONSTRAINT "rice_productions_producttype_check" 
          CHECK ("productType"::text = ANY (ARRAY[
            'Rice'::text, 'Bran'::text, 'Farm Bran'::text, 'Rejection Rice'::text, 
            'Sizer Broken'::text, 'Rejection Broken'::text, 'RJ Broken'::text,
            'Broken'::text, 'Zero Broken'::text, 'Faram'::text, 'Unpolished'::text, 
            'RJ Rice 1'::text, 'RJ Rice 2'::text
          ]))
        `);
        console.log('✅ Auto-fix: RJ Broken and Rejection Rice added to product types');
      } catch (error) {
        console.log('⚠️ Product types auto-fix warning:', error.message);
      }

      // Migration 88: Add kunchinittu_id and outturn_id to inventory_data
      try {
        const addKunchinittuOutturnToInventoryData = require('./migrations/88_add_kunchinittu_outturn_to_inventory_data');
        await addKunchinittuOutturnToInventoryData.up();
        console.log('✅ Migration 88: kunchinittu_id and outturn_id added to inventory_data');
      } catch (error) {
        console.log('⚠️ Migration 88 warning:', error.message);
      }

      // Migration 89: Add lot selection fields to sample_entries
      try {
        const migration89 = require('./migrations/89_add_lot_selection_fields');
        const queryInterface = sequelize.getQueryInterface();
        await migration89.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 89: Lot selection fields added to sample_entries');
      } catch (error) {
        console.log('⚠️ Migration 89 warning:', error.message);
      }

      // Migration 90: Ultra-Performance Composite Indexes for 10 lakh records
      try {
        const ultraPerformanceIndexes = require('./migrations/90_ultra_performance_composite_indexes');
        const queryInterface = sequelize.getQueryInterface();
        await ultraPerformanceIndexes.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 90: Ultra-performance composite indexes added');
      } catch (error) {
        console.log('⚠️ Migration 90 warning:', error.message);
      }

      // Migration 91: Ultimate Performance Indexes (NEW - for 10 lakh records)
      try {
        const ultimateIndexes = require('./migrations/91_add_ultimate_performance_indexes');
        await ultimateIndexes.up();
        console.log('✅ Migration 91: Ultimate performance indexes added');
      } catch (error) {
        console.log('⚠️ Migration 91 warning:', error.message);
      }

      // Migration 92: Add allotted_bags to lot_allotments (for partial lot tracking)
      try {
        const { sequelize: seq } = require('./config/database');

        // Check if column exists
        const [results] = await seq.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'lot_allotments' 
          AND column_name = 'allotted_bags'
        `);

        if (results.length > 0) {
          console.log('✅ Migration 92: allotted_bags column already exists');
        } else {
          await seq.query(`
            ALTER TABLE lot_allotments 
            ADD COLUMN allotted_bags INTEGER
          `);
          console.log('✅ Migration 92: allotted_bags column added to lot_allotments');
        }
      } catch (error) {
        console.log('⚠️ Migration 92 warning:', error.message);
      }

      // Migration 93: Add close lot fields (inspected_bags, closed_at, closed_by_user_id, closed_reason)
      // CRITICAL: Without this, lot allotment queries fail with "column inspected_bags does not exist"
      try {
        const addCloseLotFields = require('./migrations/92_add_close_lot_fields');
        const queryInterface = sequelize.getQueryInterface();
        await addCloseLotFields.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 93: Close lot fields added to lot_allotments');
      } catch (error) {
        console.log('⚠️ Migration 93 warning:', error.message);
      }

      // Migration 94: 10 Lakh Performance — Composite indexes + pg_trgm trigram search
      try {
        const add10LakhCompositeIndexes = require('./migrations/94_add_10lakh_composite_indexes');
        await add10LakhCompositeIndexes.up();
        console.log('✅ Migration 94: 10 Lakh composite + trigram indexes added');
      } catch (error) {
        console.log('⚠️ Migration 94 warning:', error.message);
      }

      // Migration 95: Sample Workflow Enhancements (packaging, offerings, quality fields)
      try {
        const sampleWorkflowEnhancements = require('./migrations/95_add_sample_workflow_enhancements');
        await sampleWorkflowEnhancements.up();
        console.log('✅ Migration 95: Sample workflow enhancements completed');
      } catch (error) {
        console.log('⚠️ Migration 95 warning:', error.message);
      }

      console.log('✅ Migrations completed.');

      // Migration 96: Performance composite indexes for sample_entries (30 lakh optimization)
      try {
        const addSampleEntryPerformanceIndexes = require('./migrations/96_add_sample_entry_performance_indexes');
        await addSampleEntryPerformanceIndexes.up();
        console.log('✅ Migration 96: Sample entry performance indexes added');
      } catch (error) {
        console.log('⚠️ Migration 96 warning:', error.message);
      }

      // Migration 97: Add enhanced offering/final price fields to sample_entry_offerings
      try {
        const addOfferingFinalPriceFields = require('./migrations/97_add_offering_final_price_fields');
        const queryInterface = sequelize.getQueryInterface();
        await addOfferingFinalPriceFields.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 97: Enhanced offering/final price fields added');
      } catch (error) {
        console.log('⚠️ Migration 97 warning:', error.message);
      }

      // Migration 98: Manager Fallback Toggles
      try {
        const addManagerFallbackToggles = require('./migrations/98_add_manager_fallback_toggles');
        const queryInterface = sequelize.getQueryInterface();
        await addManagerFallbackToggles.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 98: Manager Fallback Toggles added');
      } catch (error) {
        console.log('⚠️ Migration 98 warning:', error.message);
      }

      // Migration 60: Sample Workflow Performance Indexes (runs after all schema migrations)
      try {
        const addSampleWorkflowIndexes = require('./migrations/60_add_sample_workflow_indexes');
        await addSampleWorkflowIndexes.up();
        console.log('✅ Migration 60: Sample workflow performance indexes added');
      } catch (error) {
        console.log('⚠️ Migration 60 warning:', error.message);
      }

      // Migration 99: Add dryMoisture to quality_parameters and qualityName to users
      try {
        const addDryMoistureAndQuality = require('./migrations/99_add_dry_moisture_and_quality_columns');
        await addDryMoistureAndQuality();
        console.log('✅ Migration 99: dryMoisture and qualityName columns added');
      } catch (error) {
        console.log('⚠️ Migration 99 warning:', error.message);
      }

      // Migration 108: Multi-offer support and paddy pricing fields
      try {
        const addMultiOfferFields = require('./migrations/108_add_multi_offer_fields');
        const queryInterface = sequelize.getQueryInterface();
        await addMultiOfferFields.up(queryInterface, sequelize.Sequelize);
        console.log('âœ… Migration 108: Multi-offer pricing fields added');
      } catch (error) {
        console.log('âš ï¸ Migration 108 warning:', error.message);
      }

      // Migration 109: Allow decimal payment condition values in sample_entry_offerings
      try {
        const makePaymentConditionDecimal = require('./migrations/109_make_payment_condition_decimal');
        const queryInterface = sequelize.getQueryInterface();
        await makePaymentConditionDecimal.up(queryInterface, sequelize.Sequelize);
        console.log('? Migration 109: payment_condition_value now supports decimals');
      } catch (error) {
        console.log('?? Migration 109 warning:', error.message);
      }

      // Migration 110: Add final_remarks to sample_entry_offerings
      try {
        const addFinalRemarksToOfferings = require('./migrations/110_add_final_remarks_to_sample_entry_offerings');
        const queryInterface = sequelize.getQueryInterface();
        await addFinalRemarksToOfferings.up(queryInterface, sequelize.Sequelize);
        console.log('Migration 110: final_remarks added to sample_entry_offerings');
      } catch (error) {
        console.log('Migration 110 warning:', error.message);
      }

      // Migration 111: Add 20M-scale sample workflow indexes
      try {
        const add20MIndexes = require('./migrations/111_add_sample_entry_20m_indexes');
        await add20MIndexes.up();
        console.log('Migration 111: 20M sample workflow indexes added');
      } catch (error) {
        console.log('Migration 111 warning:', error.message);
      }
      // Migration 96b: Add bend2 column to physical_inspections table
      try {
        const addBend2ToPhysicalInspections = require('./migrations/96_add_bend2_to_physical_inspections');
        const queryInterface = sequelize.getQueryInterface();
        await addBend2ToPhysicalInspections.up(queryInterface, sequelize.Sequelize);
        console.log('✅ Migration 96b: bend2 column added to physical_inspections');
      } catch (error) {
        console.log('⚠️ Migration 96b warning:', error.message);
      }

      // Migration 100: Add cooking_done_by column to cooking_reports
      try {
        const addCookingDoneBy = require('./migrations/100_add_cooking_done_by');
        await addCookingDoneBy.up();
        console.log('✅ Migration 100: cooking_done_by column added to cooking_reports');
      } catch (error) {
        console.log('⚠️ Migration 100 warning:', error.message);
      }

      // Migration 101: Allow NULL status in cooking_reports
      try {
        const allowNullStatus = require('./migrations/101_allow_null_status');
        await allowNullStatus.up();
        console.log('✅ Migration 101: status column now allows NULL in cooking_reports');
      } catch (error) {
        console.log('⚠️ Migration 101 warning:', error.message);
      }

      // Migration 102: Add cooking_approved_by
      try {
        const addCookingApprovedBy = require('./migrations/102_add_cooking_approved_by');
        await addCookingApprovedBy.up(sequelize.getQueryInterface(), sequelize.Sequelize);
        console.log('✅ Migration 102: cooking_approved_by column added');
      } catch (error) {
        console.log('⚠️ Migration 102 warning:', error.message);
      }

      // Migration 103: Add performance indexes for cooking reports
      try {
        const addCookingIndexes = require('./migrations/103_add_cooking_indexes');
        await addCookingIndexes.up(sequelize.getQueryInterface(), sequelize.Sequelize);
        console.log('✅ Migration 103: cooking search indexes added');
      } catch (error) {
        console.log('⚠️ Migration 103 warning:', error.message);
      }

      // Migration 104: Add RICE_SAMPLE to entry_type ENUM
      try {
        const addRiceSampleType = require('./migrations/104_add_rice_sample_type');
        await addRiceSampleType.up(sequelize.getQueryInterface(), sequelize.Sequelize);
        console.log('✅ Migration 104: RICE_SAMPLE added to entry_type enum');
      } catch (error) {
        console.log('⚠️ Migration 104 warning:', error.message);
      }

      // Migration 105: Add SOLDOUT to lot_selection_decision ENUM
      try {
        const addSoldOutToDecision = require('./migrations/105_add_soldout_to_lot_selection_decision');
        await addSoldOutToDecision.up(sequelize.getQueryInterface(), sequelize.Sequelize);
        console.log('✅ Migration 105: SOLDOUT added to lot_selection_decision enum');
      } catch (error) {
        console.log('⚠️ Migration 105 warning:', error.message);
      }

      // Migration 106: Add serial_no to sample_entries table
      try {
        const addSerialNo = require('./migrations/106_add_serial_no_to_sample_entries');
        await addSerialNo.up(sequelize.getQueryInterface(), sequelize.Sequelize);
        console.log('✅ Migration 106: serial_no added to sample_entries');
      } catch (error) {
        console.log('⚠️ Migration 106 warning:', error.message);
      }
      // Migration 107: Final Pass Lots performance indexes
      try {
        const addFinalPassLotsIndexes = require('./migrations/107_add_final_pass_lots_indexes');
        await addFinalPassLotsIndexes.up();
        console.log('✅ Migration 107: Final Pass Lots indexes added');
      } catch (error) {
        console.log('⚠️ Migration 107 warning:', error.message);
      }


      console.log('✅ All migrations + indexes completed.');
    }

    // Default warehouses removed - users should create their own warehouses

    // Create default users if they don't exist
    try {
      await require('./seeders/createDefaultUsers')();
    } catch (error) {
      console.log('⚠️ Default users creation warning:', error.message);
    }

    // AUTO-APPLY critical database indexes for 30 lakh record performance
    // Safe to run on every startup — uses IF NOT EXISTS
    try {
      const addCriticalIndexes = require('./scripts/add-critical-indexes');
      await addCriticalIndexes();
    } catch (error) {
      console.log('⚠️ Index creation warning:', error.message);
    }

    // Use the isVercel variable defined earlier
    if (!isVercel) {
      app.listen(PORT, () => {
        console.log(`🚀 Mother India Stock Management Server running on port ${PORT}`);
        console.log(`🌐 API Base URL: http://localhost:${PORT}/api`);
      });
    } else {
      console.log('✅ Exporting app for Vercel serverless environment.');
    }
  } catch (error) {
    console.error('❌ Unable to start server:', error);
    if (process.env.VERCEL !== '1') {
      process.exit(1);
    }
  }
};

startServer();

module.exports = app;

