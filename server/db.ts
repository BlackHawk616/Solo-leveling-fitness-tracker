import * as mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from "../shared/schema.js";

// Better logging of environment
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Running on Vercel:', process.env.VERCEL === '1' ? 'Yes' : 'No');

// Set database URL from the TiDB Cloud connection string provided by the user
// mysql://3FRs1u34xFeTyYH.root:kQ1jo3PPyLgsnBJ4@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test
const DATABASE_URL = process.env.DATABASE_URL || "mysql://3FRs1u34xFeTyYH.root:kQ1jo3PPyLgsnBJ4@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test";

if (!DATABASE_URL) {
  console.error('⚠️ DATABASE_URL environment variable is not set');
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log('Using TiDB Cloud database credentials');

// Parse the database URL to extract connection parameters
const parseDbUrl = (url: string) => {
  try {
    // Expected format: mysql://{username}:{password}@{hostname}:{port}/{database}
    const regex = /mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
    const match = url.match(regex);
    
    if (!match) {
      throw new Error('Invalid MySQL connection string format');
    }
    
    const [, user, password, host, port, database] = match;
    
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

console.log('Attempting to connect to TiDB database...');
console.log('Database URL format:', DATABASE_URL.substring(0, 20) + '...');

// Create connection with retry logic
const createConnection = async (retries = 3): Promise<mysql.Pool> => {
  // Special handling for Vercel's serverless environment
  const isVercel = process.env.VERCEL === '1';
  
  try {
    const connectionConfig = parseDbUrl(DATABASE_URL);
    
    // Create connection pool
    const pool = mysql.createPool({
      host: connectionConfig.host,
      port: connectionConfig.port,
      user: connectionConfig.user,
      password: connectionConfig.password,
      database: connectionConfig.database,
      waitForConnections: true,
      connectionLimit: isVercel ? 1 : 10, // Lower connection limit in Vercel
      maxIdle: isVercel ? 1 : 10, // Lower max idle connections in Vercel
      idleTimeout: 60000, // 60 seconds
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      ssl: {} // Enable SSL
    });
    
    // Verify connection works
    const connection = await pool.getConnection();
    console.log('✅ Successfully connected to the TiDB database!');
    connection.release();
    
    return pool;
  } catch (err: any) {
    console.error(`❌ Database connection attempt failed (${retries} retries left):`, err.message);
    
    if (retries > 0) {
      // Use exponential backoff for retries
      const delay = Math.min(2000 * (2 ** (3 - retries)), 10000);
      console.log(`🔄 Retrying database connection in ${delay/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return createConnection(retries - 1);
    }
    
    console.error('❌ All database connection attempts failed');
    console.error('Please verify your DATABASE_URL environment variable');
    throw new Error(`Failed to connect to database after multiple attempts: ${err.message}`);
  }
};

// Export the pool and db with lazy initialization to help with Vercel cold starts
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

// Compatibility layer for the rest of the application
export const pool = {
  connect: async () => {
    const p = await getPool();
    if (!p) throw new Error("Failed to get pool");
    return p.getConnection();
  },
  query: async (text: string, params?: any[]) => {
    const p = await getPool();
    if (!p) throw new Error("Failed to get pool");
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

// Create the drizzle client with the getDb function
export const db = {
  // Proxy to forward all operations to the real db
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