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
      const [rows] = await client.query('SELECT 1'); 
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

      if (!id || !email) {
        console.log('⚠️ Missing required user data', { id, email });
        return res.status(400).json({ message: 'Missing required user data' });
      }

      console.log('✅ Proceeding with user creation for Firebase ID:', id);

      // Enhanced error handling for database operations
      let dbConnectionOk = false;
      let dbPool = null;

      // Try connecting to database with several attempts
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          console.log(`🔌 Checking database connection (attempt ${attempt})...`);
          const { getPool } = await import('./db.js');
          dbPool = await getPool();

          // Extra verification of database connection
          const [rows] = await dbPool.query('SELECT 1 AS test');
          if (Array.isArray(rows) && rows.length > 0) {
            console.log('✅ Database connection fully verified with test query:', rows[0]);
            dbConnectionOk = true;
            break;
          } else {
            console.error('⚠️ Database connection test query returned no results');
          }
        } catch (dbError) {
          console.error(`❌ Database connection failed (attempt ${attempt}):`, dbError);

          if (attempt === 5) {
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

      // Now proceed with user lookup/creation with the storage interface
      try {
        console.log('🔍 Looking up or creating user with Firebase ID:', id);

        const userToCreate = {
          email,
          username: username || email.split('@')[0],
          photoURL 
        };

        const user = await storage.createUser(id, userToCreate);
        console.log('✅ Created new user successfully:', JSON.stringify(user));
        return res.status(201).json(user);
      } catch (userOpError) {
        console.error('❌ Error in user lookup/creation:', userOpError);
        return res.status(500).json({ 
          message: "Failed to create/lookup user", 
          error: userOpError instanceof Error ? userOpError.message : String(userOpError)
        });
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

      // Log the raw request data for debugging
      console.log('Received workout request data:', {
        body: req.body,
        userId: req.body.userId,
        durationSeconds: req.body.durationSeconds,
        startedAt: req.body.startedAt,
        endedAt: req.body.endedAt
      });

      // Validate the workout data using the updated schema
      try {
        // Ensure durationSeconds is a number
        if (typeof req.body.durationSeconds !== 'number') {
          req.body.durationSeconds = parseInt(req.body.durationSeconds, 10);
          if (isNaN(req.body.durationSeconds)) {
            throw new Error('Duration must be a valid number');
          }
        }
        
        // Log the duration for debugging
        console.log('Workout duration in seconds:', req.body.durationSeconds);
        
        // Make sure we have proper dates
        if (typeof req.body.startedAt === 'string' || typeof req.body.startedAt === 'number') {
          req.body.startedAt = new Date(req.body.startedAt);
        }
        
        if (typeof req.body.endedAt === 'string' || typeof req.body.endedAt === 'number') {
          req.body.endedAt = new Date(req.body.endedAt);
        }
        
        const workout = insertWorkoutSchema.parse(req.body);

        // Check daily limit (6 hours = 21600 seconds)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
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

        console.log('Creating workout with validated data:', {
          userId,
          name: workout.name,
          durationSeconds: workout.durationSeconds,
          startedAt: workout.startedAt.toISOString(),
          endedAt: workout.endedAt.toISOString()
        });

        const newWorkout = await storage.createWorkout(userId, workout);

        // Award EXP (1 hour = 3600 seconds = 1000 EXP)
        const expGained = Math.floor((workout.durationSeconds / 3600) * 1000);
        const updatedUser = await storage.updateUserExp(userId, expGained);

        console.log('Successfully created workout:', newWorkout);
        res.status(201).json({ workout: newWorkout, user: updatedUser });
      } catch (validationError) {
        console.error('Validation error:', validationError);
        return res.status(400).json({ 
          message: "Invalid workout data", 
          error: validationError instanceof Error ? validationError.message : String(validationError)
        });
      }
    } catch (error) {
      console.error('Workout creation error:', error);
      res.status(500).json({ 
        message: "Failed to create workout", 
        error: error instanceof Error ? error.message : String(error)
      }); 
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
            ); 
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
            );  
            console.log(`✅ Retrieved ${rows.length} workouts with fallback method`);
            return res.json(rows);
          } else {
            throw new Error('Database pool not available for fallback query');
          }
        } catch (fallbackError) {
          console.error('❌ All workout fetch methods failed:', fallbackError);
          throw dbError; 
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