import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react";

export default function LinkExpiredPage() {
  const params = new URLSearchParams(window.location.search);
  const reason = params.get("reason") || "invalid";
  const emailParam = params.get("email") || "";

  const [email, setEmail] = useState(emailParam);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const titles: Record<string, string> = {
    expired: "Your login link has expired",
    used: "This link has already been used",
    invalid: "This link is no longer valid",
  };

  const title = titles[reason] || "Invalid login link";

  const handleResend = async () => {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setError("");
    setSending(true);

    try {
      const res = await fetch("/api/v2/auth/resend-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (res.status === 429) {
        setError("Too many requests — please wait a few minutes before trying again.");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Something went wrong. Please try again.");
        return;
      }

      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-background">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary rounded-xl flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="mt-6 text-2xl font-bold text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Magic links expire after 72 hours for security. Enter your email below to receive a new one.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {sent ? (
              <div className="text-center space-y-3 py-4">
                <CheckCircle className="h-10 w-10 text-green-600 mx-auto" />
                <p className="text-sm font-medium text-foreground">Check your inbox — a new link is on its way.</p>
                <p className="text-xs text-muted-foreground">You can close this page.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Email Address</label>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="px-4 py-3"
                    onKeyDown={(e) => e.key === "Enter" && handleResend()}
                  />
                  {error && <p className="text-sm text-red-600">{error}</p>}
                </div>
                <Button
                  onClick={handleResend}
                  disabled={sending}
                  className="w-full py-3"
                >
                  {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Send New Link
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <a
            href="/login"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to login
          </a>
        </div>
      </div>
    </div>
  );
}
