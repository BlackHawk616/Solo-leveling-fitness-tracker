import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  level: integer("level").notNull().default(1),
  exp: integer("exp").notNull().default(0),
  totalWorkoutSeconds: integer("total_workout_seconds").notNull().default(0)
});

export const workouts = pgTable("workouts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at").notNull()
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true
});

export const insertWorkoutSchema = createInsertSchema(workouts).pick({
  name: true,
  durationSeconds: true,
  startedAt: true,
  endedAt: true
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type InsertWorkout = z.infer<typeof insertWorkoutSchema>;

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
