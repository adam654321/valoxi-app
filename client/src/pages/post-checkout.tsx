import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 16; // ~40 seconds total

type Status = "polling" | "timeout" | "error";

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
        if (data.provisioned && data.email) {
          window.location.href = `/sign-up?email_address=${encodeURIComponent(data.email)}`;
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
