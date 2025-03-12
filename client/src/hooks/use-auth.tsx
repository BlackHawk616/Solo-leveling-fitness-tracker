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

    // Retry mechanism for token issues
    const maxRetries = 3;
    let retryCount = 0;
    let lastError: any = null;

    while (retryCount <= maxRetries) {
      try {
        console.log(`[Auth] Fetching user data attempt ${retryCount + 1}/${maxRetries + 1} for:`, firebaseUser.uid);
        
        // Force token refresh on retries
        const token = await firebaseUser.getIdToken(retryCount > 0);
        console.log(`[Auth] Got token (${token.substring(0, 10)}...), length: ${token.length}`);
        
        // Prepare request data
        const userData = {
          id: firebaseUser.uid,
          email: firebaseUser.email || 'unknown@example.com', // Fallback email
          username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          photoURL: firebaseUser.photoURL
        };
        console.log('[Auth] User data to send:', userData);
        
        console.log('[Auth] Making API request to /api/users');
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Firebase-Token': token.substring(0, 20) + '...', // Truncated token for logs
            'X-Client-Version': '1.0.0', // Add version for debugging
            'X-Request-ID': `${Date.now()}-${Math.random().toString(36).substring(2, 9)}` // Unique request ID
          },
          body: JSON.stringify(userData)
        });

        console.log('[Auth] API response status:', response.status);
        
        if (!response.ok) {
          let errorText = '';
          try {
            // Try to parse as JSON first
            const errorJson = await response.json();
            errorText = JSON.stringify(errorJson);
          } catch {
            // If not JSON, get as text
            errorText = await response.text();
          }
          
          console.error(`[Auth] Failed to fetch user data (attempt ${retryCount + 1}):`, errorText);
          
          // Only retry on certain status codes or network errors
          if (response.status === 401 || response.status === 403 || response.status === 429 || response.status >= 500) {
            lastError = new Error(`Auth error: ${response.status} - ${errorText}`);
            retryCount++;
            
            // Exponential backoff
            const delay = Math.min(1000 * (2 ** retryCount), 8000);
            console.log(`[Auth] Retrying in ${delay}ms... (${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          throw new Error(`[Auth] Failed to fetch user data: ${response.status} - ${errorText}`);
        }

        // Successfully got a response, try to parse it
        try {
          const data = await response.json();
          console.log('[Auth] User data retrieved successfully:', data ? 'Data present' : 'Empty data');
          
          // Validate required fields in user data
          if (!data || !data.id || !data.email) {
            console.error('[Auth] Retrieved user data is incomplete:', data);
            throw new Error('Incomplete user data received from server');
          }
          
          console.log('[Auth] User authenticated and data loaded successfully');
          return data;
        } catch (parseError) {
          console.error('[Auth] Error parsing response JSON:', parseError);
          throw new Error('Invalid response format from server');
        }
      } catch (err) {
        console.error(`[Auth] Error fetching user data (attempt ${retryCount + 1}):`, err);
        lastError = err;
        
        // Additional detailed logging
        if (err instanceof Error) {
          console.error('[Auth] Error details:', err.message);
          if (err.stack) console.error('[Auth] Stack trace:', err.stack);
        }
        
        retryCount++;
        
        if (retryCount <= maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * (2 ** retryCount), 8000);
          console.log(`[Auth] Retrying in ${delay}ms... (${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // If we've exhausted all retries, throw the last error
    console.error('[Auth] All fetch user data attempts failed');
    throw lastError;
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
        
        // Set the Firebase user immediately to avoid auth state issues
        setFirebaseUser(result.user);
        
        // Make multiple attempts to fetch user data
        let userData = null;
        let fetchError = null;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            console.log(`Fetching user data from backend (attempt ${attempt})`);
            userData = await fetchUserData(result.user);
            console.log('User data fetched successfully on attempt', attempt);
            break; // Exit loop if successful
          } catch (fetchErr) {
            console.error(`Error fetching user data (attempt ${attempt}):`, fetchErr);
            fetchError = fetchErr;
            // Wait a bit before trying again
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
          }
        }
        
        if (userData) {
          // Successfully got user data
          setUser(userData);
          return { firebaseUser: result.user, userData };
        } else {
          // Create a fallback user object
          console.log('Using fallback user data after fetch failures');
          const fallbackUser = {
            id: result.user.uid,
            email: result.user.email || 'unknown@example.com',
            username: result.user.displayName || 'User',
            level: 1,
            exp: 0,
            totalWorkoutSeconds: 0,
            currentWorkout: null
          };
          
          // Try a direct user creation as last resort
          try {
            console.log('Attempting direct user creation as fallback');
            const response = await fetch('/api/users', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                id: result.user.uid,
                email: result.user.email || 'unknown@example.com',
                username: result.user.displayName || 'User',
              })
            });
            
            if (response.ok) {
              const createdUser = await response.json();
              console.log('Direct user creation successful:', createdUser);
              setUser(createdUser);
              return { firebaseUser: result.user, userData: createdUser };
            } else {
              console.error('Direct user creation failed:', await response.text());
            }
          } catch (createErr) {
            console.error('Error in direct user creation:', createErr);
          }
          
          // Fall back to client-side user if all attempts fail
          setUser(fallbackUser);
          toast({
            variant: "warning",
            title: "Partial login successful",
            description: "You're logged in but we couldn't fully sync your profile. Some features may be limited.",
          });
          return { firebaseUser: result.user, userData: fallbackUser };
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
    onSuccess: (data) => {
      console.log('Login mutation successful with data:', data?.userData ? 'User data present' : 'No user data');
      toast({
        title: "Login successful",
        description: "You have been logged in successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
    onError: (error: Error) => {
      console.error('Login mutation error:', error);
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