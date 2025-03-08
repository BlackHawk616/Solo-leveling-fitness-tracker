import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertWorkoutSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  app.post("/api/workouts", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const workout = insertWorkoutSchema.parse(req.body);
    
    // Check daily limit (6 hours = 21600 seconds)
    const today = new Date();
    const dailySeconds = await storage.getDailyWorkoutSeconds(req.user.id, today);
    if (dailySeconds + workout.durationSeconds > 21600) {
      return res.status(400).send("Daily workout limit (6 hours) exceeded");
    }

    const newWorkout = await storage.createWorkout(req.user.id, workout);
    
    // Award EXP (1 hour = 3600 seconds = 1000 EXP)
    const expGained = Math.floor((workout.durationSeconds / 3600) * 1000);
    const updatedUser = await storage.updateUserExp(req.user.id, expGained);
    
    res.status(201).json({ workout: newWorkout, user: updatedUser });
  });

  app.get("/api/workouts", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const workouts = await storage.getWorkouts(req.user.id);
    res.json(workouts);
  });

  const httpServer = createServer(app);
  return httpServer;
}
