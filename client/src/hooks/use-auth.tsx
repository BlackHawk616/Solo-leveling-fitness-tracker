import { createContext, useContext, useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { UserData } from "@/lib/firebase";

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

  // Function to fetch user data from our backend
  const fetchUserData = async (firebaseUser: FirebaseUser) => {
    if (!firebaseUser) return null;

    try {
      console.log('Fetching user data for:', firebaseUser.uid);
      const token = await firebaseUser.getIdToken(true); // Force refresh token
      
      console.log('Got token, making API request to /api/users');
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: firebaseUser.uid,
          email: firebaseUser.email,
          username: firebaseUser.displayName || 'User',
          photoURL: firebaseUser.photoURL
        })
      });

      console.log('API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch user data:', errorText);
        throw new Error(`Failed to fetch user data: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('User data retrieved successfully');
      return data;
    } catch (err) {
      console.error('Error fetching user data:', err);
      // Additional detailed logging
      if (err instanceof Error) {
        console.error('Error details:', err.message);
        if (err.stack) console.error('Stack trace:', err.stack);
      }
      throw err;
    }
  };

  // Update user profile function
  const updateUserProfile = async (data: Partial<UserData>) => {
    if (!firebaseUser) throw new Error("Not authenticated");

    try {
      const token = await firebaseUser.getIdToken(true);

      if (data.username) {
        const response = await fetch(`/api/users/${firebaseUser.uid}/username`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ username: data.username })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to update username:', errorText);
          throw new Error(`Failed to update username: ${errorText}`);
        }
        const updatedUser = await response.json();
        setUser(updatedUser);
        queryClient.invalidateQueries({ queryKey: ['user', firebaseUser.uid] });
      }

      if (data.currentWorkout !== undefined) {
        const response = await fetch(`/api/users/${firebaseUser.uid}/current-workout`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ workout: data.currentWorkout })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to update current workout:', errorText);
          throw new Error(`Failed to update current workout: ${errorText}`);
        }
        const updatedUser = await response.json();
        setUser(updatedUser);
        queryClient.invalidateQueries({ queryKey: ['user', firebaseUser.uid] });
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      throw err;
    }
  };

  // Function to refresh user data
  const refreshUserData = async () => {
    if (!firebaseUser) return;
    try {
      const freshUserData = await fetchUserData(firebaseUser);
      setUser(freshUserData);
      queryClient.invalidateQueries({ queryKey: ['user', firebaseUser.uid] });
    } catch (err) {
      console.error('Error refreshing user data:', err);
      throw err;
    }
  };

  const googleLoginMutation = useMutation({
    mutationFn: async () => {
      try {
        setError(null);
        console.log('Starting Google sign-in process');
        const result = await signInWithPopup(auth, googleProvider);
        console.log('Google authentication successful, user:', result.user.uid);
        
        try {
          console.log('Fetching user data from backend');
          const userData = await fetchUserData(result.user);
          console.log('User data fetched successfully');
          setUser(userData);
          return { firebaseUser: result.user, userData };
        } catch (fetchErr) {
          console.error('Error fetching user data after successful Google login:', fetchErr);
          // Still set the Firebase user even if DB fetch fails
          setFirebaseUser(result.user);
          // Don't throw error here to allow login to continue
          setUser({
            id: result.user.uid,
            email: result.user.email,
            username: result.user.displayName || 'User',
            level: 1,
            exp: 0,
            totalWorkoutSeconds: 0,
            currentWorkout: null
          });
          toast({
            variant: "warning",
            title: "Partial login successful",
            description: "You're logged in but we couldn't retrieve your profile data. Some features may be limited.",
          });
          return { firebaseUser: result.user, userData: null };
        }
      } catch (err) {
        console.error('Google sign-in error:', err);
        const firebaseError = err as { code?: string, message: string };
        let errorMessage = 'Failed to sign in with Google';

        if (firebaseError.code === 'auth/unauthorized-domain') {
          errorMessage = 'This domain is not authorized for authentication. Please ensure it has been added to Firebase Console.';
        } else if (firebaseError.code === 'auth/popup-closed-by-user') {
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
      queryClient.invalidateQueries({ queryKey: ['user'] });
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
      setFirebaseUser(null);
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
          queryClient.invalidateQueries({ queryKey: ['user', firebaseUser.uid] });
        } else {
          setUser(null);
          queryClient.clear();
        }
      } catch (err) {
        console.error('Auth state change error:', err);
        setError(err as Error);
        toast({
          variant: "destructive",
          title: "Authentication Error",
          description: "Failed to retrieve user data. Please try again.",
        });
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

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