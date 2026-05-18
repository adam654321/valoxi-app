import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 16; // ~40 seconds total

type Status = "polling" | "ready" | "timeout" | "error" | "collision";

/**
 * /post-checkout — C-new.3
 *
 * Landing page after a self-serve Stripe checkout. The account is provisioned
 * asynchronously by the checkout.session.completed webhook (C-new.2), so this
 * page polls a read-only status endpoint until the account exists, then
 * forwards to Clerk sign-up with the email pre-filled.
 */
export default function PostCheckoutPage() {
  const [status, setStatus] = useState<Status>("polling");
  const [email, setEmail] = useState<string | null>(null);
  const [hasClerkAccount, setHasClerkAccount] = useState<boolean>(false);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    if (!sessionId) {
      setStatus("error");
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let polls = 0;

    const poll = async () => {
      if (cancelled) return;
      polls += 1;
      try {
        const res = await fetch(
          `/api/v2/public/checkout-status?session_id=${encodeURIComponent(sessionId)}`,
          { credentials: "include" }
        );
        const data = await res.json();
        if (cancelled) return;
        if (data.state === "collision") {
          setEmail(data.email ?? null);
          setHasClerkAccount(!!data.hasClerkAccount);
          setStatus("collision");
          return;
        }
        if (data.state === "provisioned" && data.email) {
          setEmail(data.email);
          setStatus("ready");
          return;
        }
      } catch {
        // Transient failure — keep polling until the cap.
      }
      if (cancelled) return;
      if (polls >= MAX_POLLS) {
        setStatus("timeout");
        return;
      }
      timer = window.setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        {status === "polling" && (
          <>
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
            <h1 className="mt-6 text-xl font-bold text-foreground">Setting up your account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your payment went through. We are creating your Valoxi account now. This takes a few seconds.
            </p>
          </>
        )}

        {status === "ready" && email && (
          <>
            <h1 className="text-xl font-bold text-foreground">Your account is ready</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your login next. Use this email when you sign up. It is linked to your payment:
            </p>
            <div className="mt-4 rounded-md border bg-muted px-4 py-3 font-medium text-foreground break-words">
              {email}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              A different email will not connect to your account.
            </p>
            <Button
              className="mt-6 w-full"
              onClick={() => {
                window.location.href = `/sign-up?email_address=${encodeURIComponent(email)}`;
              }}
            >
              Continue to sign-up
            </Button>
          </>
        )}

        {status === "collision" && (
          <>
            <h1 className="text-xl font-bold text-foreground">You already have an account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This email is already registered with Valoxi{email ? ":" : "."}
            </p>
            {email && (
              <div className="mt-4 rounded-md border bg-muted px-4 py-3 font-medium text-foreground break-words">
                {email}
              </div>
            )}
            <p className="mt-3 text-sm text-muted-foreground">
              You have not been charged twice. This duplicate payment is being refunded. No new subscription was created.
            </p>
            <Button
              className="mt-6 w-full"
              onClick={() => {
                window.location.href = hasClerkAccount
                  ? "/sign-in"
                  : `/sign-up?email_address=${encodeURIComponent(email ?? "")}`;
              }}
            >
              {hasClerkAccount ? "Sign in to your account" : "Create your login"}
            </Button>
          </>
        )}

        {status === "timeout" && (
          <>
            <h1 className="text-xl font-bold text-foreground">This is taking longer than expected</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your payment was successful, but your account is still being set up. Email{" "}
              <a href="mailto:support@valoxi.ai" className="text-primary underline">
                support@valoxi.ai
              </a>{" "}
              and we will get you in straight away.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-xl font-bold text-foreground">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We could not find your checkout session. If you have just paid, email{" "}
              <a href="mailto:support@valoxi.ai" className="text-primary underline">
                support@valoxi.ai
              </a>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}
