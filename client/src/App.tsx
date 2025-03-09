import { Route, Router, Switch, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProtectedRoute } from "@/lib/protected-route";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/toaster";
import { useEffect } from "react";

const queryClient = new QueryClient();

// Router component with auth redirection
function AppRoutes() {
  const { user, firebaseUser, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  // Handle authentication redirection
  useEffect(() => {
    if (!isLoading) {
      if (firebaseUser && location === '/auth') {
        console.log('User is authenticated, redirecting to home');
        navigate('/');
      } else if (!firebaseUser && location === '/' && !isLoading) {
        console.log('User is not authenticated, redirecting to auth');
        navigate('/auth');
      }
    }
  }, [firebaseUser, location, isLoading, navigate]);

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/" component={HomePage} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}