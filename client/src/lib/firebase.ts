import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
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

// Initialize Firebase with error handling
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Initialize Firestore with settings
const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED
});

const storage = getStorage(app);

// Configure Firestore for offline persistence and better caching
enableIndexedDbPersistence(db, {
  synchronizeTabs: true
}).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
  } else if (err.code === 'unimplemented') {
    console.warn('The current browser does not support persistence.');
  }
});


// Auth providers setup
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