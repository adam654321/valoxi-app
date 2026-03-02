import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, CheckCircle } from "lucide-react";

interface IssueReportRow {
  id: number;
  userId: number | null;
  userEmail: string | null;
  companyName: string | null;
  pageUrl: string | null;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  createdAt: string;
}

const SEVERITY_BADGE: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
  medium: { label: "Medium", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  high: { label: "High", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  in_progress: { label: "In Progress", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  resolved: { label: "Resolved", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
};

export default function AdminIssueReports() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");

  const buildUrl = () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    const qs = params.toString();
    return `/api/v2/admin/issue-reports${qs ? `?${qs}` : ""}`;
  };

  const url = buildUrl();

  const { data, isLoading } = useQuery<{ success: boolean; data: IssueReportRow[] }>({
    queryKey: ["/api/v2/admin/issue-reports", statusFilter],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch issue reports");
      return res.json();
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/v2/admin/issue-reports/${id}`, { status: "resolved" });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Issue resolved" });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/issue-reports"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const rows = data?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Issue Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">User-submitted bug reports and issues.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Reports</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
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
                  <TableHead>Submitted</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Page URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No issue reports found
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const sevBadge = SEVERITY_BADGE[row.severity] ?? SEVERITY_BADGE.medium;
                    const statusBadge = STATUS_BADGE[row.status] ?? STATUS_BADGE.open;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(row.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm">{row.userEmail ?? "—"}</TableCell>
                        <TableCell className="text-sm">{row.companyName ?? "—"}</TableCell>
                        <TableCell>
                          <Badge className={sevBadge.className} variant="outline">
                            {sevBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate" title={row.title}>
                          {row.title}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate" title={row.pageUrl ?? ""}>
                          {row.pageUrl ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusBadge.className} variant="outline">
                            {statusBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {row.status !== "resolved" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resolveMutation.mutate(row.id)}
                              disabled={resolveMutation.isPending}
                            >
                              {resolveMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3.5 w-3.5" />
                              )}
                              <span className="ml-1 text-xs">Resolve</span>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
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
