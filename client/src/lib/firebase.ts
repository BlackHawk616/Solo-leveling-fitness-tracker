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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);
const googleProvider = new GoogleAuthProvider();

// Enable persistence
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('Firebase persistence enabled');
  })
  .catch((error) => {
    console.error('Firebase persistence error:', error);
  });

console.log('Firebase initialized successfully');

// Helper types for data structure
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