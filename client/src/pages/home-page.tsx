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
import { Timer, Trophy, History, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [isTracking, setIsTracking] = useState(false);
  const [workoutName, setWorkoutName] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout>();
  const startTimeRef = useRef<Date>();

  const { data: workouts = [] } = useQuery<Workout[]>({
    queryKey: ["/api/workouts"]
  });

  const workoutMutation = useMutation({
    mutationFn: async (data: { name: string, durationSeconds: number }) => {
      const res = await apiRequest("POST", "/api/workouts", {
        name: data.name,
        durationSeconds: data.durationSeconds,
        startedAt: startTimeRef.current?.toISOString(),
        endedAt: new Date().toISOString()
      });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/workouts"], 
        (old: Workout[] = []) => [data.workout, ...old]
      );
      queryClient.setQueryData(["/api/user"], data.user);
      toast({
        title: "Workout Completed!",
        description: `Gained ${Math.floor((data.workout.durationSeconds / 3600) * 1000)} EXP`
      });
    }
  });

  const rank = getRankForLevel(user?.level ?? 1);
  const expForNextLevel = calculateExpForLevel(user?.level ?? 1);
  const expProgress = ((user?.exp ?? 0) / expForNextLevel) * 100;

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
    
    await workoutMutation.mutateAsync({
      name: workoutName,
      durationSeconds: elapsedSeconds
    });

    setWorkoutName("");
    setElapsedSeconds(0);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Fitness RPG</h1>
          <Button variant="outline" onClick={() => logoutMutation.mutate()}>
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid gap-8 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                {user?.username}'s Profile
              </CardTitle>
              <CardDescription>
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
                  <Progress value={expProgress} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-primary/5 rounded-lg">
                    <Trophy className="h-5 w-5 mx-auto mb-2 text-primary" />
                    <div className="font-medium">{rank.name}</div>
                  </div>
                  <div className="text-center p-4 bg-primary/5 rounded-lg">
                    <Timer className="h-5 w-5 mx-auto mb-2 text-primary" />
                    <div className="font-medium">
                      {formatDuration(user?.totalWorkoutSeconds ?? 0)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
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
                  <div className="text-4xl font-mono mb-4">
                    {formatDuration(elapsedSeconds)}
                  </div>
                  {!isTracking ? (
                    <Button onClick={startWorkout} className="w-full">
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

        <Card className="mt-8">
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
                  <div className="font-mono">
                    {formatDuration(workout.durationSeconds)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
