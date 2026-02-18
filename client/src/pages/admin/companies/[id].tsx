import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function AdminCompanyDetail() {
  const [, params] = useRoute("/admin/companies/:id");
  const companyId = params?.id;

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
          <h1 className="text-2xl font-bold">{company.companyName}</h1>
          <p className="text-sm text-muted-foreground">{company.userCount} users · {company.dealCount} deals · ${parseFloat(company.totalTokenCost ?? 0).toFixed(4)} total token cost</p>
        </div>
      </div>

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
                    <TableCell>{u.isActive ? <span className="text-green-600 text-sm font-medium">Active</span> : <span className="text-gray-400 text-sm">Inactive</span>}</TableCell>
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
