import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDEkXTy5zHU620bU-xdu27h-UQ2CCzLTfU",
  authDomain: "fitness-leveling01.firebaseapp.com",
  projectId: "fitness-leveling01",
  storageBucket: "fitness-leveling01.appspot.com",
  messagingSenderId: "475932739073",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:475932739073:web:9383f46747c68c14d06200",
  measurementId: "G-7BB0H8VKKS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
export const googleProvider = new GoogleAuthProvider();

// Helper function to format user data for Firestore
export interface UserData {
  email: string;
  username: string;
  level: number;
  exp: number;
  totalWorkoutSeconds: number;
  createdAt: Date;
}

export interface WorkoutData {
  userId: string;
  name: string;
  durationSeconds: number;
  startedAt: Date;
  endedAt: Date;
}
