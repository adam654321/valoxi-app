import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatDistanceToNow, format, differenceInDays } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Loader2, ThumbsUp, ThumbsDown, Send, Eye, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type WaitlistStatus = "new" | "approved" | "invited" | "declined";

interface WaitlistRow {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  acquisitionJourney: string;
  targetDealSize: string;
  sectors: string[];
  sectorsOther: string | null;
  acquisitionsCompleted: string;
  createdAt: string;
  cohort: string;
  discountTier: string;
  status: WaitlistStatus;
  statusChangedAt: string | null;
  statusChangedBy: number | null;
  invitedUserId: number | null;
}

const STATUS_LABELS: Record<WaitlistStatus | "all", string> = {
  all: "All",
  new: "New",
  approved: "Approved",
  invited: "Invited",
  declined: "Declined",
};

const STATUS_ORDER: ("all" | WaitlistStatus)[] = ["all", "new", "approved", "invited", "declined"];

const BULK_INVITE_SOFT_CAP = 20;

function formatDate(d: string | null): string {
  if (!d) return "\u2014";
  const date = new Date(d);
  if (differenceInDays(new Date(), date) < 30) {
    return formatDistanceToNow(date, { addSuffix: true });
  }
  return format(date, "d MMM yyyy");
}

function StatusBadge({ status }: { status: WaitlistStatus }) {
  const styles: Record<WaitlistStatus, string> = {
    new: "bg-blue-100 text-blue-800",
    approved: "bg-green-100 text-green-800",
    invited: "bg-amber-100 text-amber-800",
    declined: "bg-slate-100 text-slate-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function SectorsCell({ sectors }: { sectors: string[] }) {
  if (!sectors || sectors.length === 0) {
    return <span className="text-muted-foreground">\u2014</span>;
  }
  const shown = sectors.slice(0, 2);
  const extra = sectors.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((s) => (
        <Badge key={s} variant="secondary" className="font-normal">{s}</Badge>
      ))}
      {extra > 0 && <Badge variant="outline" className="font-normal">+{extra}</Badge>}
    </div>
  );
}

type ConfirmAction =
  | { type: "approve"; row: WaitlistRow }
  | { type: "decline"; row: WaitlistRow }
  | { type: "invite"; row: WaitlistRow }
  | { type: "bulkInvite"; rows: WaitlistRow[]; bypassCap: boolean };

interface BulkProgress {
  current: number;
  total: number;
  succeeded: number;
  failed: Array<{ name: string; email: string; error: string }>;
}

