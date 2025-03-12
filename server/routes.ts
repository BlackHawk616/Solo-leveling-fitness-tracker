import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { insertWorkoutSchema } from "../shared/schema.js";

export async function registerRoutes(app: Express): Promise<Server> {
  // Temporary debug endpoint - REMOVE AFTER DEPLOYMENT DEBUG
  app.get("/api/debug-env", async (req, res) => {
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
      console.log('POST /api/users - Request body:', req.body);
      const { id, email, username } = req.body;

      if (!id) {
        console.error('Missing required field: id');
        return res.status(400).json({ message: "Missing required field: id" });
      }

      // Debug log for incoming data
      console.log('Attempting to create/fetch user with:', { id, email, username });

      try {
        const existingUser = await storage.getUserByFirebaseId(id);
        console.log('Existing user found:', existingUser);

        if (existingUser) {
          return res.json(existingUser);
        } else {
          try {
            const user = await storage.createUser(id, {
              email,
              username
            });
            console.log('Created new user:', user);
            return res.status(201).json(user);
          } catch (createError) {
            console.error('Error creating new user:', createError);
            return res.status(500).json({ 
              message: "Failed to create user", 
              error: createError instanceof Error ? createError.message : String(createError) 
            });
          }
        }
      } catch (lookupError) {
        console.error('Error looking up existing user:', lookupError);
        return res.status(500).json({ 
          message: "Failed to lookup user", 
          error: lookupError instanceof Error ? lookupError.message : String(lookupError) 
        });
      }
    } catch (error) {
      console.error('User creation error:', error);
      return res.status(500).json({ 
        message: "Failed to process user request", 
        error: error instanceof Error ? error.message : String(error) 
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
      res.status(500).json({ message: "Failed to update username" });
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
      res.status(500).json({ message: "Failed to create workout" });
    }
  });

  app.get("/api/workouts/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const workouts = await storage.getWorkouts(userId);
      res.json(workouts);
    } catch (error) {
      console.error('Workout fetch error:', error);
      res.status(500).json({ message: "Failed to fetch workouts" });
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
      res.status(500).json({ message: "Failed to update current workout" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}