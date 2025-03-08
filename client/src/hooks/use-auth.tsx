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

  useEffect(() => {
    console.log('Setting up auth state listener');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser?.email);
      setFirebaseUser(firebaseUser);
      setIsLoading(true);

      try {
        if (firebaseUser) {
          // Get user data from Firestore
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            console.log('User data found:', userDoc.data());
            setUser(userDoc.data() as UserData);
          } else {
            console.log('No user data found');
            setUser(null);
          }
        } else {
          console.log('No firebase user');
          setUser(null);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError(error as Error);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      console.log('Attempting login:', data.email);
      try {
        const { user: firebaseUser } = await signInWithEmailAndPassword(
          auth,
          data.email,
          data.password
        );

        let userDoc = await getDoc(doc(db, "users", firebaseUser.uid));

        // If user data doesn't exist, create it (fix missing document issue)
        if (!userDoc.exists()) {
          console.warn("User document missing, creating new one...");
          const newUserData: UserData = {
            email: firebaseUser.email!,
            username: firebaseUser.displayName || "User",
            level: 1,
            exp: 0,
            totalWorkoutSeconds: 0,
            createdAt: new Date()
          };
          await setDoc(doc(db, "users", firebaseUser.uid), newUserData);
          userDoc = await getDoc(doc(db, "users", firebaseUser.uid)); // Fetch new document
        }

        console.log('Login successful:', firebaseUser.uid);
        return userDoc.data() as UserData;
      } catch (error: any) {
        console.error('Login error:', error);
        if (
          error.code === 'auth/invalid-email' || 
          error.code === 'auth/user-not-found' || 
          error.code === 'auth/wrong-password'
        ) {
          throw new Error('Invalid email or password');
        }
        throw error;
      }
    },
    onSuccess: (userData) => {
      setUser(userData);
      toast({
        title: "Login successful",
        description: "Welcome back!"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      console.log('Attempting registration:', data.email);
      try {
        const { user: newUser } = await createUserWithEmailAndPassword(
          auth,
          data.email,
          data.password
        );

        await updateProfile(newUser, {
          displayName: data.username
        });

        const userData: UserData = {
          email: data.email,
          username: data.username,
          level: 1,
          exp: 0,
          totalWorkoutSeconds: 0,
          createdAt: new Date()
        };

        await setDoc(doc(db, "users", newUser.uid), userData);
        console.log('User registered successfully:', newUser.uid);
        return userData;
      } catch (error: any) {
        console.error('Registration error:', error);
        if (error.code === 'auth/email-already-in-use') {
          throw new Error('This email is already registered. Please try logging in instead.');
        }
        throw error;
      }
    },
    onSuccess: (userData) => {
      setUser(userData);
      toast({
        title: "Registration successful",
        description: "Welcome to Solo Leveling Fitness!"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await signOut(auth);
    },
    onSuccess: () => {
      setUser(null);
      queryClient.clear();
      toast({
        title: "Logged out successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

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