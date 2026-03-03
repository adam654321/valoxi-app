import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function MagicLinkPage() {
  const [error, setError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setError(true);
      return;
    }

    window.location.href = `/api/v2/auth/magic?token=${encodeURIComponent(token)}`;

    const timeout = setTimeout(() => {
      setError(true);
    }, 5000);

    return () => clearTimeout(timeout);
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md space-y-4">
          <div className="mx-auto h-16 w-16 bg-primary rounded-xl flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">We couldn't sign you in. Please try again.</p>
          <a
            href="/login"
            className="inline-block mt-4 px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="mx-auto h-16 w-16 bg-primary rounded-xl flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-foreground">DealFlow AI</h1>
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Signing you in...</p>
        </div>
      </div>
    </div>
  );
}
