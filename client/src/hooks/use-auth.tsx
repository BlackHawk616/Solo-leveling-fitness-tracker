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
import { doc, setDoc, getDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { auth, db, UserData, WorkoutData } from "@/lib/firebase";
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      setIsLoading(true);

      if (firebaseUser) {
        // Get user data from Firestore
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          setUser(userDoc.data() as UserData);
        }
      } else {
        setUser(null);
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
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
      return userData;
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

  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      const { user: firebaseUser } = await signInWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
      if (!userDoc.exists()) {
        throw new Error("User data not found");
      }

      return userDoc.data() as UserData;
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