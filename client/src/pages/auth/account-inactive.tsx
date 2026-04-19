import { useMutation } from "@tanstack/react-query";
import { useClerk } from "@clerk/react";
import { apiRequest } from "@/lib/queryClient";
import { useServerConfig } from "@/hooks/useServerConfig";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export default function AccountInactive() {
  const { signOut } = useClerk();
  const { clerkEnabled } = useServerConfig();
  const { toast } = useToast();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/v2/auth/logout");
      if (clerkEnabled) {
        await signOut();
        window.location.href = "/sign-in";
      } else {
        window.location.href = "/login";
      }
    },
    onError: () => {
      toast({
        description: "Could not sign out. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-md w-full rounded-lg border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold mb-3">This account is no longer active</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Your account has been disabled. If you believe this is an error, please contact support
          and we will look into it for you.
        </p>
        <Button
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          {logoutMutation.isPending ? "Signing out..." : "Sign out"}
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">
          <a href="mailto:support@valoxi.ai" className="underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
