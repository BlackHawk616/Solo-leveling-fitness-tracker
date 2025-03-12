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

// Format database URL appropriately
let poolUrl = process.env.DATABASE_URL;

// Add sslmode if missing
if (!poolUrl.includes('sslmode=')) {
  poolUrl = poolUrl.includes('?') 
    ? `${poolUrl}&sslmode=require` 
    : `${poolUrl}?sslmode=require`;
  console.log('Added sslmode=require to DATABASE_URL');
}

// Add pooler if missing (Neon specific optimization)
if (!poolUrl.includes('-pooler.') && poolUrl.includes('.us-east-2')) {
  poolUrl = poolUrl.replace('.us-east-2', '-pooler.us-east-2');
  console.log('Added pooler to DATABASE_URL for better connection management');
}

console.log('Attempting to connect to database...');
console.log('Database URL format:', poolUrl.substring(0, 20) + '...' + (poolUrl.includes('sslmode=require') ? ' (with SSL)' : ' (without SSL)'));

// Create connection pool with retry logic
const createPool = (retries = 3) => {
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
        return new Promise(resolve => setTimeout(resolve, 2000))
          .then(() => createPool(retries - 1));
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

// For backward compatibility
export const pool = {
  connect: async () => {
    const p = await getPool();
    return p.connect();
  },
  query: async (...args: any[]) => {
    const p = await getPool();
    return p.query(...args);
  },
  end: async () => {
    if (_pool) {
      await _pool.end();
      _pool = null;
      _db = null;
    }
  }
};

// Create the drizzle client with the pool
export const db = drizzle(pool, { schema });

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