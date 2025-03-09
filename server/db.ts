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

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 8000, // 8 second timeout
  max: 20 // Maximum number of clients in the pool
});

// Test the connection on startup
pool.connect().then(() => {
  console.log('Successfully connected to the database');
}).catch((err) => {
  console.error('Failed to connect to the database:', err.message);
  console.error('Please check your DATABASE_URL configuration');
  throw err;
});

export const db = drizzle({ client: pool, schema });