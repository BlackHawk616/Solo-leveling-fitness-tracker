import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { insertWorkoutSchema } from "../shared/schema.js";

export async function registerRoutes(app: Express): Promise<Server> {
  // Debug endpoint to check environment
  app.get('/api/debug-env', (req, res) => {
    console.log('Debug environment request received');
    res.json({
      env: process.env.NODE_ENV,
      headers: req.headers,
      timestamp: new Date().toISOString()
    });
  });

  // Token debug endpoint
  app.get('/api/debug-token', (req, res) => {
    const authHeader = req.headers.authorization || '';
    console.log('Token debug request received');

    // Only show token format, not the actual token for security
    const tokenFormat = authHeader.startsWith('Bearer ') 
      ? 'Valid Bearer format' 
      : 'Invalid format or missing token';

    const tokenLength = authHeader.replace('Bearer ', '').length;

    res.json({
      hasToken: !!authHeader,
      tokenFormat,
      tokenLength,
      timestamp: new Date().toISOString()
    });
  });

  // Temporary debug endpoint - REMOVE AFTER DEPLOYMENT DEBUG
  app.get("/api/debug-env-db", async (req, res) => {
    const hasDbUrl = !!process.env.DATABASE_URL;
    const dbUrlLength = process.env.DATABASE_URL?.length || 0;
    const hasSslMode = process.env.DATABASE_URL?.includes('sslmode=require');

    // Test database connection
    let dbConnection = false;
    let dbError = null;

    try {
      // Import getPool from db.ts
      const { getPool } = await import('./db.js');
      const pool = await getPool();
      const client = await pool.connect();
      const [rows] = await client.query('SELECT 1'); //Updated destructuring
      client.release();
      dbConnection = true;
    } catch (err) {
      dbError = err instanceof Error ? err.message : String(err);
    }

    res.json({
      hasDbUrl,
      dbUrlLength,
      hasSslMode,
      dbConnection,
      dbError,
      message: "Database configuration debug info"
    });
  });

  app.post("/api/users", async (req, res) => {
    try {
      console.log('🔍 Received user data request', req.body);
      const { id, email, username, photoURL } = req.body;

      // Log request details for debugging
      console.log('📄 Full request details:', {
        body: req.body,
        headers: req.headers,
        method: req.method,
        url: req.url,
        ip: req.ip,
        isVercel: process.env.VERCEL === '1' ? 'Yes' : 'No',
        nodeEnv: process.env.NODE_ENV || 'development'
      });

      // Log authorization header if present
      const authHeader = req.headers.authorization;
      console.log('🔑 Auth header present:', !!authHeader);
      if (authHeader) {
        console.log('🔑 Auth header length:', authHeader.length);
        console.log('🔑 Auth header type:', authHeader.startsWith('Bearer ') ? 'Bearer token' : 'Other format');
      }

      if (!id || !email) {
        console.log('⚠️ Missing required user data', { id, email });
        return res.status(400).json({ message: 'Missing required user data' });
      }
      
      // Proceed with user creation regardless of token verification
      // This ensures that users are created in the database after Firebase authentication
      console.log('✅ Proceeding with user creation for Firebase ID:', id);

      // Enhanced error handling for database operations
      let dbConnectionOk = false;
      let dbPool = null;

      // Try connecting to database with several attempts
      for (let attempt = 1; attempt <= 5; attempt++) {  // Increased to 5 attempts
        try {
          console.log(`🔌 Checking database connection (attempt ${attempt})...`);
          const { getPool } = await import('./db.js');
          dbPool = await getPool();
          
          // Extra verification of database connection
          const [rows] = await dbPool.query('SELECT 1 AS test'); // Updated destructuring
          if (Array.isArray(rows) && rows.length > 0) {
            console.log('✅ Database connection fully verified with test query:', rows[0]);
            dbConnectionOk = true;
            break;
          } else {
            console.error('⚠️ Database connection test query returned no results');
            // Continue to next attempt
          }
        } catch (dbError) {
          console.error(`❌ Database connection failed (attempt ${attempt}):`, dbError);

          if (attempt === 5) {
            console.error('🔍 DATABASE_URL present:', !!process.env.DATABASE_URL);
            if (process.env.DATABASE_URL) {
              console.error('🔍 DATABASE_URL length:', process.env.DATABASE_URL.length);
              console.error('🔍 DATABASE_URL format check:', 
                process.env.DATABASE_URL.startsWith('mysql://') ? 'Valid format' : 'Invalid format');
            }
            return res.status(503).json({ 
              message: "Failed to establish database connection", 
              environment: process.env.VERCEL === '1' ? 'Vercel' : 'Other', 
              nodeEnv: process.env.NODE_ENV || 'development'
            });
          }

          // Exponential backoff with jitter
          const baseDelay = Math.min(1000 * (2 ** attempt), 8000);
          const jitter = Math.floor(Math.random() * 1000);
          const delay = baseDelay + jitter;
          console.log(`🔄 Retrying database connection in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (!dbConnectionOk) {
        return res.status(503).json({ 
          message: "Failed to establish database connection", 
          environment: process.env.VERCEL === '1' ? 'Vercel' : 'Other',
          nodeEnv: process.env.NODE_ENV || 'development'
        });
      }

      // Now proceed with user lookup/creation with transaction for data consistency
      try {
        console.log('🔍 Looking up or creating user with Firebase ID:', id);

        // Try using a transaction for better reliability
        if (!dbPool) throw new Error("Database pool is not available");
        const client = await dbPool.connect();

        try {
          await client.query('BEGIN');

          // First check if user exists
          const [existingUsers] = await client.query(
            'SELECT * FROM "users" WHERE "id" = $1', 
            [id]
          ); //updated destructuring

          const existingUser = existingUsers[0];

          if (existingUser) {
            console.log('✅ Found existing user in transaction');
            await client.query('COMMIT');
            return res.json(existingUser);
          } else {
            console.log('🆕 Creating new user in transaction');
            // Insert new user directly with SQL to avoid any ORM issues
            const [userInsertResult] = await client.query(
              'INSERT INTO "users" ("id", "email", "username", "level", "exp", "totalWorkoutSeconds") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
              [id, email, username || email.split('@')[0], 1, 0, 0]
            ); //updated destructuring

            const newUser = userInsertResult[0];
            console.log('✅ Created new user via transaction:', newUser);

            await client.query('COMMIT');
            return res.status(201).json(newUser);
          }
        } catch (txError) {
          await client.query('ROLLBACK');
          console.error('❌ Transaction error:', txError);
          throw txError;
        } finally {
          client.release();
        }
      } catch (userOpError) {
        console.error('❌ Error in user lookup/creation:', userOpError);

        // Last resort fallback - try the original storage method
        try {
          console.log('🔄 Trying fallback method for user lookup/creation');

          // Debug storage object
          console.log('🔧 Storage methods available:', Object.keys(storage));

          const existingUser = await storage.getUserByFirebaseId(id);
          console.log('🔍 Existing user lookup result:', existingUser ? 'Found' : 'Not found');

          if (existingUser) {
            console.log('✅ Returning existing user data from fallback');
            return res.json(existingUser);
          } else {
            console.log('🆕 Creating new user with ID using fallback:', id);
            const userToCreate = {
              email,
              username: username || email.split('@')[0],
              photoURL 
            };

            const user = await storage.createUser(id, userToCreate);
            console.log('✅ Created new user successfully with fallback:', JSON.stringify(user));
            return res.status(201).json(user);
          }
        } catch (fallbackError) {
          console.error('❌ Fallback method also failed:', fallbackError);
          return res.status(500).json({ 
            message: "Failed to create/lookup user after multiple attempts", 
            error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
          });
        }
      }
    } catch (error) {
      console.error('User creation error:', error);
      return res.status(500).json({ 
        message: "Failed to process user request", 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  app.patch("/api/users/:userId/username", async (req, res) => {
    try {
      const { userId } = req.params;
      const { username } = req.body;

      const user = await storage.updateUsername(userId, username);
      res.json(user);
    } catch (error) {
      console.error('Username update error:', error);
      res.status(500).json({ message: "Failed to update username", error: error instanceof Error ? error.message : String(error) }); 
    }
  });

  app.post("/api/workouts", async (req, res) => {
    try {
      const { userId } = req.body;
      const workout = insertWorkoutSchema.parse(req.body);

      // Minimum workout duration: 30 seconds
      if (workout.durationSeconds < 30) {
        return res.status(400).json({ 
          message: "Workout must be at least 30 seconds long" 
        });
      }

      // Check daily limit (6 hours = 21600 seconds)
      const today = new Date();
      const dailySeconds = await storage.getDailyWorkoutSeconds(userId, today);
      if (dailySeconds + workout.durationSeconds > 21600) {
        return res.status(400).json({
          message: "Daily workout limit (6 hours) exceeded"
        });
      }

      // Check if we've reached the maximum allowed workouts
      const workouts = await storage.getWorkouts(userId);
      if (workouts.length >= 500) {
        return res.status(400).json({
          message: "Maximum workout history limit reached"
        });
      }

      const newWorkout = await storage.createWorkout(userId, workout);

      // Award EXP (1 hour = 3600 seconds = 1000 EXP)
      const expGained = Math.floor((workout.durationSeconds / 3600) * 1000);
      const updatedUser = await storage.updateUserExp(userId, expGained);

      res.status(201).json({ workout: newWorkout, user: updatedUser });
    } catch (error) {
      console.error('Workout creation error:', error);
      res.status(500).json({ message: "Failed to create workout", error: error instanceof Error ? error.message : String(error) }); 
    }
  });

  app.get("/api/workouts/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Log request details in Vercel environment
      if (process.env.VERCEL === '1') {
        console.log('🔍 Get workouts request for user:', userId);
        console.log('📄 Request headers:', req.headers);
        
        // Log authorization header if present
        const authHeader = req.headers.authorization;
        console.log('🔑 Auth header present:', !!authHeader);
        if (authHeader) {
          console.log('🔑 Auth header length:', authHeader.length);
          console.log('🔑 Auth header type:', authHeader.startsWith('Bearer ') ? 'Bearer token' : 'Other format');
        }
      }
      
      try {
        // Try direct database approach first when on Vercel for more reliability
        if (process.env.VERCEL === '1') {
          console.log('📊 Using direct database query for workouts in Vercel environment');
          const { getPool } = await import('./db.js');
          const pool = await getPool();

          if (pool) {
            const [rows] = await pool.query(
              'SELECT * FROM "workouts" WHERE "userId" = $1 ORDER BY "startedAt" DESC', 
              [userId]
            ); //updated destructuring
            console.log(`✅ Retrieved ${rows.length} workouts directly from database`);
            return res.json(rows);
          } else {
            console.log('⚠️ Pool not available, falling back to storage interface');
          }
        }
        
        // Standard approach through storage interface
        const workouts = await storage.getWorkouts(userId);
        console.log(`✅ Retrieved ${workouts.length} workouts via storage interface`);
        res.json(workouts);
      } catch (dbError) {
        console.error('❌ Database error fetching workouts:', dbError);

        // Try fallback approach if initial attempt failed
        try {
          console.log('🔄 Trying alternative workout fetch method');

          // Direct SQL query as last resort
          const { getPool } = await import('./db.js');
          const pool = await getPool();

          if (pool) {
            const [rows] = await pool.query(
              'SELECT * FROM "workouts" WHERE "userId" = $1 ORDER BY "startedAt" DESC', 
              [userId]
            );  //updated destructuring
            console.log(`✅ Retrieved ${rows.length} workouts with fallback method`);
            return res.json(rows);
          } else {
            throw new Error('Database pool not available for fallback query');
          }
        } catch (fallbackError) {
          console.error('❌ All workout fetch methods failed:', fallbackError);
          throw dbError; // Throw original error for consistent error messages
        }
      }
    } catch (error) {
      console.error('Workout fetch error:', error);
      res.status(500).json({ 
        message: "Failed to fetch workouts", 
        error: error instanceof Error ? error.message : String(error),
        environment: process.env.VERCEL === '1' ? 'Vercel' : 'Other',
        nodeEnv: process.env.NODE_ENV || 'development'
      }); 
    }
  });

  app.patch("/api/users/:userId/current-workout", async (req, res) => {
    try {
      const { userId } = req.params;
      const { workout } = req.body;

      const user = await storage.updateUserCurrentWorkout(userId, workout);
      res.json(user);
    } catch (error) {
      console.error('Current workout update error:', error);
      res.status(500).json({ message: "Failed to update current workout", error: error instanceof Error ? error.message : String(error) }); 
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}