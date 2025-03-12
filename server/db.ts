import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema.js";

// Configure WebSocket for Neon database
neonConfig.webSocketConstructor = ws;

// Better logging of environment
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Running on Vercel:', process.env.VERCEL === '1' ? 'Yes' : 'No');

// Check for DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('⚠️ DATABASE_URL environment variable is not set');
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use the provided Neon database URL
let poolUrl = process.env.DATABASE_URL;
console.log('Using Neon database credentials provided by user');

console.log('Attempting to connect to database...');
console.log('Database URL format:', poolUrl.substring(0, 20) + '...' + (poolUrl.includes('sslmode=require') ? ' (with SSL)' : ' (without SSL)'));

// Create connection pool with retry logic
const createPool = (retries = 3): Promise<Pool> => {
  const pool = new Pool({ 
    connectionString: poolUrl,
    connectionTimeoutMillis: 15000,  // Increased timeout for Vercel
    max: 10,
    idleTimeoutMillis: 30000,
    allowExitOnIdle: true
  });

  // Verify connection works
  return pool.connect()
    .then((client) => {
      console.log('✅ Successfully connected to the database!');
      client.release();
      return pool;
    })
    .catch((err) => {
      console.error(`❌ Database connection attempt failed (${retries} retries left):`, err.message);
      
      if (retries > 0) {
        console.log(`🔄 Retrying database connection in 2 seconds...`);
        return new Promise<Pool>(resolve => 
          setTimeout(() => resolve(createPool(retries - 1)), 2000)
        );
      }
      
      console.error('❌ All database connection attempts failed');
      console.error('Please verify your DATABASE_URL in Vercel environment variables');
      throw new Error(`Failed to connect to database after multiple attempts: ${err.message}`);
    });
};

// Export the pool and db with lazy initialization to help with Vercel cold starts
let _pool: Pool | null = null;
let _db: any = null;

export const getPool = async () => {
  if (!_pool) {
    _pool = await createPool();
  }
  return _pool;
};

export const getDb = async () => {
  if (!_db) {
    const pool = await getPool();
    _db = drizzle(pool, { schema });
  }
  return _db;
};

// For backward compatibility - Create a compatible interface
export const pool = {
  connect: async () => {
    const p = await getPool();
    if (!p) throw new Error("Failed to get pool");
    return p.connect();
  },
  query: async (text: string, params?: any[]) => {
    const p = await getPool();
    if (!p) throw new Error("Failed to get pool");
    return p.query(text, params);
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