import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Unplug } from "lucide-react";
import { SiGmail } from "react-icons/si";

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="7.5" height="7.5" fill="#f25022" />
      <rect x="8.5" y="0" width="7.5" height="7.5" fill="#7fba00" />
      <rect x="0" y="8.5" width="7.5" height="7.5" fill="#00a4ef" />
      <rect x="8.5" y="8.5" width="7.5" height="7.5" fill="#ffb900" />
    </svg>
  );
}

interface NylasGrant {
  id: number;
  email: string;
  provider: "google" | "microsoft";
  status: "active" | "broken" | "revoked";
  scopes: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

function providerIcon(provider: "google" | "microsoft") {
  if (provider === "google") {
    return <SiGmail className="h-4 w-4" />;
  }
  return <MicrosoftIcon className="h-4 w-4" />;
}

function providerLabel(provider: "google" | "microsoft") {
  return provider === "google" ? "Gmail" : "Outlook";
}

function relativeTime(iso: string | null): string {
  if (!iso) return "Not used yet";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

export function ConnectedAccountsSection() {
  const { toast } = useToast();
  const [initiatingProvider, setInitiatingProvider] = useState<"google" | "microsoft" | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("nylas_connected") === "1") {
      toast({ title: "Account connected", description: "Your email account has been linked." });
      window.history.replaceState({}, "", window.location.pathname);
    }
    const nylasError = params.get("nylas_error");
    if (nylasError) {
      const messages: Record<string, string> = {
        invalid_state: "The connection request expired. Please try again.",
        exchange_failed: "Something went wrong during the connection. Please try again.",
      };
      toast({
        title: "Connection failed",
        description: messages[nylasError] ?? "An unexpected error occurred.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const { data, isLoading } = useQuery<{ success: boolean; data: NylasGrant[] }>({
    queryKey: ["/api/v2/nylas/grants"],
  });

  const grants = data?.data ?? [];

  const initiateMutation = useMutation({
    mutationFn: async (provider: "google" | "microsoft") => {
      setInitiatingProvider(provider);
      const res = await apiRequest("POST", "/api/v2/nylas/auth/initiate", { provider });
      return res.json();
    },
    onSuccess: (json: { success: boolean; data: { authUrl: string } }) => {
      window.location.href = json.data.authUrl;
    },
    onError: (error: any) => {
      setInitiatingProvider(null);
      toast({
        title: "Error",
        description: error.message ?? "Failed to start connection.",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (grantId: number) => {
      await apiRequest("DELETE", `/api/v2/nylas/grants/${grantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/nylas/grants"] });
      toast({ title: "Account disconnected", description: "The email account has been unlinked." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message ?? "Failed to disconnect.",
        variant: "destructive",
      });
    },
  });

  function ConnectButtons() {
    return (
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => initiateMutation.mutate("google")}
          disabled={initiatingProvider !== null}
        >
          {initiatingProvider === "google" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <span className="mr-2">{providerIcon("google")}</span>
          )}
          Connect Gmail
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => initiateMutation.mutate("microsoft")}
          disabled={initiatingProvider !== null}
        >
          {initiatingProvider === "microsoft" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <span className="mr-2">{providerIcon("microsoft")}</span>
          )}
          Connect Outlook
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Connected email accounts</CardTitle>
        <CardDescription>
          Connect your email so outreach to sellers and target companies is sent from your address, not no-reply@valoxi.ai.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : grants.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You haven't connected an email account yet.
            </p>
            <ConnectButtons />
          </div>
        ) : (
          <div className="space-y-4">
            <ul role="list" className="divide-y divide-border rounded-md border">
              {grants.map((grant) => (
                <li key={grant.id} className="flex items-center justify-between p-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-muted-foreground flex-shrink-0">
                      {providerIcon(grant.provider)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{grant.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {providerLabel(grant.provider)} · Last used: {relativeTime(grant.lastUsedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge
                      variant={grant.status === "active" ? "default" : "destructive"}
                      className={grant.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100" : ""}
                    >
                      {grant.status === "active" ? "Active" : "Connection broken"}
                    </Badge>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1">
                          <Unplug className="h-4 w-4" />
                          Disconnect
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Disconnect {grant.email}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Future emails will revert to no-reply@valoxi.ai until you reconnect. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => disconnectMutation.mutate(grant.id)}
                            disabled={disconnectMutation.isPending}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {disconnectMutation.isPending && (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            )}
                            Disconnect
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </li>
              ))}
            </ul>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Add another account:</p>
              <ConnectButtons />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
