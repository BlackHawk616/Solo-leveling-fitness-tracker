import { User, Workout, InsertUser, InsertWorkout } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserExp(userId: number, expGained: number): Promise<User>;

  createWorkout(userId: number, workout: InsertWorkout): Promise<Workout>;
  getWorkouts(userId: number): Promise<Workout[]>;
  getDailyWorkoutSeconds(userId: number, date: Date): Promise<number>;

  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private workouts: Map<number, Workout>;
  private currentUserId: number;
  private currentWorkoutId: number;
  readonly sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.workouts = new Map();
    this.currentUserId = 1;
    this.currentWorkoutId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = {
      id,
      ...insertUser,
      level: 1,
      exp: 0,
      totalWorkoutSeconds: 0
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserExp(userId: number, expGained: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    const newExp = user.exp + expGained;
    let newLevel = user.level;

    while (newExp >= calculateExpForLevel(newLevel)) {
      newLevel++;
    }

    const updatedUser: User = {
      ...user,
      exp: newExp,
      level: newLevel
    };

    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async createWorkout(userId: number, workout: InsertWorkout): Promise<Workout> {
    const id = this.currentWorkoutId++;
    const newWorkout: Workout = {
      id,
      userId,
      ...workout
    };
    this.workouts.set(id, newWorkout);
    return newWorkout;
  }

  async getWorkouts(userId: number): Promise<Workout[]> {
    return Array.from(this.workouts.values())
      .filter(workout => workout.userId === userId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, 10); // Limit to 10 entries
  }

  async getDailyWorkoutSeconds(userId: number, date: Date): Promise<number> {
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
}

export const storage = new MemStorage();

function calculateExpForLevel(level: number): number {
  return level <= 200 ? 50000 : 100000;
}