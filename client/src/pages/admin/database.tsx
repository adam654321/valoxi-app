import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Loader2, CheckCircle2, XCircle, Database, Play, LogOut } from "lucide-react";

const SEED_SCRIPTS = [
  {
    key: "activity-types",
    label: "Activity Types",
    description: "Phone Call, Email, Meeting, Note, Follow-up, Initial Discussion",
    endpoint: "/api/v2/admin/seed-activity-types",
  },
  {
    key: "pipeline-stages",
    label: "Pipeline Stages",
    description: "New Target → Initial Contact → Offer Stage → Due Diligence → Completion etc.",
    endpoint: "/api/v2/admin/seed-pipeline-stages",
  },
  {
    key: "dd-requirements",
    label: "Due Diligence Requirements",
    description: "Default DD checklist categories and requirements",
    endpoint: "/api/v2/admin/seed-dd-requirements",
  },
  {
    key: "deal-document-templates",
    label: "Deal Document Templates",
    description: "System document templates (NDA, LOI, SPA etc.)",
    endpoint: "/api/v2/admin/seed-deal-document-templates",
  },
  {
    key: "user-roles",
    label: "User Roles",
    description: "Default user roles and permissions",
    endpoint: "/api/v2/admin/seed-user-roles",
  },
] as const;

type SeedKey = typeof SEED_SCRIPTS[number]["key"];
type SeedStatus = { status: "idle" | "running" | "success" | "error"; message?: string };

async function getCsrfToken(): Promise<string> {
  const res = await fetch("/api/v2/auth/csrf", { credentials: "include" });
  const data = await res.json();
  return data?.data?.csrfToken ?? "";
}

async function adminPost(endpoint: string): Promise<any> {
  const csrfToken = await getCsrfToken();
  const res = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
  return data;
}

export default function AdminDatabase() {
  const { toast } = useToast();
  const [verified, setVerified] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [seedStatuses, setSeedStatuses] = useState<Record<SeedKey, SeedStatus>>(
    Object.fromEntries(SEED_SCRIPTS.map((s) => [s.key, { status: "idle" }])) as Record<SeedKey, SeedStatus>
  );

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const csrfToken = await getCsrfToken();
      const res = await fetch("/api/v2/admin/verify-credentials", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Verification failed");
      return data;
    },
    onSuccess: () => {
      setVerified(true);
      setAuthError("");
      setPassword("");
    },
    onError: (err: any) => {
      setAuthError(err.message || "Invalid credentials");
    },
  });

  const runSeed = async (script: typeof SEED_SCRIPTS[number]) => {
    setSeedStatuses((prev) => ({ ...prev, [script.key]: { status: "running" } }));
    try {
      await adminPost(script.endpoint);
      setSeedStatuses((prev) => ({ ...prev, [script.key]: { status: "success", message: "Completed successfully" } }));
      toast({ title: `${script.label} seeded`, description: "Data is now available." });
    } catch (err: any) {
      const message = err.message || "Something went wrong";
      setSeedStatuses((prev) => ({ ...prev, [script.key]: { status: "error", message } }));
      toast({ title: `${script.label} failed`, description: message, variant: "destructive" });
    }
  };

  if (!verified) {
    return (
      <div className="p-6 max-w-md mx-auto mt-16">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <ShieldCheck className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <CardTitle>Admin Verification Required</CardTitle>
            <CardDescription>
              Re-enter your admin credentials to access database operations. This is required every time you visit this page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {authError && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verifyMutation.mutate()}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => verifyMutation.mutate()}
              disabled={!email || !password || verifyMutation.isPending}
            >
              {verifyMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Verify & Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" />
            Database Operations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Run seed scripts to populate default data. Safe to run — all scripts skip existing records.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setVerified(false)}>
          <LogOut className="h-4 w-4 mr-2" />
          Lock
        </Button>
      </div>

      <Separator />

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Seed Scripts</h2>
        {SEED_SCRIPTS.map((script) => {
          const status = seedStatuses[script.key];
          return (
            <Card key={script.key}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{script.label}</span>
                    {status.status === "success" && (
                      <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-900/20 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Done
                      </Badge>
                    )}
                    {status.status === "error" && (
                      <Badge variant="destructive" className="text-xs">
                        <XCircle className="h-3 w-3 mr-1" /> Failed
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{script.description}</p>
                  {status.message && status.status === "error" && (
                    <p className="text-xs text-destructive mt-1">{status.message}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={status.status === "success" ? "outline" : "default"}
                  disabled={status.status === "running"}
                  onClick={() => runSeed(script)}
                  className="shrink-0"
                >
                  {status.status === "running" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  <span className="ml-1.5">{status.status === "success" ? "Run Again" : "Run"}</span>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
