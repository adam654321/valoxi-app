import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { DollarSign, Cpu, Building2, Users, Loader2 } from "lucide-react";

export default function AdminOverview() {
  const { data: overview, isLoading: overviewLoading } = useQuery<any>({
    queryKey: ["/api/v2/admin/overview"],
    select: (r: any) => r?.data ?? r,
  });

  const { data: byCompany, isLoading: companyLoading } = useQuery<any>({
    queryKey: ["/api/v2/admin/token-usage/by-company"],
    select: (r: any) => r?.data ?? r,
  });

  if (overviewLoading || companyLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalCombined = (overview?.totalEstimatedCostThisMonth ?? 0) + (overview?.totalManualPlatformCostsThisMonth ?? 0);
  const costBreakdown = [
    { name: "Input Cost (API)", value: overview?.inputCostThisMonth ?? 0 },
    { name: "Output Cost (API)", value: overview?.outputCostThisMonth ?? 0 },
    { name: "Manual Entries", value: overview?.totalManualPlatformCostsThisMonth ?? 0 },
  ].filter((d) => d.value > 0);

  const COLORS = ["#3b82f6", "#f59e0b", "#10b981"];

  const topCompanies = (byCompany ?? []).slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Platform Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost This Month</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCombined.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              In: ${(overview?.inputCostThisMonth ?? 0).toFixed(4)} · Out: ${(overview?.outputCostThisMonth ?? 0).toFixed(4)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tokens This Month</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(overview?.totalTokensThisMonth ?? 0).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">
              In: {(overview?.inputTokensThisMonth ?? 0).toLocaleString()} · Out: {(overview?.outputTokensThisMonth ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.activeCompanies ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.activeUsers ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cost Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {costBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={costBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `$${value.toFixed(2)}`}>
                    {costBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">No cost data this month yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 Companies by Estimated Cost</CardTitle>
          </CardHeader>
          <CardContent>
            {topCompanies.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead className="text-right">Input Tokens</TableHead>
                    <TableHead className="text-right">Output Tokens</TableHead>
                    <TableHead className="text-right">Input Cost</TableHead>
                    <TableHead className="text-right">Output Cost</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCompanies.map((c: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.companyName}</TableCell>
                      <TableCell className="text-right">{Number(c.promptTokens ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(c.candidateTokens ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">${parseFloat(c.inputCost ?? 0).toFixed(4)}</TableCell>
                      <TableCell className="text-right">${parseFloat(c.outputCost ?? 0).toFixed(4)}</TableCell>
                      <TableCell className="text-right">${parseFloat(c.totalCost).toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">No token usage data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
