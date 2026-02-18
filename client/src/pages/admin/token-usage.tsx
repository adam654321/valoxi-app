import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

function buildQs(from: string, to: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function TokenTable({ rows, columns }: { rows: any[]; columns: { key: string; label: string; align?: string }[] }) {
  const totals: Record<string, number> = {};
  columns.forEach((c) => {
    if (["totalTokens", "promptTokens", "candidateTokens"].includes(c.key)) {
      totals[c.key] = rows.reduce((s, r) => s + Number(r[c.key] ?? 0), 0);
    }
    if (c.key === "totalCost") {
      totals[c.key] = rows.reduce((s, r) => s + parseFloat(r[c.key] ?? 0), 0);
    }
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((c) => (
            <TableHead key={c.key} className={c.align === "right" ? "text-right" : ""}>{c.label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow><TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>
        ) : (
          <>
            {rows.map((r: any, i: number) => (
              <TableRow key={i}>
                {columns.map((c) => (
                  <TableCell key={c.key} className={c.align === "right" ? "text-right font-mono" : ""}>
                    {c.key === "totalCost" ? `$${parseFloat(r[c.key] ?? 0).toFixed(4)}` : (["totalTokens", "promptTokens", "candidateTokens"].includes(c.key) ? Number(r[c.key] ?? 0).toLocaleString() : r[c.key])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-semibold">
              {columns.map((c, ci) => (
                <TableCell key={c.key} className={c.align === "right" ? "text-right font-mono" : ""}>
                  {ci === 0 ? "Total" : totals[c.key] !== undefined ? (c.key === "totalCost" ? `$${totals[c.key].toFixed(4)}` : totals[c.key].toLocaleString()) : ""}
                </TableCell>
              ))}
            </TableRow>
          </>
        )}
      </TableBody>
    </Table>
  );
}

export default function AdminTokenUsage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: byCompany, isLoading: l1 } = useQuery<any>({
    queryKey: ["/api/v2/admin/token-usage/by-company", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/v2/admin/token-usage/by-company${buildQs(from, to)}`, { credentials: "include" });
      return res.json();
    },
    select: (r: any) => r?.data ?? r,
  });

  const { data: byDeal, isLoading: l2 } = useQuery<any>({
    queryKey: ["/api/v2/admin/token-usage/by-deal", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/v2/admin/token-usage/by-deal${buildQs(from, to)}`, { credentials: "include" });
      return res.json();
    },
    select: (r: any) => r?.data ?? r,
  });

  const { data: byService, isLoading: l3 } = useQuery<any>({
    queryKey: ["/api/v2/admin/token-usage/by-service", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/v2/admin/token-usage/by-service${buildQs(from, to)}`, { credentials: "include" });
      return res.json();
    },
    select: (r: any) => r?.data ?? r,
  });

  const loading = l1 || l2 || l3;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Token Usage</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Date Range Filter</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="space-y-1">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="company">
          <TabsList>
            <TabsTrigger value="company">By Company</TabsTrigger>
            <TabsTrigger value="deal">By Deal</TabsTrigger>
            <TabsTrigger value="service">By Service</TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <Card>
              <CardContent className="pt-6">
                <TokenTable
                  rows={byCompany ?? []}
                  columns={[
                    { key: "companyName", label: "Company" },
                    { key: "totalTokens", label: "Total Tokens", align: "right" },
                    { key: "totalCost", label: "Estimated Cost", align: "right" },
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deal">
            <Card>
              <CardContent className="pt-6">
                <TokenTable
                  rows={byDeal ?? []}
                  columns={[
                    { key: "dealName", label: "Deal" },
                    { key: "totalTokens", label: "Total Tokens", align: "right" },
                    { key: "totalCost", label: "Estimated Cost", align: "right" },
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="service">
            <Card>
              <CardContent className="pt-6">
                <TokenTable
                  rows={byService ?? []}
                  columns={[
                    { key: "service", label: "Service" },
                    { key: "totalTokens", label: "Total Tokens", align: "right" },
                    { key: "totalCost", label: "Estimated Cost", align: "right" },
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
