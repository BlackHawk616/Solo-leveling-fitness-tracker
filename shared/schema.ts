import { mysqlTable, varchar, int, serial, timestamp, json } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 128 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  username: varchar("username", { length: 255 }).notNull(),
  level: int("level").notNull().default(1),
  exp: int("exp").notNull().default(0),
  totalWorkoutSeconds: int("total_workout_seconds").notNull().default(0),
  currentWorkout: json("current_workout")
});

export const workouts = mysqlTable("workouts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  durationSeconds: int("duration_seconds").notNull(),
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

// Updated workout schema with proper date validation and numeric check
export const insertWorkoutSchema = createInsertSchema(workouts)
  .omit({ id: true })
  .extend({
    name: z.string().min(1, "Name is required"),
    durationSeconds: z.number()
      .min(1, "Workout must be at least 1 second")
      .refine(val => !isNaN(val), "Duration must be a valid number"),
    startedAt: z.union([
      z.date(),
      z.string().transform((str) => {
        const date = new Date(str);
        if (isNaN(date.getTime())) {
          throw new Error("Invalid startedAt date");
        }
        return date;
      })
    ]),
    endedAt: z.union([
      z.date(),
      z.string().transform((str) => {
        const date = new Date(str);
        if (isNaN(date.getTime())) {
          throw new Error("Invalid endedAt date");
        }
        return date;
      })
    ])
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