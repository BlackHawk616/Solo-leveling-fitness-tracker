import { User, Workout, InsertUser, InsertWorkout } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private workouts: Map<string, Workout>;
  private currentId: number;
  readonly sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.workouts = new Map();
    this.currentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // 24 hours
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByFirebaseId(firebaseId: string): Promise<User | undefined> {
    // Since firebaseId is now our main user ID, this is the same as getUser
    return this.getUser(firebaseId);
  }

  async createUser(firebaseId: string, insertUser: InsertUser): Promise<User> {
    const user: User = {
      id: firebaseId, // Use firebaseId as the user ID
      ...insertUser,
      level: 1,
      exp: 0,
      totalWorkoutSeconds: 0,
      currentWorkout: null
    };
    this.users.set(firebaseId, user);
    return user;
  }

  async updateUsername(userId: string, username: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    const updatedUser = {
      ...user,
      username
    };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updateUserExp(userId: string, expGained: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    const newExp = user.exp + expGained;
    let newLevel = user.level;

    // Calculate level based on exp
    while (newExp >= calculateExpForLevel(newLevel)) {
      newLevel++;
    }

    const updatedUser = {
      ...user,
      exp: newExp,
      level: newLevel
    };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async createWorkout(userId: string, workout: InsertWorkout): Promise<Workout> {
    const workoutId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newWorkout: Workout = {
      id: workoutId,
      userId,
      ...workout
    };
    this.workouts.set(workoutId, newWorkout);

    // Update user's total workout seconds
    const user = await this.getUser(userId);
    if (user) {
      const updatedUser = {
        ...user,
        totalWorkoutSeconds: (user.totalWorkoutSeconds || 0) + workout.durationSeconds
      };
      this.users.set(userId, updatedUser);
    }

    return newWorkout;
  }

  async getWorkouts(userId: string): Promise<Workout[]> {
    return Array.from(this.workouts.values())
      .filter(workout => workout.userId === userId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, 10); // Limit to 10 entries
  }

  async getDailyWorkoutSeconds(userId: string, date: Date): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return Array.from(this.workouts.values())
      .filter(workout => 
        workout.userId === userId &&
        workout.startedAt >= startOfDay &&
        workout.startedAt <= endOfDay
      )
      .reduce((acc, workout) => acc + workout.durationSeconds, 0);
  }

  async updateUserCurrentWorkout(userId: string, workout: { 
    name: string;
    startTime: number;
    elapsedSeconds: number;
  } | null): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    const updatedUser = {
      ...user,
      currentWorkout: workout
    };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }
}

export const storage = new MemStorage();

function calculateExpForLevel(level: number): number {
  return Math.floor(Math.pow(level, 1.8) * 1000);
}