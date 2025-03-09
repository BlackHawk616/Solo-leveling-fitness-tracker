import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Changed to text for Firebase ID
  email: text("email").notNull(),
  username: text("username").notNull(),
  level: integer("level").notNull().default(1),
  exp: integer("exp").notNull().default(0),
  totalWorkoutSeconds: integer("total_workout_seconds").notNull().default(0),
  currentWorkout: jsonb("current_workout")
});

export const workouts = pgTable("workouts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at").notNull()
});

export const insertUserSchema = createInsertSchema(users)
  .pick({
    email: true,
    username: true
  })
  .extend({
    email: z.string().email("Invalid email address")
  });

export const insertWorkoutSchema = z.object({
  name: z.string().min(1, "Name is required"),
  durationSeconds: z.number().min(30, "Workout must be at least 30 seconds"),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type InsertWorkout = z.infer<typeof insertWorkoutSchema>;

// Ranking system constants
export const ranks = [
  { name: "E Rank", minLevel: 1, maxLevel: 20 },
  { name: "D Rank", minLevel: 20, maxLevel: 40 },
  { name: "C Rank", minLevel: 40, maxLevel: 60 },
  { name: "B Rank", minLevel: 60, maxLevel: 80 },
  { name: "A Rank", minLevel: 80, maxLevel: 120 },
  { name: "S Rank", minLevel: 120, maxLevel: 200 },
  { name: "National Level", minLevel: 200, maxLevel: 300 },
  { name: "Mid Tier Monarch", minLevel: 300, maxLevel: 400 },
  { name: "Yogumunt", minLevel: 400, maxLevel: 500 },
  { name: "Architect", minLevel: 500, maxLevel: 650 },
  { name: "Amtares", minLevel: 650, maxLevel: 800 },
  { name: "Ashborn", minLevel: 800, maxLevel: 1500 },
  { name: "Sung Jinwo", minLevel: 1500, maxLevel: Infinity }
] as const;

export function calculateExpForLevel(level: number): number {
  return level <= 200 ? 50000 : 100000;
}

export function getRankForLevel(level: number) {
  return ranks.find(rank => level >= rank.minLevel && level < rank.maxLevel)!;
}