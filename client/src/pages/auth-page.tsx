import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const { user, googleLoginMutation } = useAuth();
  const isLoading = googleLoginMutation.isPending;
  const errorMessage = googleLoginMutation.error?.message;

  // Redirect if already logged in
  if (user) {
    console.log("User already authenticated, redirecting to home");
    return <Redirect to="/" />;
  }

  const handleGoogleLogin = async () => {
    try {
      console.log("Starting Google login process");
      const result = await googleLoginMutation.mutateAsync();
      console.log("Login successful:", result);
      
      // Make sure we have user data before redirect
      if (result && (result.userData || result.firebaseUser)) {
        console.log("Login data verified, redirecting to home");
        // Use a longer delay to ensure state is fully updated
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      } else {
        console.warn("Login succeeded but no user data returned");
      }
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle className="text-2xl">Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <Button 
              onClick={handleGoogleLogin} 
              variant="outline"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in with Google"
              )}
            </Button>

            {errorMessage && (
              <div className="text-sm text-red-500 mt-2">
                {errorMessage}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            By clicking continue, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}