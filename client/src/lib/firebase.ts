import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDEkXTy5zHU620bU-xdu27h-UQ2CCzLTfU",
  authDomain: "fitness-leveling01.firebaseapp.com",
  projectId: "fitness-leveling01",
  storageBucket: "fitness-leveling01.appspot.com",
  messagingSenderId: "475932739073",
  appId: "1:475932739073:web:9383f46747c68c14d06200",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Initialize Firestore with persistence enabled
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager({})
  })
});

const storage = getStorage(app);

// Auth provider setup
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Helper types for data structure
export interface UserData {
  email: string;
  username: string;
  level: number;
  exp: number;
  totalWorkoutSeconds: number;
  createdAt: Date;
  photoURL?: string;
  lastWorkoutTimestamp?: number;
  currentWorkout?: {
    name: string;
    startTime: number;
    elapsedSeconds: number;
  };
}

export interface WorkoutData {
  userId: string;
  name: string;
  durationSeconds: number;
  startedAt: Date;
  endedAt: Date;
  id?: string;
}

export { auth, db, storage, googleProvider };