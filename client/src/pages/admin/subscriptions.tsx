import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Users, CreditCard, AlertTriangle, Clock, Eye, Shield, Send, Pause, Play } from "lucide-react";
import type { Subscription, PlanKey, SubscriptionStatus } from "@shared/schema/billing";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  trialing: { label: "Trial", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  past_due: { label: "Past Due", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  canceled: { label: "Canceled", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  admin_comped: { label: "Admin Comped", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  incomplete: { label: "Incomplete", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
};

interface SubscriptionRow {
  subscription: Subscription;
  companyName: string;
  ownerUserId?: number;
  ownerEmail?: string;
}

interface Summary {
  total: number;
  byStatus: Record<string, number>;
  byPlan: Record<string, number>;
  trialsExpiringSoon: number;
  pastDue: number;
}

const PAGE_SIZE = 20;

export default function AdminSubscriptions() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [compDialogOpen, setCompDialogOpen] = useState(false);
  const [compTarget, setCompTarget] = useState<{ userCompanyId: number; companyName: string } | null>(null);
  const [compPlan, setCompPlan] = useState<PlanKey>("PROFESSIONAL");
  const [compNotes, setCompNotes] = useState("");
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [accessTarget, setAccessTarget] = useState<{
    userCompanyId: number;
    companyName: string;
    action: "suspend" | "resume";
  } | null>(null);
  const [accessReason, setAccessReason] = useState("");

  const buildUrl = () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (planFilter !== "all") params.set("planKey", planFilter);
    const qs = params.toString();
    return `/api/v2/admin/subscriptions${qs ? `?${qs}` : ""}`;
  };

  const subsUrl = buildUrl();

  const {
    data: subsData,
    isLoading: subsLoading,
    isError: subsError,
    refetch: refetchSubscriptions,
  } = useQuery<{ success: boolean; data: SubscriptionRow[] }>({
    queryKey: ["/api/v2/admin/subscriptions", statusFilter, planFilter],
    queryFn: async () => {
      const res = await fetch(subsUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch subscriptions");
      return res.json();
    },
  });

  const { data: summaryData, isLoading: summaryLoading } = useQuery<{ success: boolean; data: Summary }>({
    queryKey: ["/api/v2/admin/subscriptions/summary"],
  });

  const compMutation = useMutation({
    mutationFn: async (params: { userCompanyId: number; planKey: PlanKey; notes?: string }) => {
      const res = await apiRequest("POST", "/api/v2/billing/admin/comp", params);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Comp access granted", description: "Subscription has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/subscriptions/summary"] });
      setCompDialogOpen(false);
      setCompNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to grant comp access",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  const accessMutation = useMutation({
    mutationFn: async (params: { userCompanyId: number; action: "suspend" | "resume"; reason?: string }) => {
      const res = await apiRequest(
        "POST",
        `/api/v2/admin/subscriptions/${params.userCompanyId}/${params.action}`,
        { reason: params.reason || undefined },
      );
      const result = await res.json();
      if (result?.success === false) throw new Error(result?.message || "Unable to update subscription access.");
      return result;
    },
    onSuccess: (_data, params) => {
      toast({
        title: params.action === "suspend" ? "Subscription suspended" : "Subscription resumed",
        description: "Subscription access has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/subscriptions/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/billing/subscription"] });
      setAccessDialogOpen(false);
      setAccessTarget(null);
      setAccessReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update subscription",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resendMagicLinkMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", "/api/v2/admin/resend-magic-link", { userId });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Magic link sent", description: data?.data?.message || "Email sent successfully." });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send magic link",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  const rows = subsData?.data ?? [];
  const summary = summaryData?.data;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeCount = (summary?.byStatus?.active ?? 0) + (summary?.byStatus?.admin_comped ?? 0);
  const trialCount = summary?.byStatus?.trialing ?? 0;
  const pastDueCount = summary?.pastDue ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Subscriptions</h1>
        <p className="text-sm text-muted-foreground mt-1">Monitor subscription metrics and manage subscriber access.</p>
      </div>

      {summaryLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{summary.total}</p>
                  <p className="text-xs text-muted-foreground">Total Subscribers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{activeCount}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{trialCount}</p>
                  <p className="text-xs text-muted-foreground">On Trial</p>
                  {summary.trialsExpiringSoon > 0 && (
                    <p className="text-xs text-amber-600">{summary.trialsExpiringSoon} expiring within 7 days</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={pastDueCount > 0 ? "border-amber-300 dark:border-amber-700" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className={`h-5 w-5 ${pastDueCount > 0 ? "text-red-600" : "text-muted-foreground"}`} />
                <div>
                  <p className={`text-2xl font-bold ${pastDueCount > 0 ? "text-red-600" : ""}`}>{pastDueCount}</p>
                  <p className="text-xs text-muted-foreground">Past Due</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {summaryLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["CORE", "PROFESSIONAL", "EXPERT"] as PlanKey[]).map((plan) => (
            <Card key={plan}>
              <CardContent className="pt-6 flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  {plan.charAt(0) + plan.slice(1).toLowerCase()}
                </p>
                <p className="text-2xl font-bold">{summary.byPlan[plan] ?? 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Subscribers</CardTitle>
            <div className="flex items-center gap-3">
              <Select
                value={statusFilter}
                onValueChange={(v) => { setStatusFilter(v); setPage(1); }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="admin_comped">Admin Comped</SelectItem>
                  <SelectItem value="incomplete">Incomplete</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={planFilter}
                onValueChange={(v) => { setPlanFilter(v); setPage(1); }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  <SelectItem value="CORE">Core</SelectItem>
                  <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                  <SelectItem value="EXPERT">Expert</SelectItem>
                  <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {subsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : subsError ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">Subscriptions could not be loaded.</p>
              <Button variant="outline" size="sm" onClick={() => refetchSubscriptions()}>Retry</Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Billing Interval</TableHead>
                    <TableHead>Period End</TableHead>
                    <TableHead className="text-right">Add-on Slots</TableHead>
                    <TableHead className="text-right">Additional Seats</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No subscriptions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedRows.map((row) => {
                      const sub = row.subscription;
                      const isSuspended = !!sub.suspendedAt;
                      const badge = isSuspended
                        ? { label: "Suspended", className: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300" }
                        : STATUS_BADGE[sub.status] ?? STATUS_BADGE.incomplete;
                      const canSuspend = !isSuspended && ["active", "trialing", "admin_comped"].includes(sub.status);
                      const canResume = isSuspended && ["active", "trialing", "admin_comped"].includes(sub.status);
                      return (
                        <TableRow key={sub.id}>
                          <TableCell className="font-medium">{row.companyName}</TableCell>
                          <TableCell>{sub.planKey.charAt(0) + sub.planKey.slice(1).toLowerCase()}</TableCell>
                          <TableCell>
                            <Badge className={badge.className} variant="outline">
                              {badge.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{sub.billingInterval ?? "—"}</TableCell>
                          <TableCell>
                            {sub.currentPeriodEnd
                              ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">{sub.addOnCompanySlots}</TableCell>
                          <TableCell className="text-right">{sub.additionalSeats}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" asChild>
                                <a href={`/admin/companies/${sub.userCompanyId}`}>
                                  <Eye className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCompTarget({ userCompanyId: sub.userCompanyId, companyName: row.companyName });
                                  setCompPlan(sub.planKey as PlanKey);
                                  setCompNotes("");
                                  setCompDialogOpen(true);
                                }}
                              >
                                <Shield className="h-3.5 w-3.5" />
                              </Button>
                              {row.ownerUserId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title={`Resend magic link to ${row.ownerEmail || 'owner'}`}
                                  disabled={resendMagicLinkMutation.isPending}
                                  onClick={() => resendMagicLinkMutation.mutate(row.ownerUserId!)}
                                >
                                  <Send className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {(canSuspend || canResume) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title={canSuspend ? `Suspend ${row.companyName}` : `Resume ${row.companyName}`}
                                  aria-label={canSuspend ? `Suspend ${row.companyName}` : `Resume ${row.companyName}`}
                                  disabled={accessMutation.isPending}
                                  onClick={() => {
                                    setAccessTarget({
                                      userCompanyId: sub.userCompanyId,
                                      companyName: row.companyName,
                                      action: canSuspend ? "suspend" : "resume",
                                    });
                                    setAccessReason("");
                                    setAccessDialogOpen(true);
                                  }}
                                >
                                  {canSuspend
                                    ? <Pause className="h-3.5 w-3.5" />
                                    : <Play className="h-3.5 w-3.5" />}
                                  <span>{canSuspend ? "Suspend" : "Resume"}</span>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-muted-foreground">
                    Page {page} of {totalPages} ({rows.length} total)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={compDialogOpen} onOpenChange={setCompDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Grant Comp Access</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Grant comped subscription access to <span className="font-medium text-foreground">{compTarget?.companyName}</span>.
            </p>
            <div className="space-y-1.5">
              <Label className="text-sm">Plan</Label>
              <Select value={compPlan} onValueChange={(v) => setCompPlan(v as PlanKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CORE">Core</SelectItem>
                  <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                  <SelectItem value="EXPERT">Expert</SelectItem>
                  <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Notes (optional)</Label>
              <Input
                value={compNotes}
                onChange={(e) => setCompNotes(e.target.value)}
                placeholder="Reason for comp access"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!compTarget) return;
                compMutation.mutate({
                  userCompanyId: compTarget.userCompanyId,
                  planKey: compPlan,
                  notes: compNotes || undefined,
                });
              }}
              disabled={compMutation.isPending}
            >
              {compMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Grant Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={accessDialogOpen}
        onOpenChange={(open) => {
          if (!accessMutation.isPending) setAccessDialogOpen(open);
          if (!open && !accessMutation.isPending) {
            setAccessTarget(null);
            setAccessReason("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{accessTarget?.action === "suspend" ? "Suspend subscription access" : "Resume subscription access"}</DialogTitle>
          </DialogHeader>
          {accessTarget?.action === "suspend" ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-foreground">
                You are about to suspend <span className="font-semibold">{accessTarget.companyName}</span>.
              </p>
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                <p>Suspend pauses Stripe payment collection and blocks all company members while preserving their data.</p>
                <p className="mt-2">Invoices generated during the pause are voided. Existing invoices are not canceled or refunded. The billing schedule, trial end date and any scheduled cancellation remain unchanged.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="suspension-reason" className="text-sm">Reason (optional)</Label>
                <Input
                  id="suspension-reason"
                  value={accessReason}
                  onChange={(event) => setAccessReason(event.target.value)}
                  placeholder="Add an internal note"
                  disabled={accessMutation.isPending}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <p className="text-sm text-foreground">
                You are about to resume <span className="font-semibold">{accessTarget?.companyName}</span>.
              </p>
              <p className="text-sm text-muted-foreground">
                Future billing and company access will restart. Invoices voided during the suspension will not be charged retroactively.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="resume-reason" className="text-sm">Reason (optional)</Label>
                <Input
                  id="resume-reason"
                  value={accessReason}
                  onChange={(event) => setAccessReason(event.target.value)}
                  placeholder="Add an internal note"
                  disabled={accessMutation.isPending}
                />
              </div>
            </div>
          )}
          {accessMutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {accessMutation.error instanceof Error ? accessMutation.error.message : "The subscription could not be updated. Please try again."}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccessDialogOpen(false)} disabled={accessMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant={accessTarget?.action === "suspend" ? "destructive" : "default"}
              disabled={!accessTarget || accessMutation.isPending}
              onClick={() => {
                if (!accessTarget) return;
                accessMutation.mutate({
                  userCompanyId: accessTarget.userCompanyId,
                  action: accessTarget.action,
                  reason: accessReason.trim() || undefined,
                });
              }}
            >
              {accessMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {accessTarget?.action === "suspend" ? "Confirm suspension" : "Confirm resume"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
