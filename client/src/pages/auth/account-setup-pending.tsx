import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useClerk } from "@clerk/react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, ExternalLink, Loader2 } from "lucide-react";

const SUPPORT_EMAIL = "support@valoxi.ai";
const VALOXI_WEBSITE = "https://valoxi.ai/#register";

export default function AccountSetupPending() {
  const { signOut } = useClerk();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

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
      window.location.href = "/sign-in";
    },
    onError: (err: any) => {
      toast({
        title: "Sign-out failed",
        description: err?.message || "Please try again or clear your browser cookies.",
        variant: "destructive",
      });
    },
  });

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      toast({
        title: "Email copied",
        description: "Support email copied to your clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Could not copy",
        description: `Please copy this manually: ${SUPPORT_EMAIL}`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-md w-full rounded-lg border bg-card p-8">
        {!showHelp ? (
          <>
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <h1 className="text-xl font-semibold mb-3">Setting up your account</h1>
              <p className="text-sm text-muted-foreground mb-6">
                If you were invited by an admin, your account is being linked and this page should refresh automatically within a few seconds.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: ["/api/v2/auth/me"] })
                }
              >
                Try again
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowHelp(true)}
              >
                I was not invited, or this is taking too long
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center">
              <h1 className="text-xl font-semibold mb-3">Valoxi is invite only</h1>
              <p className="text-sm text-muted-foreground mb-6">
                If you were not invited by an admin, or your setup has been stuck for more than a minute, here is how to get in.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="text-sm font-medium mb-2">Want to request access?</p>
                <p className="text-sm text-muted-foreground mb-3">
                  Register your interest on our website. We will send you login details as soon as possible.
                </p>
                <a
                  href={VALOXI_WEBSITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm underline text-primary hover:text-primary/80"
                >
                  Go to valoxi.ai
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <p className="text-sm font-medium mb-2">Were you invited but still stuck?</p>
                <p className="text-sm text-muted-foreground mb-3">
                  Email our support team and we will sort it out.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-background border rounded px-2 py-1.5 select-all">
                    {SUPPORT_EMAIL}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyEmail}
                    className="shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowHelp(false)}
                >
                  Back to retry
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => signOutMutation.mutate()}
                  disabled={signOutMutation.isPending}
                >
                  {signOutMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Signing out...
                    </>
                  ) : (
                    "Sign out"
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
