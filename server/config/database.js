const { Sequelize } = require('sequelize');

// Database configuration with performance optimizations
let dbUrl = process.env.DATABASE_URL;

// Sanitize the URL if it exists (remove quotes and whitespace)
if (dbUrl) {
  dbUrl = dbUrl.trim();
  if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
    dbUrl = dbUrl.slice(1, -1);
  }
}

if (dbUrl) {
  console.log('Attempting to connect with DATABASE_URL (masked):', dbUrl.replace(/:([^:@]+)@/, ':****@'));
} else {
  console.log('No DATABASE_URL found, using individual environment variables.');
}

const sequelize = dbUrl
  ? new Sequelize(dbUrl, {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    minifyAliases: true,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // Required for some PaaS providers like Render/Supabase
      },
      statement_timeout: 30000,           // Database-level timeout (30s)
      query_timeout: 25000,               // Sequelize-level timeout (25s) - fires before DB timeout
      idle_in_transaction_session_timeout: 60000,
      application_name: 'mother_india_stock_mgmt'
    },
    pool: {
      max: 50,  // Increased for 10 lakh records handling
      min: 10,  // Higher minimum for faster response under load
      acquire: 60000,
      idle: 10000,
      evict: 1000,
      maxUses: 2000  // Increased for high-volume operations
    },
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: true,
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    }
  })
  : new Sequelize({
    database: process.env.DB_NAME || 'mother_india',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '12345',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgresql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    minifyAliases: true,

    // Connection pool — tuned for 30 lakh records
    pool: {
      max: 20,   // 20 is optimal for PostgreSQL (CPU cores * 2 + spindle count)
      min: 5,    // Keep 5 warm connections
      acquire: 30000,
      idle: 10000,
      evict: 1000,
      maxUses: 5000
    },

    // Query optimization settings
    dialectOptions: {
      statement_timeout: 30000,           // Database-level timeout (30s)
      query_timeout: 25000,               // Sequelize-level timeout (25s) - fires before DB timeout
      idle_in_transaction_session_timeout: 60000,
      application_name: 'mother_india_stock_mgmt'
    },

    // Model defaults
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: true,
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    },

    // Performance settings — log slow queries (>500ms)
    benchmark: true,
    logging: (msg, timing) => {
      if (process.env.NODE_ENV === 'development') {
        if (timing > 500) console.warn(`\x1b[33m⚠ SLOW QUERY (${timing}ms):\x1b[0m`, msg);
      } else if (timing > 1000) {
        console.warn(`SLOW QUERY (${timing}ms):`, msg);
      }
    },
    logQueryParameters: process.env.NODE_ENV === 'development',

    // Retry configuration
    retry: {
      max: 3,
      match: [
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
        /TimeoutError/
      ]
    }
  });

module.exports = { sequelize };