export default function AdminWaitlist() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"all" | WaitlistStatus>("new");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [detailsRow, setDetailsRow] = useState<WaitlistRow | null>(null);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);

  const { data: rows, isLoading, error, refetch } = useQuery<WaitlistRow[]>({
    queryKey: ["/api/v2/admin/waitlist"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/v2/admin/waitlist?limit=200");
      const body = await res.json();
      return body?.data ?? [];
    },
  });

  const counts = useMemo(() => {
    const base: Record<"all" | WaitlistStatus, number> = {
      all: 0, new: 0, approved: 0, invited: 0, declined: 0,
    };
    (rows ?? []).forEach((r) => {
      base.all += 1;
      base[r.status] += 1;
    });
    return base;
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    if (activeTab === "all") return rows;
    return rows.filter((r) => r.status === activeTab);
  }, [rows, activeTab]);

  const invitableRows = useMemo(
    () => filteredRows.filter((r) => r.status === "new" || r.status === "approved"),
    [filteredRows]
  );

  const selectedRowObjects = useMemo(
    () => (rows ?? []).filter((r) => selectedIds.has(r.id)),
    [rows, selectedIds]
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    const allSelected = invitableRows.every((r) => selectedIds.has(r.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        invitableRows.forEach((r) => next.delete(r.id));
      } else {
        invitableRows.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/v2/admin/waitlist/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Approved", description: "Waitlist entry has been approved." });
      setConfirmAction(null);
      queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/waitlist"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to approve.", variant: "destructive" });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/v2/admin/waitlist/${id}/decline`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Declined", description: "Waitlist entry has been declined." });
      setConfirmAction(null);
      queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/waitlist"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to decline.", variant: "destructive" });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/v2/admin/waitlist/${id}/invite`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Invited", description: data?.data?.message || "Invitation sent." });
      setConfirmAction(null);
      queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/waitlist"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to send invitation.", variant: "destructive" });
    },
  });

  const runBulkInvite = async (targetRows: WaitlistRow[]) => {
    setBulkProgress({ current: 0, total: targetRows.length, succeeded: 0, failed: [] });
    for (let i = 0; i < targetRows.length; i++) {
      const row = targetRows[i];
      setBulkProgress((p) => p ? { ...p, current: i + 1 } : p);
      try {
        const res = await apiRequest("POST", `/api/v2/admin/waitlist/${row.id}/invite`);
        if (res.ok) {
          setBulkProgress((p) => p ? { ...p, succeeded: p.succeeded + 1 } : p);
        } else {
          const body = await res.json().catch(() => ({}));
          setBulkProgress((p) => p ? {
            ...p,
            failed: [...p.failed, { name: row.fullName, email: row.email, error: body?.message || `HTTP ${res.status}` }],
          } : p);
        }
      } catch (err: any) {
        setBulkProgress((p) => p ? {
          ...p,
          failed: [...p.failed, { name: row.fullName, email: row.email, error: err.message || "Request failed" }],
        } : p);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/waitlist"] });
    setSelectedIds(new Set());
  };

  const executeConfirm = () => {
    if (!confirmAction) return;
    if (confirmAction.type === "approve") approveMutation.mutate(confirmAction.row.id);
    else if (confirmAction.type === "decline") declineMutation.mutate(confirmAction.row.id);
    else if (confirmAction.type === "invite") inviteMutation.mutate(confirmAction.row.id);
    else if (confirmAction.type === "bulkInvite") {
      setConfirmAction(null);
      runBulkInvite(confirmAction.rows);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span>Failed to load waitlist. </span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedInvitable = selectedRowObjects.filter((r) => r.status === "new" || r.status === "approved");
  const allVisibleSelected = invitableRows.length > 0 && invitableRows.every((r) => selectedIds.has(r.id));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Waitlist</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {counts.all} entries &middot; {counts.new} new &middot; {counts.approved} approved &middot; {counts.invited} invited &middot; {counts.declined} declined
          </p>
        </div>
        <Button
          disabled={selectedInvitable.length === 0}
          onClick={() => {
            const overCap = selectedInvitable.length > BULK_INVITE_SOFT_CAP;
            setConfirmAction({ type: "bulkInvite", rows: selectedInvitable, bypassCap: !overCap });
          }}
        >
          <Send className="h-4 w-4 mr-2" />
          Invite Selected ({selectedInvitable.length})
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setSelectedIds(new Set()); }}>
        <TabsList>
          {STATUS_ORDER.map((s) => (
            <TabsTrigger key={s} value={s}>
              {STATUS_LABELS[s]} ({counts[s]})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  {invitableRows.length > 0 && (
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={toggleAllVisible}
                      aria-label="Select all invitable"
                    />
                  )}
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cohort</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Deal Size</TableHead>
                <TableHead>Sectors</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    {counts.all === 0 ? "No waitlist entries yet." : "No entries match this filter."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((r) => {
                  const canInvite = r.status === "new" || r.status === "approved";
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        {canInvite && (
                          <Checkbox
                            checked={selectedIds.has(r.id)}
                            onCheckedChange={() => toggleSelected(r.id)}
                            aria-label={`Select ${r.fullName}`}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{r.fullName}</TableCell>
                      <TableCell>{r.email}</TableCell>
                      <TableCell>{r.cohort}</TableCell>
                      <TableCell>{r.discountTier}</TableCell>
                      <TableCell className="text-sm">{r.targetDealSize}</TableCell>
                      <TableCell><SectorsCell sectors={r.sectors} /></TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {r.status === "new" && (
                            <>
                              <Button variant="ghost" size="sm" title="Approve" onClick={() => setConfirmAction({ type: "approve", row: r })}>
                                <ThumbsUp className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" title="Decline" onClick={() => setConfirmAction({ type: "decline", row: r })}>
                                <ThumbsDown className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {r.status === "approved" && (
                            <Button variant="ghost" size="sm" title="Decline" onClick={() => setConfirmAction({ type: "decline", row: r })}>
                              <ThumbsDown className="h-4 w-4" />
                            </Button>
                          )}
                          {canInvite && (
                            <Button variant="ghost" size="sm" title="Invite" onClick={() => setConfirmAction({ type: "invite", row: r })}>
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" title="View details" onClick={() => setDetailsRow(r)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirm modal for single actions and bulk invite */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <DialogContent>
          {confirmAction?.type === "approve" && (
            <>
              <DialogHeader>
                <DialogTitle>Approve waitlist entry</DialogTitle>
                <DialogDescription>
                  Approve <strong>{confirmAction.row.fullName}</strong> ({confirmAction.row.email})? This does not send an email. You can invite them later.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={executeConfirm} disabled={approveMutation.isPending}>
                  {approveMutation.isPending ? "Approving..." : "Approve"}
                </Button>
              </DialogFooter>
            </>
          )}
          {confirmAction?.type === "decline" && (
            <>
              <DialogHeader>
                <DialogTitle>Decline waitlist entry</DialogTitle>
                <DialogDescription>
                  Decline <strong>{confirmAction.row.fullName}</strong> ({confirmAction.row.email})? This does not send an email.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button variant="destructive" onClick={executeConfirm} disabled={declineMutation.isPending}>
                  {declineMutation.isPending ? "Declining..." : "Decline"}
                </Button>
              </DialogFooter>
            </>
          )}
          {confirmAction?.type === "invite" && (
            <>
              <DialogHeader>
                <DialogTitle>Send invitation</DialogTitle>
                <DialogDescription>
                  Send the invitation email to <strong>{confirmAction.row.fullName}</strong> at <strong>{confirmAction.row.email}</strong>? This will create their user record and send the email immediately.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={executeConfirm} disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? "Sending..." : "Send invitation"}
                </Button>
              </DialogFooter>
            </>
          )}
          {confirmAction?.type === "bulkInvite" && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Invite {confirmAction.rows.length} {confirmAction.rows.length === 1 ? "entry" : "entries"}
                </DialogTitle>
                <DialogDescription>
                  Each invitee will be emailed immediately. This cannot be undone.
                  {confirmAction.rows.length > BULK_INVITE_SOFT_CAP && !confirmAction.bypassCap && (
                    <span className="block mt-3 p-3 rounded bg-amber-50 border border-amber-200 text-amber-900">
                      <AlertTriangle className="inline h-4 w-4 mr-1" />
                      You have selected {confirmAction.rows.length} entries, above the recommended batch of {BULK_INVITE_SOFT_CAP}. Review the list carefully.
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-64 overflow-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {confirmAction.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.fullName}</TableCell>
                        <TableCell>{r.email}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                {confirmAction.rows.length > BULK_INVITE_SOFT_CAP && !confirmAction.bypassCap ? (
                  <Button
                    variant="destructive"
                    onClick={() => setConfirmAction({ ...confirmAction, bypassCap: true })}
                  >
                    Confirm anyway
                  </Button>
                ) : (
                  <Button onClick={executeConfirm}>
                    Send {confirmAction.rows.length} invitation{confirmAction.rows.length === 1 ? "" : "s"}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk invite progress modal */}
      <Dialog open={!!bulkProgress} onOpenChange={(open) => { if (!open && bulkProgress && bulkProgress.current === bulkProgress.total) setBulkProgress(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkProgress && bulkProgress.current < bulkProgress.total
                ? `Inviting ${bulkProgress.current} of ${bulkProgress.total}...`
                : "Bulk invite complete"}
            </DialogTitle>
            <DialogDescription>
              {bulkProgress && `${bulkProgress.succeeded} succeeded, ${bulkProgress.failed.length} failed.`}
            </DialogDescription>
          </DialogHeader>
          {bulkProgress && bulkProgress.current < bulkProgress.total && (
            <div className="w-full bg-muted rounded-full h-2 mt-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
              />
            </div>
          )}
          {bulkProgress && bulkProgress.failed.length > 0 && (
            <div className="max-h-48 overflow-auto border rounded-md mt-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bulkProgress.failed.map((f, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{f.name}</TableCell>
                      <TableCell>{f.email}</TableCell>
                      <TableCell className="text-destructive text-sm">{f.error}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            {bulkProgress && bulkProgress.current === bulkProgress.total && (
              <Button onClick={() => setBulkProgress(null)}>Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details modal */}
      <Dialog open={!!detailsRow} onOpenChange={(open) => { if (!open) setDetailsRow(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Waitlist entry details</DialogTitle>
          </DialogHeader>
          {detailsRow && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Name</span><div className="font-medium">{detailsRow.fullName}</div></div>
                <div><span className="text-muted-foreground">Email</span><div className="font-medium">{detailsRow.email}</div></div>
                <div><span className="text-muted-foreground">Phone</span><div>{detailsRow.phone || "\u2014"}</div></div>
                <div><span className="text-muted-foreground">Status</span><div><StatusBadge status={detailsRow.status} /></div></div>
                <div><span className="text-muted-foreground">Cohort</span><div>{detailsRow.cohort}</div></div>
                <div><span className="text-muted-foreground">Discount tier</span><div>{detailsRow.discountTier}</div></div>
                <div><span className="text-muted-foreground">Target deal size</span><div>{detailsRow.targetDealSize}</div></div>
                <div><span className="text-muted-foreground">Acquisition journey</span><div>{detailsRow.acquisitionJourney}</div></div>
                <div className="col-span-2"><span className="text-muted-foreground">Acquisitions completed</span><div>{detailsRow.acquisitionsCompleted}</div></div>
                <div className="col-span-2"><span className="text-muted-foreground">Sectors</span><div className="flex flex-wrap gap-1 mt-1">{detailsRow.sectors.map((s) => <Badge key={s} variant="secondary" className="font-normal">{s}</Badge>)}</div></div>
                {detailsRow.sectorsOther && (
                  <div className="col-span-2"><span className="text-muted-foreground">Other sectors</span><div>{detailsRow.sectorsOther}</div></div>
                )}
                <div><span className="text-muted-foreground">Submitted</span><div>{formatDate(detailsRow.createdAt)}</div></div>
                {detailsRow.statusChangedAt && (
                  <div><span className="text-muted-foreground">Status changed</span><div>{formatDate(detailsRow.statusChangedAt)}</div></div>
                )}
                {detailsRow.statusChangedBy !== null && (
                  <div><span className="text-muted-foreground">Changed by (admin id)</span><div>{detailsRow.statusChangedBy}</div></div>
                )}
                {detailsRow.invitedUserId !== null && (
                  <div>
                    <span className="text-muted-foreground">Invited user</span>
                    <div>
                      <Link href="/admin/users" className="text-primary underline">View user id {detailsRow.invitedUserId}</Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
