import { User, Workout, InsertUser, InsertWorkout, users, workouts } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { db } from "./db";
import { eq, and, gte, lte } from "drizzle-orm";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByFirebaseId(firebaseId: string): Promise<User | undefined>;
  createUser(firebaseId: string, user: InsertUser): Promise<User>;
  updateUserExp(userId: string, expGained: number): Promise<User>;
  updateUsername(userId: string, username: string): Promise<User>;
  updateUserCurrentWorkout(userId: string, workout: { 
    name: string;
    startTime: number;
    elapsedSeconds: number;
  } | null): Promise<User>;

  createWorkout(userId: string, workout: InsertWorkout): Promise<Workout>;
  getWorkouts(userId: string): Promise<Workout[]>;
  getDailyWorkoutSeconds(userId: string, date: Date): Promise<number>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  readonly sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // 24 hours
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByFirebaseId(firebaseId: string): Promise<User | undefined> {
    return this.getUser(firebaseId);
  }

  async createUser(firebaseId: string, insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        id: firebaseId,
        ...insertUser,
        level: 1,
        exp: 0,
        totalWorkoutSeconds: 0
      })
      .returning();
    return user;
  }

  async updateUsername(userId: string, username: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ username })
      .where(eq(users.id, userId))
      .returning();

    if (!user) throw new Error("User not found");
    return user;
  }

  async updateUserExp(userId: string, expGained: number): Promise<User> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user) throw new Error("User not found");

    const newExp = user.exp + expGained;
    let newLevel = user.level;

    while (newExp >= calculateExpForLevel(newLevel)) {
      newLevel++;
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        exp: newExp,
        level: newLevel
      })
      .where(eq(users.id, userId))
      .returning();

    return updatedUser;
  }

  async createWorkout(userId: string, workout: InsertWorkout): Promise<Workout> {
    const [newWorkout] = await db
      .insert(workouts)
      .values({
        userId,
        ...workout
      })
      .returning();

    // Update user's total workout seconds
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user) throw new Error("User not found");

    await db
      .update(users)
      .set({
        totalWorkoutSeconds: user.totalWorkoutSeconds + workout.durationSeconds
      })
      .where(eq(users.id, userId));

    return newWorkout;
  }

  async getWorkouts(userId: string): Promise<Workout[]> {
    return db
      .select()
      .from(workouts)
      .where(eq(workouts.userId, userId))
      .orderBy(workouts.startedAt)
      .limit(10);
  }

  async getDailyWorkoutSeconds(userId: string, date: Date): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await db
      .select({ total: workouts.durationSeconds })
      .from(workouts)
      .where(
        and(
          eq(workouts.userId, userId),
          gte(workouts.startedAt, startOfDay),
          lte(workouts.startedAt, endOfDay)
        )
      );

    return result.reduce((acc, row) => acc + (row.total || 0), 0);
  }

  async updateUserCurrentWorkout(userId: string, workout: { 
    name: string;
    startTime: number;
    elapsedSeconds: number;
  } | null): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ currentWorkout: workout })
      .where(eq(users.id, userId))
      .returning();

    if (!user) throw new Error("User not found");
    return user;
  }
}

export const storage = new DatabaseStorage();

function calculateExpForLevel(level: number): number {
  return level <= 200 ? 50000 : 100000;
}