import { SignUp } from "@clerk/react";
import { useClerk } from "@clerk/react";
import { ValoxiLogo } from "@/components/valoxi-logo";
import { valoxiClerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  const { signOut } = useClerk();

  const handleStartOver = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('[sign-up] signOut failed', err);
    }
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="flex flex-col items-center gap-4">
        <ValoxiLogo />
        <SignUp
          appearance={valoxiClerkAppearance}
          signInUrl="/sign-in"
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
