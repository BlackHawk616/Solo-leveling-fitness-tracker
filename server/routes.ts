import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWorkoutSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Temporary debug endpoint - REMOVE AFTER DEPLOYMENT DEBUG
  app.get("/api/debug-env", (req, res) => {
    const hasDbUrl = !!process.env.DATABASE_URL;
    const dbUrlLength = process.env.DATABASE_URL?.length || 0;
    const hasSslMode = process.env.DATABASE_URL?.includes('sslmode=require');

    res.json({
      hasDbUrl,
      dbUrlLength,
      hasSslMode,
      message: "Database configuration debug info"
    });
  });

  app.post("/api/users", async (req, res) => {
    try {
      const { firebaseId, email, username } = req.body;
      const existingUser = await storage.getUserByFirebaseId(firebaseId);

      if (existingUser) {
        res.json(existingUser);
      } else {
        const user = await storage.createUser(firebaseId, {
          email,
          username
        });
        res.status(201).json(user);
      }
    } catch (error) {
      console.error('User creation error:', error);
      res.status(500).json({ message: "Failed to create user" });
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