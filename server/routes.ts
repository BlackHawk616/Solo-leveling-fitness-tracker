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
      // Import pool from db.ts
      const { pool } = await import('./db.js');
      const client = await pool.connect();
      await client.query('SELECT 1');
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
        ip: req.ip
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

      // Check for database connectivity before proceeding
      try {
        console.log('🔌 Checking database connection...');
        const { pool } = await import('./db.js');
        await pool.query('SELECT 1');
        console.log('✅ Database connection verified before user operation');
      } catch (dbError) {
        console.error('❌ Database connection failed:', dbError);
        console.error('🔍 DATABASE_URL present:', !!process.env.DATABASE_URL);
        if (process.env.DATABASE_URL) {
          console.error('🔍 DATABASE_URL length:', process.env.DATABASE_URL.length);
          console.error('🔍 DATABASE_URL format check:', 
            process.env.DATABASE_URL.startsWith('postgres://') || 
            process.env.DATABASE_URL.startsWith('postgresql://') ? 'Valid format' : 'Invalid format');
        }
        return res.status(503).json({ 
          message: "Database connection error", 
          error: dbError instanceof Error ? dbError.message : String(dbError) 
        });
      }

      // Now proceed with user lookup/creation
      try {
        console.log('🔍 Looking up user with Firebase ID:', id);
        
        // Debug storage object
        console.log('🔧 Storage methods available:', Object.keys(storage));
        
        const existingUser = await storage.getUserByFirebaseId(id);
        console.log('🔍 Existing user lookup result:', existingUser ? 'Found' : 'Not found');
        if (existingUser) {
          console.log('📝 Existing user data:', JSON.stringify(existingUser));
        }

        if (existingUser) {
          console.log('✅ Returning existing user data');
          return res.json(existingUser);
        } else {
          console.log('🆕 Creating new user with ID:', id);
          try {
            const userToCreate = {
              email,
              username: username || email.split('@')[0],
              photoURL 
            };
            console.log('📝 User data to create:', userToCreate);
            
            const user = await storage.createUser(id, userToCreate);
            console.log('✅ Created new user successfully:', JSON.stringify(user));
            return res.status(201).json(user);
          } catch (createError) {
            console.error('❌ Error creating new user:', createError);
            return res.status(500).json({ 
              message: "Failed to create user", 
              error: createError instanceof Error ? createError.message : String(createError),
              stack: createError instanceof Error ? createError.stack : undefined
            });
          }
        }
      } catch (lookupError) {
        console.error('❌ Error looking up existing user:', lookupError);
        return res.status(500).json({ 
          message: "Failed to lookup user", 
          error: lookupError instanceof Error ? lookupError.message : String(lookupError),
          stack: lookupError instanceof Error ? lookupError.stack : undefined
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
      const workouts = await storage.getWorkouts(userId);
      res.json(workouts);
    } catch (error) {
      console.error('Workout fetch error:', error);
      res.status(500).json({ message: "Failed to fetch workouts", error: error instanceof Error ? error.message : String(error) }); 
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