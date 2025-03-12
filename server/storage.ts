import { User, Workout, InsertUser, InsertWorkout, users, workouts } from "../shared/schema.js";
import session from "express-session";
import createMemoryStore from "memorystore";
import { getDb, getPool } from "./db.js";
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
      const result = await db.select().from(users).where(eq(users.id, id));
      return result[0];
    } catch (error) {
      console.error('Error in getUser:', error);
      throw error;
    }
  }

  async getUserByFirebaseId(firebaseId: string): Promise<User | undefined> {
    try {
      return this.getUser(firebaseId);
    } catch (error) {
      console.error('Error in getUserByFirebaseId:', error);
      throw error;
    }
  }

  async createUser(firebaseId: string, insertUser: InsertUser): Promise<User> {
    try {
      const pool = await getPool();

      // Check if user exists
      const [existingUsers] = await pool.query(
        'SELECT * FROM users WHERE id = ?',
        [firebaseId]
      );

      if (existingUsers && existingUsers.length > 0) {
        return existingUsers[0] as User;
      }

      // Insert new user
      const [result] = await pool.query(
        'INSERT INTO users (id, email, username, level, exp, total_workout_seconds) VALUES (?, ?, ?, ?, ?, ?)',
        [firebaseId, insertUser.email, insertUser.username, 1, 0, 0]
      );

      const [newUser] = await pool.query(
        'SELECT * FROM users WHERE id = ?',
        [firebaseId]
      );

      return newUser[0] as User;
    } catch (error) {
      console.error('Error in createUser:', error);
      throw error;
    }
  }

  async updateUsername(userId: string, username: string): Promise<User> {
    try {
      const pool = await getPool();
      await pool.query(
        'UPDATE users SET username = ? WHERE id = ?',
        [username, userId]
      );

      const [users] = await pool.query(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      );

      if (!users || users.length === 0) throw new Error("User not found");
      return users[0] as User;
    } catch (error) {
      console.error('Error in updateUsername:', error);
      throw error;
    }
  }

  async updateUserExp(userId: string, expGained: number): Promise<User> {
    try {
      const pool = await getPool();
      const [users] = await pool.query(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      );

      if (!users || users.length === 0) throw new Error("User not found");
      const user = users[0] as User;

      const newExp = user.exp + expGained;
      let newLevel = user.level;

      while (newExp >= calculateExpForLevel(newLevel)) {
        newLevel++;
      }

      await pool.query(
        'UPDATE users SET exp = ?, level = ? WHERE id = ?',
        [newExp, newLevel, userId]
      );

      const [updatedUsers] = await pool.query(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      );

      return updatedUsers[0] as User;
    } catch (error) {
      console.error('Error in updateUserExp:', error);
      throw error;
    }
  }

  async createWorkout(userId: string, workout: InsertWorkout): Promise<Workout> {
    try {
      const pool = await getPool();

      // Format dates to MySQL timestamp format
      const startedAtFormatted = workout.startedAt.toISOString().slice(0, 19).replace('T', ' ');
      const endedAtFormatted = workout.endedAt.toISOString().slice(0, 19).replace('T', ' ');

      await pool.query(
        'INSERT INTO workouts (user_id, name, duration_seconds, started_at, ended_at) VALUES (?, ?, ?, ?, ?)',
        [userId, workout.name, workout.durationSeconds, startedAtFormatted, endedAtFormatted]
      );

      const [users] = await pool.query(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      );

      if (!users || users.length === 0) throw new Error("User not found");
      const user = users[0] as User;

      // Ensure totalWorkoutSeconds is a valid number before adding
      const currentTotal = typeof user.total_workout_seconds === 'number' && !isNaN(user.total_workout_seconds) 
        ? user.total_workout_seconds 
        : 0;
      
      const durationToAdd = typeof workout.durationSeconds === 'number' && !isNaN(workout.durationSeconds)
        ? workout.durationSeconds
        : 0;
      
      const newTotal = currentTotal + durationToAdd;
      
      console.log('Updating total workout seconds:', {
        userId,
        currentTotal,
        durationToAdd,
        newTotal
      });
      
      await pool.query(
        'UPDATE users SET total_workout_seconds = ? WHERE id = ?',
        [newTotal, userId]
      );

      const [workouts] = await pool.query(
        'SELECT * FROM workouts WHERE user_id = ? ORDER BY started_at DESC LIMIT 1',
        [userId]
      );

      // Convert the MySQL datetime back to JavaScript Date objects
      const workout_result = {
        ...workouts[0],
        startedAt: new Date(workouts[0].started_at),
        endedAt: new Date(workouts[0].ended_at)
      } as Workout;

      return workout_result;
    } catch (error) {
      console.error('Error in createWorkout:', error);
      throw error;
    }
  }

  async getWorkouts(userId: string): Promise<Workout[]> {
    try {
      const pool = await getPool();
      const [workouts] = await pool.query(
        'SELECT * FROM workouts WHERE user_id = ? ORDER BY started_at DESC',
        [userId]
      );
      
      // Properly convert MySQL workout data to the expected Workout format
      return (workouts as any[]).map(workout => ({
        id: workout.id,
        userId: workout.user_id,
        name: workout.name,
        durationSeconds: workout.duration_seconds,
        startedAt: new Date(workout.started_at),
        endedAt: new Date(workout.ended_at)
      }));
    } catch (error) {
      console.error('Error in getWorkouts:', error);
      throw error;
    }
  }

  async getDailyWorkoutSeconds(userId: string, date: Date): Promise<number> {
    try {
      const pool = await getPool();
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const startFormatted = startOfDay.toISOString().slice(0, 19).replace('T', ' ');

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      const endFormatted = endOfDay.toISOString().slice(0, 19).replace('T', ' ');

      const [workouts] = await pool.query(
        'SELECT SUM(duration_seconds) as total FROM workouts WHERE user_id = ? AND started_at BETWEEN ? AND ?',
        [userId, startFormatted, endFormatted]
      );

      return workouts[0]?.total || 0;
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
      const pool = await getPool();
      await pool.query(
        'UPDATE users SET current_workout = ? WHERE id = ?',
        [workout ? JSON.stringify(workout) : null, userId]
      );

      const [users] = await pool.query(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      );

      if (!users || users.length === 0) throw new Error("User not found");
      return users[0] as User;
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