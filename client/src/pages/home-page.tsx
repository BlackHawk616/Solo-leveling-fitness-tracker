import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Workout, ranks, getRankForLevel, calculateExpForLevel } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDuration, formatDate } from "@/lib/workout";
import { Timer, Trophy, History, Crown, Star, Shield, Award, Swords, Zap,
  Flame, Sparkles, Gem, Diamond } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { playSuccessSound } from "@/lib/sounds";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, orderBy, limit, getDocs, doc, updateDoc } from "firebase/firestore";
import { WorkoutData } from "@/lib/firebase";
import { updateUserProfile } from "@/lib/user"; // Assuming this function exists

// Update rank icons mapping with more diverse icons
const rankStyles = {
  "E Rank": { icon: Shield, color: "text-gray-400", bg: "bg-gray-400/10" },
  "D Rank": { icon: Shield, color: "text-bronze-400", bg: "bg-bronze-400/10" },
  "C Rank": { icon: Shield, color: "text-green-400", bg: "bg-green-400/10" },
  "B Rank": { icon: Shield, color: "text-blue-400", bg: "bg-blue-400/10" },
  "A Rank": { icon: Star, color: "text-yellow-400", bg: "bg-yellow-400/10" },
  "S Rank": { icon: Award, color: "text-purple-400", bg: "bg-purple-400/10" },
  "National Level": { icon: Swords, color: "text-red-400", bg: "bg-red-400/10" },
  "Mid Tier Monarch": { icon: Crown, color: "text-pink-400", bg: "bg-pink-400/10" },
  "Yogumunt": { icon: Zap, color: "text-indigo-400", bg: "bg-indigo-400/10" },
  "Architect": { icon: Sparkles, color: "text-cyan-400", bg: "bg-cyan-400/10" },
  "Amtares": { icon: Flame, color: "text-emerald-400", bg: "bg-emerald-400/10" },
  "Ashborn": { icon: Gem, color: "text-orange-400", bg: "bg-orange-400/10" },
  "Sung Jinwo": { icon: Diamond, color: "text-purple-600", bg: "bg-purple-600/20" }
};

