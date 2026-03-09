import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminCompanyDetail() {
  const [, params] = useRoute("/admin/companies/:id");
  const companyId = params?.id;
  const { toast } = useToast();

  const { data: company, isLoading: companyLoading } = useQuery<any>({
    queryKey: ["/api/v2/admin/companies", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/v2/admin/companies/${companyId}`, { credentials: "include" });
      return res.json();
    },
    select: (r: any) => r?.data ?? r,
    enabled: !!companyId,
  });

  const { data: byService, isLoading: serviceLoading } = useQuery<any>({
    queryKey: ["/api/v2/admin/token-usage/by-service", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/v2/admin/token-usage?companyId=${companyId}&limit=1000`, { credentials: "include" });
      return res.json();
    },
    select: (r: any) => {
      const rows = r?.data?.rows ?? [];
      const grouped: Record<string, { service: string; totalTokens: number; totalCost: number }> = {};
      rows.forEach((row: any) => {
        const svc = row.service || "unknown";
        if (!grouped[svc]) grouped[svc] = { service: svc, totalTokens: 0, totalCost: 0 };
        grouped[svc].totalTokens += Number(row.totalTokens ?? 0);
        grouped[svc].totalCost += parseFloat(row.estimatedCostUsd ?? 0);
      });
      return Object.values(grouped).sort((a, b) => b.totalCost - a.totalCost);
    },
    enabled: !!companyId,
  });

  const { data: users, isLoading: usersLoading } = useQuery<any>({
    queryKey: ["/api/v2/admin/users"],
    select: (r: any) => {
      const all = r?.data ?? r ?? [];
      return all.filter((u: any) => String(u.userCompanyId) === String(companyId));
    },
    enabled: !!companyId,
  });

  const planOverrideMutation = useMutation({
    mutationFn: async ({ planOverride }: { planOverride: string | null }) => {
      return apiRequest("POST", `/api/v2/admin/companies/${companyId}/plan-override`, { planOverride });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/companies", companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/companies"] });
      toast({ title: "Plan override updated" });
    },
    onError: () => {
      toast({ title: "Failed to update plan override", variant: "destructive" });
    },
  });

  if (companyLoading || serviceLoading || usersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!company) {
    return <div className="p-6"><p className="text-muted-foreground">Company not found.</p></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/companies">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{company.companyName}</h1>
            {company.betaPlanOverride && (
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700">
                BETA OVERRIDE: {company.betaPlanOverride.toUpperCase()}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{company.userCount} users · {company.dealCount} deals · ${parseFloat(company.totalTokenCost ?? 0).toFixed(4)} total token cost</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Beta Plan Override</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select
              value={company.betaPlanOverride ?? "none"}
              onValueChange={(value) => {
                planOverrideMutation.mutate({
                  planOverride: value === "none" ? null : value,
                });
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Override</SelectItem>
                <SelectItem value="core">Core</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="expert">Expert</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Override the billing plan for beta testing purposes
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Token Usage by Service</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Total Tokens</TableHead>
                <TableHead className="text-right">Est. Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(byService ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No token usage</TableCell></TableRow>
              ) : (
                (byService ?? []).map((s: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{s.service}</TableCell>
                    <TableCell className="text-right">{s.totalTokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">${s.totalCost.toFixed(4)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Users</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No users</TableCell></TableRow>
              ) : (
                (users ?? []).map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.firstName} {u.lastName}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.userRole ?? u.role}</TableCell>
                    <TableCell>{u.isActive ? <span className="text-green-600 text-sm font-medium">Active</span> : <span className="text-muted-foreground/70 text-sm">Inactive</span>}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
