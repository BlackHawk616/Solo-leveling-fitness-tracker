import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

type UserData = {
  email: string;
  username: string;
  level: number;
  exp: number;
  totalWorkoutSeconds: number;
  createdAt: Date;
};

type AuthContextType = {
  user: UserData | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: any;
  logoutMutation: any;
  registerMutation: any;
};

type RegisterData = {
  email: string;
  password: string;
  username: string;
};

type LoginData = {
  email: string;
  password: string;
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
  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      console.log('Attempting login with:', data.email);
      try {
        // Clear any previous errors
        setError(null);
        
        // Add detailed logging
        console.log('Calling signInWithEmailAndPassword...');
        const userCredential = await signInWithEmailAndPassword(
          auth,
          data.email,
          data.password
        );
        console.log('Login successful for user:', userCredential.user.uid);
        return userCredential.user;
      } catch (err) {
        console.error('Firebase login error:', err);
        // More detailed error logging
        if (err instanceof Error) {
          console.error('Error name:', err.name);
          console.error('Error message:', err.message);
        }
        
        const firebaseError = err as { code?: string, message: string };
        console.error('Firebase error code:', firebaseError.code);
        
        // Set a more user-friendly error message based on Firebase error codes
        let errorMessage = firebaseError.message;
        if (firebaseError.code === 'auth/wrong-password' || firebaseError.code === 'auth/user-not-found') {
          errorMessage = 'Invalid email or password';
        } else if (firebaseError.code === 'auth/too-many-requests') {
          errorMessage = 'Too many failed login attempts. Please try again later';
        } else if (firebaseError.code === 'auth/invalid-credential') {
          errorMessage = 'Invalid login credentials. Please check your email and password.';
        }
        setError(new Error(errorMessage));
        throw new Error(errorMessage);
      }
    },
    onSuccess: (user) => {
      console.log('Login mutation successful, user:', user.uid);
      toast({
        title: "Login successful",
        description: "You have been logged in successfully.",
      });
    },
    onError: (error: Error) => {
      console.log('Login mutation error handler:', error);
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
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Logout failed",
        description: error.message,
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      console.log('Attempting registration:', data.email);
      try {
        // Clear any previous errors
        setError(null);
        
        // Create the user account
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          data.email,
          data.password
        );

        const user = userCredential.user;
        console.log('User account created:', user.uid);

        // Update profile with username
        try {
          await updateProfile(user, {
            displayName: data.username,
          });
          console.log('Profile updated with username');
        } catch (profileError) {
          console.error('Error updating profile:', profileError);
          // Continue even if profile update fails
        }

        // Create user document in Firestore
        try {
          const userData: UserData = {
            email: data.email,
            username: data.username,
            level: 1,
            exp: 0,
            totalWorkoutSeconds: 0,
            createdAt: new Date(),
          };

          const userDocRef = doc(db, "users", user.uid);
          await setDoc(userDocRef, userData);
          console.log('User document created in Firestore');
        } catch (firestoreError) {
          console.error('Error saving user data to Firestore:', firestoreError);
          // We don't throw here because the authentication succeeded
          // The auth state change handler will try to create the user doc again
        }

        return user;
      } catch (err) {
        console.error('Registration error:', err);
        const firebaseError = err as { code?: string, message: string };
        
        // Set more user-friendly error messages
        let errorMessage = firebaseError.message;
        if (firebaseError.code === 'auth/email-already-in-use') {
          errorMessage = 'This email is already registered. Please log in instead.';
        } else if (firebaseError.code === 'auth/weak-password') {
          errorMessage = 'Password is too weak. Please use a stronger password.';
        } else if (firebaseError.code?.includes('permission-denied')) {
          errorMessage = 'Permission denied. Please check your Firebase security rules.';
        }
        
        setError(new Error(errorMessage));
        throw new Error(errorMessage);
      }
    },
    onError: (error: Error) => {
      console.error('Registration error handler:', error);
      toast({
        variant: "destructive",
        title: "Registration failed",
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
                createdAt: new Date()
              };

              try {
                // Use set with merge option to handle potential race conditions
                await setDoc(userDocRef, basicUserData, { merge: true });
                console.log('Basic user profile created successfully');
                setUser(basicUserData);
              } catch (writeError) {
                console.error('Error creating user profile:', writeError);
                // Still set the user data locally even if the write fails
                setUser(basicUserData);
              }
            }
          } catch (dbError) {
            console.error('Error accessing Firestore:', dbError);
            // Provide minimal user data if Firestore access fails
            setUser({
              email: firebaseUser.email!,
              username: firebaseUser.displayName || "User",
              level: 1,
              exp: 0,
              totalWorkoutSeconds: 0,
              createdAt: new Date()
            } as UserData);
          }
        } else {
          console.log('No firebase user, clearing user state');
          setUser(null);
        }
      } catch (error) {
        console.error('Error in auth state change handler:', error);
        setError(error as Error);
        setUser(null);
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
        loginMutation,
        logoutMutation,
        registerMutation
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