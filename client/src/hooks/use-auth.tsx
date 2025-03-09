import { createContext, useContext, useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { 
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
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
  lastWorkoutTimestamp?: number;
  currentWorkout?: {
    name: string;
    startTime: number;
    elapsedSeconds: number;
  };
};

type AuthContextType = {
  user: UserData | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  error: Error | null;
  googleLoginMutation: any;
  logoutMutation: any;
  refreshUserData: () => Promise<void>;
  updateUserProfile: (data: Partial<UserData>) => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Function to fetch user data
  const fetchUserData = async (firebaseUser: FirebaseUser) => {
    if (!firebaseUser) return null;

    try {
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Convert Firestore timestamp to Date
        if (userData.createdAt && typeof userData.createdAt.toDate === 'function') {
          userData.createdAt = userData.createdAt.toDate();
        }
        return userData as UserData;
      } else {
        // Create basic user profile
        const basicUserData: UserData = {
          email: firebaseUser.email!,
          username: firebaseUser.displayName || "User",
          level: 1,
          exp: 0,
          totalWorkoutSeconds: 0,
          createdAt: new Date(),
          photoURL: firebaseUser.photoURL || undefined
        };

        await setDoc(userDocRef, basicUserData);
        return basicUserData;
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      throw err;
    }
  };

  // Update user profile function
  const updateUserProfile = async (data: Partial<UserData>) => {
    if (!firebaseUser || !user) throw new Error("Not authenticated");

    try {
      const userDocRef = doc(db, "users", firebaseUser.uid);
      await updateDoc(userDocRef, data);

      // Update local state
      setUser(prev => prev ? { ...prev, ...data } : null);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["auth", firebaseUser.uid] });

      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
    } catch (err) {
      console.error('Error updating profile:', err);
      throw err;
    }
  };

  const googleLoginMutation = useMutation({
    mutationFn: async () => {
      try {
        setError(null);
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        window.location.href = '/';
        return user;
      } catch (err) {
        console.error('Google sign-in error:', err);
        const firebaseError = err as { code?: string, message: string };
        let errorMessage = 'Failed to sign in with Google';

        if (firebaseError.code === 'auth/popup-closed-by-user') {
          errorMessage = 'Sign-in was cancelled';
        }

        throw new Error(errorMessage);
      }
    },
    onSuccess: () => {
      toast({
        title: "Login successful",
        description: "You have been logged in successfully.",
      });
    },
    onError: (error: Error) => {
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
      queryClient.clear();
      setUser(null);
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Logout failed",
        description: error.message,
      });
    },
  });

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setFirebaseUser(firebaseUser);

        if (firebaseUser) {
          const userData = await fetchUserData(firebaseUser);
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Auth state change error:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Function to refresh user data
  const refreshUserData = async () => {
    if (!firebaseUser) return;

    try {
      const freshUserData = await fetchUserData(firebaseUser);
      setUser(freshUserData);
    } catch (err) {
      console.error('Error refreshing user data:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isLoading,
        error,
        googleLoginMutation,
        logoutMutation,
        refreshUserData,
        updateUserProfile
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