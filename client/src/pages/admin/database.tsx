import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, Database, Play } from "lucide-react";

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

async function parseJsonSafe(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Server returned unexpected response (${res.status}). The page may need to be refreshed.`);
  }
}

async function getCsrfToken(): Promise<string> {
  const res = await fetch("/api/v2/auth/csrf", {
    credentials: "include",
    cache: "no-store",
  });
  const data = await parseJsonSafe(res);
  return data?.data?.csrfToken ?? "";
}

async function adminPost(endpoint: string, body?: object): Promise<any> {
  const csrfToken = await getCsrfToken();
  const res = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
  return data;
}

export default function AdminDatabase() {
  const { toast } = useToast();
  const [seedStatuses, setSeedStatuses] = useState<Record<SeedKey, SeedStatus>>(
    Object.fromEntries(SEED_SCRIPTS.map((s) => [s.key, { status: "idle" }])) as Record<SeedKey, SeedStatus>
  );

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
