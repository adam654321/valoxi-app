import { useMutation } from "@tanstack/react-query";
import { useClerk } from "@clerk/react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function AccountSetupPending() {
  const { signOut } = useClerk();
  const { toast } = useToast();

  const signOutMutation = useMutation({
    mutationFn: async () => {
      try {
        await apiRequest("POST", "/api/v2/auth/logout");
      } catch (err) {
        console.warn('[account-setup-pending] Server logout failed, continuing with Clerk signOut', err);
      }
      try {
        await signOut();
      } catch (err) {
        console.warn('[account-setup-pending] Clerk signOut failed', err);
      }
      window.location.href = "/login";
    },
    onError: (err: any) => {
      toast({
        title: "Sign-out failed",
        description: err?.message || "Please try again or clear your browser cookies.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-md w-full rounded-lg border bg-card p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <h1 className="text-xl font-semibold mb-3">Setting up your account</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Your account is being linked. This usually takes a few seconds. The page will refresh
          automatically once setup is complete.
        </p>
        <div className="flex flex-col gap-2">
          <Button
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["/api/v2/auth/me"] })
            }
          >
            Retry now
          </Button>
          <Button
            variant="outline"
            onClick={() => signOutMutation.mutate()}
            disabled={signOutMutation.isPending}
          >
            {signOutMutation.isPending ? "Signing out..." : "Sign out and start over"}
          </Button>
        </div>
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
