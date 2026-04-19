import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

export default function AccountSetupPending() {
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-md w-full rounded-lg border bg-card p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <h1 className="text-xl font-semibold mb-3">Setting up your account</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Your account is being linked. This usually takes a few seconds. The page will refresh
          automatically once setup is complete.
        </p>
        <Button
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["/api/v2/auth/me"] })
          }
        >
          Retry now
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">
          Still stuck?{" "}
          <a href="mailto:support@valoxi.ai" className="underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
