import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Validate that the DATABASE_URL has sslmode=require
if (!process.env.DATABASE_URL.includes('sslmode=require')) {
  console.error('DATABASE_URL must include sslmode=require');
  throw new Error(
    "DATABASE_URL must include '?sslmode=require' for secure connections.",
  );
}

console.log('Attempting to connect to database...');

// Create a pooled connection URL for better connection management
let poolUrl = process.env.DATABASE_URL;
if (!poolUrl.includes('-pooler.')) {
  poolUrl = poolUrl.replace('.us-east-2', '-pooler.us-east-2');
}

export const pool = new Pool({ 
  connectionString: poolUrl,
  connectionTimeoutMillis: 10000, // Increased timeout
  max: 10, // Reduced max connections
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  allowExitOnIdle: true // Allow pool to exit when there are no connections
});

// Test the connection on startup
pool.connect().then((client) => {
  console.log('Successfully connected to the database');
  client.release(); // Important: release the client back to the pool
}).catch((err) => {
  console.error('Failed to connect to the database:', err.message);
  console.error('Please check your DATABASE_URL configuration');
  throw err;
});

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