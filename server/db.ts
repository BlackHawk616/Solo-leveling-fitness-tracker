import * as mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from "../shared/schema.js";
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Better logging of environment
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Running on Vercel:', process.env.VERCEL === '1' ? 'Yes' : 'No');

// Construct database URL from environment variables or use provided credentials
const DATABASE_URL = process.env.DATABASE_URL || "mysql://3FRs1u34xFeTyYH.root:U9vZRO8g03jvRKrA@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test";
console.log("Using DATABASE_URL:", DATABASE_URL.substring(0, 15) + "...");

if (!DATABASE_URL) {
  console.error('⚠️ DATABASE_URL environment variable is not set');
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create connection config with appropriate SSL settings
let config = {
  uri: DATABASE_URL,
};

// Add SSL configuration for Vercel environment
if (process.env.VERCEL === '1') {
  console.log('🔒 Adding SSL configuration for Vercel environment');
  config = {
    uri: DATABASE_URL,
    // Use explicit SSL config for TiDB on Vercel
    ssl: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
    }
  };
  
  // Log more details about the environment in Vercel
  console.log('Vercel region:', process.env.VERCEL_REGION || 'unknown');
  console.log('Node.js version:', process.version);
};

const parseDbUrl = (url: string) => {
  try {
    console.log('Parsing database URL, starts with:', url.substring(0, 15));

    // Expected format: mysql://{username}:{password}@{hostname}:{port}/{database}
    const regex = /mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
    const match = url.match(regex);

    if (!match) {
      console.error('❌ Connection string does not match the required pattern');
      console.error(`❌ Received URL starts with: ${url.substring(0, 15)}...`);
      throw new Error('Invalid MySQL connection string format');
    }

    const [, user, password, host, port, database] = match;

    console.log(`✅ Parsed connection details:`);
    console.log(`  - Host: ${host}`);
    console.log(`  - Port: ${port}`);
    console.log(`  - User: ${user}`);
    console.log(`  - Database: ${database}`);

    return {
      host,
      port: parseInt(port, 10),
      user,
      password,
      database,
    };
  } catch (error) {
    console.error('❌ Error parsing database URL:', error);
    throw error;
  }
};

// Create connection with retry logic
const createConnection = async (retries = 5): Promise<mysql.Pool> => {
  // Special handling for Vercel's serverless environment
  const isVercel = process.env.VERCEL === '1';

  try {
    const connectionConfig = parseDbUrl(DATABASE_URL);

    // Create connection pool with TiDB-specific settings
    const poolConfig = {
      host: connectionConfig.host,
      port: connectionConfig.port,
      user: connectionConfig.user,
      password: connectionConfig.password,
      database: connectionConfig.database,
      waitForConnections: true,
      connectTimeout: 15000, // 15 seconds
      timezone: '+00:00', // UTC timezone
      ssl: {
        // Always enable SSL for TiDB Cloud
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      }
    };

    // Add Vercel-specific configurations
    if (isVercel) {
      console.log('⚠️ Using Vercel-optimized connection settings');
      Object.assign(poolConfig, {
        connectionLimit: 1,
        maxIdle: 1,
        idleTimeout: 60000, // 60 seconds in serverless
        enableKeepAlive: false, // Disable keepalive for serverless
        acquireTimeout: 30000 // 30 second timeout on connection acquisition
      });
    } else {
      Object.assign(poolConfig, {
        connectionLimit: 5,
        maxIdle: 5, 
        idleTimeout: 30000, // 30 seconds
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000
      });
    }
    
    const pool = mysql.createPool(poolConfig);

    // Verify connection works with a simple query
    const connection = await pool.getConnection();
    try {
      // Run test query to verify connection
      const [rows] = await connection.query('SELECT 1 AS connected');
      if (Array.isArray(rows) && rows.length > 0) {
        console.log('✅ Successfully connected to the TiDB database!');
        console.log('✅ Test query result:', rows);
      } else {
        console.warn('⚠️ Database connection test query returned unexpected result:', rows);
      }
    } finally {
      connection.release();
    }

    return pool;
  } catch (err: any) {
    console.error(`❌ Database connection attempt failed (${retries} retries left):`, err.message);

    if (retries > 0) {
      // Use exponential backoff for retries
      const delay = Math.min(2000 * (2 ** (5 - retries)), 10000);
      console.log(`🔄 Retrying database connection in ${delay/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return createConnection(retries - 1);
    }

    console.error('❌ All database connection attempts failed');
    console.error('Please verify your DATABASE_URL environment variable');
    throw new Error(`Failed to connect to database after multiple attempts: ${err.message}`);
  }
};

// Export the pool and db with lazy initialization
let _pool: mysql.Pool | null = null;
let _db: any = null;

export const getPool = async () => {
  if (!_pool) {
    _pool = await createConnection();
  }
  return _pool;
};

export const getDb = async () => {
  if (!_db) {
    const pool = await getPool();
    _db = drizzle(pool, { schema, mode: 'default' });
  }
  return _db;
};

// Simple function to check if the database connection is working
export const checkDatabaseConnection = async (attempts = 1): Promise<boolean> => {
  try {
    const pool = await getPool();
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query('SELECT 1 AS connected');
      return Array.isArray(rows) && rows.length > 0;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(`❌ Database check failed (attempt ${attempts}):`, error);
    return false;
  }
};

// For compatibility with existing code
export const pool = {
  connect: async () => {
    const p = await getPool();
    return p.getConnection();
  },
  query: async (text: string, params?: any[]) => {
    const p = await getPool();
    return p.query(text, params || []);
  },
  end: async () => {
    if (_pool) {
      await _pool.end();
      _pool = null;
      _db = null;
    }
  }
};

// For compatibility with existing code using drizzle
export const db = {
  async query(...args: any[]) {
    const realDb = await getDb();
    return realDb.query(...args);
  },
  async select(...args: any[]) {
    const realDb = await getDb();
    return realDb.select(...args);
  },
  async insert(...args: any[]) {
    const realDb = await getDb();
    return realDb.insert(...args);
  },
  async update(...args: any[]) {
    const realDb = await getDb();
    return realDb.update(...args);
  },
  async delete(...args: any[]) {
    const realDb = await getDb();
    return realDb.delete(...args);
  }
};

// Create necessary tables if they don't exist yet
const initializeDatabase = async () => {
  try {
    const pool = await getPool();

    // Create users table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(128) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        level INT NOT NULL DEFAULT 1,
        exp INT NOT NULL DEFAULT 0,
        total_workout_seconds INT NOT NULL DEFAULT 0,
        current_workout JSON
      )
    `);
    console.log('✅ Users table initialized');

    // Create workouts table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workouts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(128) NOT NULL,
        name VARCHAR(255) NOT NULL,
        duration_seconds INT NOT NULL,
        started_at TIMESTAMP NOT NULL,
        ended_at TIMESTAMP NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('✅ Workouts table initialized');

    return true;
  } catch (error) {
    console.error('❌ Failed to initialize database tables:', error);
    return false;
  }
};

// Initialize tables when the module is imported
initializeDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
});

// Track if we're already closing the pool
let isClosingPool = false;

// Properly close the connection when the server is shutting down
process.on('SIGINT', () => {
  if (!isClosingPool) {
    isClosingPool = true;
    console.log('Closing database pool...');
    pool.end();
  }
});

process.on('SIGTERM', () => {
  if (!isClosingPool) {
    isClosingPool = true;
    console.log('Closing database pool...');
    pool.end();
  }
});
