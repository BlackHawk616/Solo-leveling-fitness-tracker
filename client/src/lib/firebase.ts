
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, FacebookAuthProvider, TwitterAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
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
let app;
try {
  app = initializeApp(firebaseConfig);
  console.log('Firebase app initialized successfully');
} catch (error) {
  console.error('Firebase initialization error:', error);
  console.error('Firebase config issue. Check your environment variables and API keys.');
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Enable offline persistence
enableIndexedDbPersistence(db)
  .then(() => {
    console.log('Firebase persistence enabled');
  })
  .catch((err) => {
    console.error('Firebase persistence error:', err);
  });

// Auth providers
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();
const twitterProvider = new TwitterAuthProvider();

// Add scopes for additional user info if needed
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');

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

export { auth, db, storage, googleProvider, facebookProvider, twitterProvider };

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
