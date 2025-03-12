
import React, { useState, useEffect } from 'react';
import { Route, RouteProps } from 'wouter';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface ProtectedRouteProps extends RouteProps {
  component: React.ComponentType<any>;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  component: Component,
  ...rest
}) => {
  const { user, firebaseUser, isLoading } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // Only redirect if we've confirmed user isn't logged in
    if (!isLoading && !user && !firebaseUser && !redirecting) {
      console.log("User is not authenticated, redirecting to auth");
      setRedirecting(true);
      // Use window.location instead of history to force a full page reload
      setTimeout(() => {
        window.location.href = '/auth';
      }, 100);
    }
  }, [user, firebaseUser, isLoading, redirecting]);

  return (
    <Route
      {...rest}
      component={(props) => {
        // Show loading while checking authentication
        if (isLoading) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Checking authentication...</span>
            </div>
          );
        }

        // If authenticated, render the protected component
        if (user || firebaseUser) {
          return <Component {...props} />;
        }

        // Show loading while redirecting
        return (
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Redirecting to login...</span>
          </div>
        );
      }}
    />
  );
};
