import { useEffect, useState } from "react";
import { SignIn } from "@clerk/react";
import { useClerk, useAuth as useClerkAuth } from "@clerk/react";
import { ValoxiLogo } from "@/components/valoxi-logo";
import { valoxiClerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  const { signOut } = useClerk();
  const { isSignedIn, isLoaded } = useClerkAuth();
  const [preflightComplete, setPreflightComplete] = useState(false);

  // Pre-flight: if a Clerk session exists when the user lands on /sign-in,
  // that is a stuck state (they should not see /sign-in if they are signed in;
  // they should be on /). Verify with our backend; if backend does not agree,
  // clear the session before rendering the Clerk component.
  useEffect(() => {
    if (!isLoaded) return;

    const checkStuckSession = async () => {
      if (isSignedIn) {
        try {
          const res = await fetch("/api/v2/auth/me", { credentials: "include" });
          if (!res.ok) {
            console.warn('[sign-in] Stuck Clerk session detected (Clerk signed in, backend not linked). Clearing.');
            try {
              await signOut();
            } catch (err) {
              console.warn('[sign-in] signOut failed during pre-flight clear', err);
            }
          }
        } catch (err) {
          console.warn('[sign-in] Backend check failed, clearing Clerk session defensively', err);
          try {
            await signOut();
          } catch (innerErr) {
            console.warn('[sign-in] signOut failed during defensive clear', innerErr);
          }
        }
      }
      setPreflightComplete(true);
    };

    checkStuckSession();
  }, [isLoaded, isSignedIn, signOut]);

  const handleStartOver = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('[sign-in] signOut failed', err);
    }
    window.location.reload();
  };

  if (!isLoaded || !preflightComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="flex flex-col items-center gap-4">
        <ValoxiLogo />
        <SignIn
          appearance={valoxiClerkAppearance}
          signUpUrl="/sign-up"
          forceRedirectUrl="/"
          fallbackRedirectUrl="/"
        />
        <div className="flex flex-col items-center gap-2 mt-2 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={handleStartOver}
            className="underline hover:text-foreground"
          >
            Having trouble? Start over
          </button>
        </div>
      </div>
    </div>
  );
}
