import { User, Workout, InsertUser, InsertWorkout, users, workouts } from "../shared/schema.js";
import session from "express-session";
import createMemoryStore from "memorystore";
import { getDb } from "./db.js";
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
    try {
      const db = await getDb();
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error('Error in getUser:', error);
      throw error;
    }
  }

  async getUserByFirebaseId(firebaseId: string): Promise<User | undefined> {
    try {
      // Firebase ID is stored in the id field
      return this.getUser(firebaseId);
    } catch (error) {
      console.error('Error in getUserByFirebaseId:', error);
      throw error;
    }
  }

  async createUser(firebaseId: string, insertUser: InsertUser): Promise<User> {
    try {
      const db = await getDb();
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, firebaseId));

      if (existingUser) {
        return existingUser;
      }

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
    } catch (error) {
      console.error('Error in createUser:', error);
      throw error;
    }
  }

  async updateUsername(userId: string, username: string): Promise<User> {
    try {
      const db = await getDb();
      const [user] = await db
        .update(users)
        .set({ username })
        .where(eq(users.id, userId))
        .returning();

      if (!user) throw new Error("User not found");
      return user;
    } catch (error) {
      console.error('Error in updateUsername:', error);
      throw error;
    }
  }

  async updateUserExp(userId: string, expGained: number): Promise<User> {
    try {
      const db = await getDb();
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
    } catch (error) {
      console.error('Error in updateUserExp:', error);
      throw error;
    }
  }

  async createWorkout(userId: string, workout: InsertWorkout): Promise<Workout> {
    try {
      const db = await getDb();
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
    } catch (error) {
      console.error('Error in createWorkout:', error);
      throw error;
    }
  }

  async getWorkouts(userId: string): Promise<Workout[]> {
    try {
      const db = await getDb();
      return db
        .select()
        .from(workouts)
        .where(eq(workouts.userId, userId))
        .orderBy(workouts.startedAt);
    } catch (error) {
      console.error('Error in getWorkouts:', error);
      throw error;
    }
  }

  async getDailyWorkoutSeconds(userId: string, date: Date): Promise<number> {
    try {
      const db = await getDb();
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
    } catch (error) {
      console.error('Error in getDailyWorkoutSeconds:', error);
      throw error;
    }
  }

  async updateUserCurrentWorkout(userId: string, workout: { 
    name: string;
    startTime: number;
    elapsedSeconds: number;
  } | null): Promise<User> {
    try {
      const db = await getDb();
      const [user] = await db
        .update(users)
        .set({ currentWorkout: workout })
        .where(eq(users.id, userId))
        .returning();

      if (!user) throw new Error("User not found");
      return user;
    } catch (error) {
      console.error('Error in updateUserCurrentWorkout:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();

function calculateExpForLevel(level: number): number {
  return level <= 200 ? 50000 : 100000;
}