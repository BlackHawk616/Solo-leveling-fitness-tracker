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
import { ranks, getRankForLevel, calculateExpForLevel } from "@shared/schema";
import { formatDuration, formatDate } from "@/lib/workout";
import { Timer, Trophy, History, Crown, Star, Shield, Award, Swords, Zap,
  Flame, Sparkles, Gem, Diamond } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { playSuccessSound } from "@/lib/sounds";
import type { WorkoutData } from "@/lib/firebase";

// Rank icons mapping with diverse icons
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
  const { user, firebaseUser, logoutMutation, updateUserProfile, refreshUserData } = useAuth();
  const { toast } = useToast();
  const [isTracking, setIsTracking] = useState(false);
  const [workoutName, setWorkoutName] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const timerRef = useRef<NodeJS.Timeout>();
  const startTimeRef = useRef<Date>();

  // Fetch workouts
  const { data: workouts = [], refetch: refetchWorkouts } = useQuery({
    queryKey: ["workouts", firebaseUser?.uid],
    queryFn: async () => {
      if (!firebaseUser) return [];
      const response = await fetch(`/api/workouts/${firebaseUser.uid}`);
      if (!response.ok) throw new Error('Failed to fetch workouts');
      return response.json();
    },
    enabled: !!firebaseUser && !!user
  });

  // Username update mutation
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

  // Workout mutation
  const workoutMutation = useMutation({
    mutationFn: async (data: { name: string; durationSeconds: number }) => {
      if (!firebaseUser || !user) throw new Error("Not authenticated");

      const response = await fetch('/api/workouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: firebaseUser.uid,
          name: data.name,
          durationSeconds: data.durationSeconds,
          startedAt: startTimeRef.current || new Date(),
          endedAt: new Date()
        })
      });

      if (!response.ok) throw new Error('Failed to save workout');
      return response.json();
    },
    onSuccess: (data) => {
      playSuccessSound();
      toast({
        title: "Workout Completed!",
        description: `Gained ${data.expGained} EXP`
      });

      // Reset workout state
      setWorkoutName("");
      setElapsedSeconds(0);
      startTimeRef.current = undefined;

      // Refresh workouts and user data
      refetchWorkouts();
      refreshUserData();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save workout",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Save timer state periodically
  useEffect(() => {
    if (!isTracking || !startTimeRef.current) return;

    const saveTimerState = async () => {
      try {
        await updateUserProfile({
          currentWorkout: {
            name: workoutName,
            startTime: startTimeRef.current!.getTime(),
            elapsedSeconds
          }
        });
      } catch (error) {
        console.error('Failed to save timer state:', error);
      }
    };

    // Save immediately when starting
    saveTimerState();

    const saveInterval = setInterval(saveTimerState, 5000);
    return () => clearInterval(saveInterval);
  }, [isTracking, workoutName, elapsedSeconds, updateUserProfile]);

  // Restore timer state on mount
  useEffect(() => {
    if (!user?.currentWorkout || isTracking) return;

    const { name, startTime, elapsedSeconds: savedSeconds } = user.currentWorkout;

    // Calculate actual elapsed time including any time that passed while the page was closed
    const now = Date.now();
    const additionalSeconds = Math.floor((now - startTime) / 1000);
    const totalElapsedSeconds = savedSeconds + additionalSeconds;

    setWorkoutName(name);
    startTimeRef.current = new Date(startTime);
    setElapsedSeconds(totalElapsedSeconds);
    setIsTracking(true);

    // Resume timer
    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
  }, [user?.currentWorkout]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Handle username update
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

  // Start workout
  function startWorkout() {
    if (!workoutName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a workout name",
        variant: "destructive"
      });
      return;
    }

    startTimeRef.current = new Date();
    setIsTracking(true);
    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
  }

  // Stop workout
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
    } catch (error) {
      console.error("Failed to save workout:", error);
    }
  }

  const rank = getRankForLevel(user?.level ?? 1);
  const expForNextLevel = calculateExpForLevel(user?.level ?? 1);
  const expProgress = ((user?.exp ?? 0) / expForNextLevel) * 100;
  const rankStyle = rankStyles[rank.name];
  const RankIcon = rankStyle.icon;

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
                      {formatDate(workout.startedAt)}
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