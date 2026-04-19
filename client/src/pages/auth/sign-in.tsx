import { SignIn } from "@clerk/react";
import { ValoxiLogo } from "@/components/valoxi-logo";
import { valoxiClerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="flex flex-col items-center gap-6">
        <ValoxiLogo />
        <SignIn
          appearance={valoxiClerkAppearance}
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/"
          forceRedirectUrl="/"
        />
      </div>
    </div>
  );
}
