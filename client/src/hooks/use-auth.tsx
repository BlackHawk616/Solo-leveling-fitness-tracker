import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

type UserData = {
  email: string;
  username: string;
  level: number;
  exp: number;
  totalWorkoutSeconds: number;
  createdAt: Date;
  photoURL?: string;
};

type AuthContextType = {
  user: UserData | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  error: Error | null;
  googleLoginMutation: any;
  logoutMutation: any;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Define mutations first, then use them in the provider value
  const googleLoginMutation = useMutation({
    mutationFn: async () => {
      console.log('Attempting Google Sign-in');
      try {
        // Clear any previous errors
        setError(null);

        // Sign in with Google popup
        const result = await signInWithPopup(auth, googleProvider);

        // This gives you a Google Access Token. You can use it to access the Google API.
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential?.accessToken;

        // The signed-in user info
        const user = result.user;
        console.log('Google login successful for user:', user.uid);
        
        // Navigate to home page after successful login
        window.location.href = '/';
        return user;
      } catch (err) {
        console.error('Google sign-in error:', err);
        // More detailed error logging
        if (err instanceof Error) {
          console.error('Error name:', err.name);
          console.error('Error message:', err.message);
        }

        const firebaseError = err as { code?: string, message: string };
        console.error('Firebase error code:', firebaseError.code);

        // Set a more user-friendly error message based on Firebase error codes
        let errorMessage = firebaseError.message;
        if (firebaseError.code === 'auth/popup-closed-by-user') {
          errorMessage = 'Sign-in popup was closed before completing the login process';
        } else if (firebaseError.code === 'auth/cancelled-popup-request') {
          errorMessage = 'Multiple popup requests were triggered. Only the latest will be displayed';
        } else if (firebaseError.code === 'auth/popup-blocked') {
          errorMessage = 'The popup was blocked by the browser. Please check your popup settings';
        } else if (firebaseError.code === 'auth/api-key-not-valid') {
          errorMessage = 'Firebase API key is invalid. Check your environment variables';
        } else if (firebaseError.code === 'auth/invalid-api-key') {
          errorMessage = 'Firebase API key is invalid. Check your environment variables';
        } else if (firebaseError.code === 'auth/configuration-not-found') {
          errorMessage = 'Firebase configuration is missing or incorrect';
        }

        setError(new Error(errorMessage));
        throw new Error(errorMessage);
      }
    },
    onSuccess: (user) => {
      console.log('Google login mutation successful, user:', user.uid);
      toast({
        title: "Login successful",
        description: "You have been logged in successfully.",
      });
    },
    onError: (error: Error) => {
      console.log('Google login mutation error handler:', error);
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message,
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await signOut(auth);
    },
    onSuccess: () => {
      console.log('Logged out successfully');
      queryClient.clear();
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
    },
    onError: (error: Error) => {
      console.error('Logout error:', error);
      toast({
        variant: "destructive",
        title: "Logout failed",
        description: error.message,
      });
    },
  });

  useEffect(() => {
    console.log('Setting up auth state listener');
    setIsLoading(true);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser?.email);
      setFirebaseUser(firebaseUser);

      try {
        if (firebaseUser) {
          // Get user data from Firestore with better error handling
          try {
            console.log('Fetching user document for:', firebaseUser.uid);
            const userDocRef = doc(db, "users", firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
              console.log('User data found:', userDoc.data());
              // Convert Firestore timestamp to Date if needed
              const userData = userDoc.data();
              if (userData.createdAt && typeof userData.createdAt.toDate === 'function') {
                userData.createdAt = userData.createdAt.toDate();
              }
              setUser(userData as UserData);
            } else {
              console.log('No user document found, creating basic profile');
              // Create basic user profile if Firestore doesn't have data
              const basicUserData: UserData = {
                email: firebaseUser.email!,
                username: firebaseUser.displayName || "User",
                level: 1,
                exp: 0,
                totalWorkoutSeconds: 0,
                createdAt: new Date(),
                photoURL: firebaseUser.photoURL || undefined
              };

              // Save user profile to Firestore
              try {
                await setDoc(doc(db, "users", firebaseUser.uid), basicUserData);
                console.log('Created new user profile in Firestore');
                setUser(basicUserData);
              } catch (err) {
                console.error('Error creating user profile:', err);
              }
            }
          } catch (err) {
            console.error('Error fetching user data:', err);
          }
        } else {
          console.log('No firebase user');
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    }, (error) => {
      console.error('Firebase auth state error:', error);
      setIsLoading(false);
      setError(error as Error);
    });

    return () => {
      console.log('Cleaning up auth state listener');
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isLoading,
        error,
        googleLoginMutation,
        logoutMutation
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}