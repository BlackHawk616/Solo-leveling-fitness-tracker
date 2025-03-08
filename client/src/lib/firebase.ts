import { initializeApp } from "@firebase/app";
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence, signInWithPopup } from "@firebase/auth";
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

// Add scopes for additional user info if needed
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');
const googleProvider = new GoogleAuthProvider();

// Enable persistence
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('Firebase persistence enabled');
  })
  .catch((error) => {
    console.error('Firebase persistence error:', error);
    // Continue even if persistence fails
  });

// Add error handler to auth
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log('Firebase auth state changed - user is signed in:', user.uid);
  } else {
    console.log('Firebase auth state changed - user is signed out');
  }
}, (error) => {
  console.error('Firebase auth state observer error:', error);
});

console.log('Firebase initialized successfully with config:', JSON.stringify({
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain
}));

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

// Helper function for Google sign-in
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};