export default function HomePage() {
  const { user, firebaseUser, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [isTracking, setIsTracking] = useState(false);
  const [workoutName, setWorkoutName] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const timerRef = useRef<NodeJS.Timeout>();
  const startTimeRef = useRef<Date>();

  const { data: workouts = [], refetch: refetchWorkouts } = useQuery({
    queryKey: ["/workouts", firebaseUser?.uid],
    queryFn: async () => {
      if (!firebaseUser) return [];

      try {
        const workoutsRef = collection(db, "workouts");
        const q = query(
          workoutsRef,
          where("userId", "==", firebaseUser.uid),
          orderBy("startedAt", "desc"),
          limit(10)
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as WorkoutData[];
      } catch (error) {
        console.error('Error fetching workouts:', error);
        // Return empty array on error to prevent loops
        return [];
      }
    },
    enabled: !!firebaseUser && !!user, // Only run query when both user objects exist
    retry: 1, // Only retry once
    retryDelay: 3000, // Wait 3 seconds before retry
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    refetchOnMount: false, // Don't refetch when component mounts
    staleTime: 60000 // Data stays fresh for 1 minute
  });

  // Update the updateUsernameMutation to use the new updateUserProfile function
  const updateUsernameMutation = useMutation({
    mutationFn: async (newName: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateUserProfile({ username: newName });
      return newName;
    },
    onSuccess: () => {
      toast({
        title: "Username Updated",
        description: "Your username has been successfully updated."
      });
      setIsEditingUsername(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update username",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Update the workout mutation to properly handle Firebase persistence
  const workoutMutation = useMutation({
    mutationFn: async (data: { name: string, durationSeconds: number }) => {
      if (!firebaseUser || !user) throw new Error("Not authenticated");

      try {
        const workout: WorkoutData = {
          userId: firebaseUser.uid,
          name: data.name,
          durationSeconds: data.durationSeconds,
          startedAt: startTimeRef.current || new Date(),
          endedAt: new Date()
        };

        // Add workout to Firestore
        const workoutRef = await addDoc(collection(db, "workouts"), workout);

        // Calculate experience gained
        const expGained = Math.floor((data.durationSeconds / 3600) * 1000);

        // Update user stats
        await updateUserProfile({
          exp: user.exp + expGained,
          totalWorkoutSeconds: (user.totalWorkoutSeconds || 0) + data.durationSeconds,
          level: calculateNewLevel(user.exp + expGained),
          currentWorkout: null, // Clear current workout
          lastWorkoutTimestamp: Date.now()
        });

        return { workout: { ...workout, id: workoutRef.id }, expGained };
      } catch (error) {
        console.error('Error saving workout:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      refetchWorkouts();
      playSuccessSound();
      toast({
        title: "Workout Completed!",
        description: `Gained ${data.expGained} EXP`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save workout",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleUsernameUpdate = async () => {
    if (!newUsername.trim()) {
      toast({
        title: "Error",
        description: "Username cannot be empty",
        variant: "destructive"
      });
      return;
    }

    await updateUsernameMutation.mutateAsync(newUsername);
  };

  const rank = getRankForLevel(user?.level ?? 1);
  const expForNextLevel = calculateExpForLevel(user?.level ?? 1);
  const expProgress = ((user?.exp ?? 0) / expForNextLevel) * 100;
  const rankStyle = rankStyles[rank.name];
  const RankIcon = rankStyle.icon;

  // Add persistance for workout timer
  useEffect(() => {
    if (isTracking && user) {
      // Save current workout state to Firebase
      updateUserProfile({
        currentWorkout: {
          name: workoutName,
          startTime: startTimeRef.current?.getTime() || Date.now(),
          elapsedSeconds
        }
      }).catch(console.error);
    }
  }, [isTracking, elapsedSeconds, workoutName, user]);

  // Restore workout state on component mount
  useEffect(() => {
    if (user?.currentWorkout) {
      const { name, startTime, elapsedSeconds: savedSeconds } = user.currentWorkout;
      setWorkoutName(name);
      startTimeRef.current = new Date(startTime);
      setElapsedSeconds(savedSeconds);
      setIsTracking(true);

      // Resume timer
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [user?.currentWorkout]);


  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  function startWorkout() {
    if (!workoutName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a workout name",
        variant: "destructive"
      });
      return;
    }

    setIsTracking(true);
    startTimeRef.current = new Date();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
  }

  async function stopWorkout() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsTracking(false);

    try {
      await workoutMutation.mutateAsync({
        name: workoutName,
        durationSeconds: elapsedSeconds
      });

      setWorkoutName("");
      setElapsedSeconds(0);
    } catch (error) {
      console.error("Failed to save workout:", error);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
            Solo Leveling Fitness
          </h1>
          <Button variant="outline" onClick={() => logoutMutation.mutate()}>
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid gap-8 md:grid-cols-2">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RankIcon className={`h-6 w-6 ${rankStyle.color}`} />
                {isEditingUsername ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="Enter new username"
                      className="h-8 w-40"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleUsernameUpdate}
                      disabled={updateUsernameMutation.isPending}
                    >
                      {updateUsernameMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditingUsername(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <span>{user?.username || "User"}'s Profile</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 ml-2"
                      onClick={() => {
                        setNewUsername(user?.username || "");
                        setIsEditingUsername(true);
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 4 4" />
                      </svg>
                    </Button>
                  </>
                )}
              </CardTitle>
              <CardDescription className={`font-semibold ${rankStyle.color}`}>
                Level {user?.level} • {rank.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>EXP Progress</span>
                    <span>{user?.exp ?? 0} / {expForNextLevel}</span>
                  </div>
                  <Progress value={expProgress} className="bg-primary/20" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`text-center p-4 rounded-lg ${rankStyle.bg}`}>
                    <Trophy className={`h-5 w-5 mx-auto mb-2 ${rankStyle.color}`} />
                    <div className="font-medium">{rank.name}</div>
                  </div>
                  <div className={`text-center p-4 rounded-lg ${rankStyle.bg}`}>
                    <Timer className={`h-5 w-5 mx-auto mb-2 ${rankStyle.color}`} />
                    <div className="font-medium">
                      {formatDuration(user?.totalWorkoutSeconds ?? 0)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-primary" />
                Workout Timer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input
                  placeholder="Workout Name"
                  value={workoutName}
                  onChange={e => setWorkoutName(e.target.value)}
                  disabled={isTracking}
                />
                <div className="text-center">
                  <div className="text-4xl font-mono mb-4 text-primary">
                    {formatDuration(elapsedSeconds)}
                  </div>
                  {!isTracking ? (
                    <Button onClick={startWorkout} className="w-full bg-gradient-to-r from-primary to-purple-600">
                      Start Workout
                    </Button>
                  ) : (
                    <Button
                      onClick={stopWorkout}
                      variant="destructive"
                      className="w-full"
                    >
                      Stop Workout
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Workout History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {workouts.map(workout => (
                <div
                  key={workout.id}
                  className="flex items-center justify-between p-4 bg-primary/5 rounded-lg"
                >
                  <div>
                    <div className="font-medium">{workout.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(new Date(workout.startedAt))}
                    </div>
                  </div>
                  <div className="font-mono text-primary">
                    {formatDuration(workout.durationSeconds)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-8 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Available Ranks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ranks.map(rankInfo => {
                const style = rankStyles[rankInfo.name];
                const Icon = style.icon;
                return (
                  <div
                    key={rankInfo.name}
                    className={`p-4 rounded-lg ${style.bg} flex items-center gap-3`}
                  >
                    <Icon className={`h-5 w-5 ${style.color}`} />
                    <div>
                      <div className={`font-medium ${style.color}`}>{rankInfo.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Level {rankInfo.minLevel} - {rankInfo.maxLevel === Infinity ? '∞' : rankInfo.maxLevel}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function calculateNewLevel(totalExp: number): number {
  let level = 1;
  while (totalExp >= calculateExpForLevel(level)) {
    level++;
  }
  return level;
}