import { initializeApp } from "@firebase/app";
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from "@firebase/auth";
import { getFirestore } from "@firebase/firestore";
import { getAnalytics } from "@firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDEkXTy5zHU620bU-xdu27h-UQ2CCzLTfU",
  authDomain: "fitness-leveling01.firebaseapp.com",
  projectId: "fitness-leveling01",
  storageBucket: "fitness-leveling01.appspot.com",
  messagingSenderId: "475932739073",
  appId: "1:475932739073:web:9383f46747c68c14d06200",
  measurementId: "G-7BB0H8VKKS"
};

let auth;
let db;
let analytics;
let googleProvider;

try {
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  analytics = getAnalytics(app);
  googleProvider = new GoogleAuthProvider();

  // Enable persistence
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      console.log('Firebase persistence enabled');
    })
    .catch((error) => {
      console.error('Firebase persistence error:', error);
    });

  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Firebase initialization error:', error);
}

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

export { auth, db, analytics, googleProvider };