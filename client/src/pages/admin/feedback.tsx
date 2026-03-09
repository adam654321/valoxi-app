import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, ChevronDown, ChevronRight, Bug, MessageSquare, Lightbulb, HelpCircle, AlertTriangle, Clock, CheckCircle2, XCircle } from "lucide-react";

interface FeedbackRow {
  id: number;
  userId: number | null;
  userCompanyId: number | null;
  reporterEmail: string | null;
  reporterName: string | null;
  type: string;
  severity: string | null;
  title: string;
  description: string;
  pageUrl: string | null;
  pageTitle: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  companyName: string | null;
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Bug; className: string }> = {
  bug: { label: "Bug", icon: Bug, className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  suggestion: { label: "Suggestion", icon: Lightbulb, className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  comment: { label: "Comment", icon: MessageSquare, className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  other: { label: "Other", icon: HelpCircle, className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
};

const SEVERITY_CONFIG: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
  medium: { label: "Medium", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  high: { label: "High", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  critical: { label: "Critical", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  open: { label: "Open", icon: AlertTriangle, className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  in_progress: { label: "In Progress", icon: Clock, className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  resolved: { label: "Resolved", icon: CheckCircle2, className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  wont_fix: { label: "Won't Fix", icon: XCircle, className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
};

export default function AdminFeedback() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<number, string>>({});

  const buildUrl = () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (severityFilter !== "all") params.set("severity", severityFilter);
    const qs = params.toString();
    return `/api/v2/admin/feedback${qs ? `?${qs}` : ""}`;
  };

  const url = buildUrl();

  const { data, isLoading } = useQuery<{ success: boolean; data: FeedbackRow[] }>({
    queryKey: ["/api/v2/admin/feedback", statusFilter, typeFilter, severityFilter],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch feedback");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: number; status?: string; adminNotes?: string }) => {
      const body: Record<string, string> = {};
      if (status) body.status = status;
      if (adminNotes !== undefined) body.adminNotes = adminNotes;
      const res = await apiRequest("PATCH", `/api/v2/admin/feedback/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Feedback updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/feedback"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const rows = data?.data ?? [];

  const openCount = rows.filter(r => r.status === "open").length;
  const inProgressCount = rows.filter(r => r.status === "in_progress").length;
  const resolvedCount = rows.filter(r => r.status === "resolved").length;

  const bugCount = rows.filter(r => r.type === "bug").length;
  const suggestionCount = rows.filter(r => r.type === "suggestion").length;
  const commentCount = rows.filter(r => r.type === "comment").length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Beta Feedback</h1>
        <p className="text-sm text-muted-foreground mt-1">User-submitted feedback from beta testers.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-blue-600">{openCount}</div>
            <div className="text-xs text-muted-foreground">Open</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-amber-600">{inProgressCount}</div>
            <div className="text-xs text-muted-foreground">In Progress</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-green-600">{resolvedCount}</div>
            <div className="text-xs text-muted-foreground">Resolved</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-red-600">{bugCount}</div>
            <div className="text-xs text-muted-foreground">Bugs</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-blue-600">{suggestionCount}</div>
            <div className="text-xs text-muted-foreground">Suggestions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-green-600">{commentCount}</div>
            <div className="text-xs text-muted-foreground">Comments</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle>Feedback ({rows.length})</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="wont_fix">Won't Fix</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="suggestion">Suggestion</SelectItem>
                  <SelectItem value="comment">Comment</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Page</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No feedback found
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const typeConf = TYPE_CONFIG[row.type] ?? TYPE_CONFIG.other;
                    const sevConf = row.severity ? (SEVERITY_CONFIG[row.severity] ?? SEVERITY_CONFIG.medium) : null;
                    const statusConf = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.open;
                    const isExpanded = expandedId === row.id;
                    const TypeIcon = typeConf.icon;

                    return (
                      <>
                        <TableRow
                          key={row.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedId(isExpanded ? null : row.id)}
                        >
                          <TableCell className="px-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">#{row.id}</TableCell>
                          <TableCell>
                            <Badge className={typeConf.className} variant="outline">
                              <TypeIcon className="h-3 w-3 mr-1" />
                              {typeConf.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {sevConf ? (
                              <Badge className={sevConf.className} variant="outline">
                                {sevConf.label}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate font-medium" title={row.title}>
                            {row.title}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div>{row.reporterName || "—"}</div>
                            <div className="text-xs text-muted-foreground">{row.reporterEmail || ""}</div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate" title={row.pageUrl ?? ""}>
                            {row.pageTitle || row.pageUrl || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(row.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusConf.className} variant="outline">
                              {statusConf.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${row.id}-detail`}>
                            <TableCell colSpan={9} className="bg-muted/30 p-4">
                              <div className="space-y-4">
                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">Description</div>
                                  <div className="text-sm whitespace-pre-wrap bg-background rounded-md p-3 border">
                                    {row.description}
                                  </div>
                                </div>
                                {row.pageUrl && (
                                  <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-1">Page URL</div>
                                    <div className="text-sm text-blue-600 dark:text-blue-400">{row.pageUrl}</div>
                                  </div>
                                )}
                                {row.companyName && (
                                  <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-1">Company</div>
                                    <div className="text-sm">{row.companyName}</div>
                                  </div>
                                )}
                                <div className="flex flex-col sm:flex-row gap-4">
                                  <div className="flex-1">
                                    <div className="text-xs font-medium text-muted-foreground mb-1">Admin Notes</div>
                                    <Textarea
                                      value={editingNotes[row.id] ?? row.adminNotes ?? ""}
                                      onChange={(e) => setEditingNotes(prev => ({ ...prev, [row.id]: e.target.value }))}
                                      placeholder="Add admin notes..."
                                      className="text-sm"
                                      rows={3}
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="mt-2"
                                      disabled={updateMutation.isPending}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateMutation.mutate({
                                          id: row.id,
                                          adminNotes: editingNotes[row.id] ?? row.adminNotes ?? "",
                                        });
                                      }}
                                    >
                                      {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                      Save Notes
                                    </Button>
                                  </div>
                                  <div className="w-48">
                                    <div className="text-xs font-medium text-muted-foreground mb-1">Update Status</div>
                                    <Select
                                      value={row.status}
                                      onValueChange={(val) => {
                                        updateMutation.mutate({ id: row.id, status: val });
                                      }}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="open">Open</SelectItem>
                                        <SelectItem value="in_progress">In Progress</SelectItem>
                                        <SelectItem value="resolved">Resolved</SelectItem>
                                        <SelectItem value="wont_fix">Won't Fix</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
