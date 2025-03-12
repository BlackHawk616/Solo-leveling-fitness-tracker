import React, { useState } from "react";
import { Route, RouteProps, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

type ProtectedRouteProps = RouteProps & {
  component: React.ComponentType<any>;
};

export function ProtectedRoute({
  component: Component,
  ...rest
}: ProtectedRouteProps) {
  const { user, firebaseUser, isLoading } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  // Handle redirection logic outside of render
  useEffect(() => {
    if (!isLoading && !user && !firebaseUser && !redirecting) {
      console.log("Protected route: No user found, redirecting to auth");
      setRedirecting(true);
      setTimeout(() => {
        window.location.href = '/auth';
      }, 100);
    }
  }, [user, firebaseUser, isLoading, redirecting]);

  return (
    <Route
      {...rest}
      component={(props: any) => {
        if (isLoading) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading your profile...</span>
            </div>
          );
        }

        if (!user && !firebaseUser) {
          return <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Redirecting to login...</span>
          </div>;
        }

        return <Component {...props} />;
      }}
    />
  );
}