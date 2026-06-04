import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Download, Copy, Users, DollarSign, TrendingUp, Loader2, RefreshCw, Save } from "lucide-react";

interface InvoiceMember {
  companyName: string;
  email: string | null;
  planKey: string;
  signedUpAt: string;
  freeMonths: number;
  invoiceAmount: number;
}

interface InvoiceSummary {
  newMembers: number;
  totalInvoiceAmount: number;
  avgPerMember: number;
}

interface InvoiceData {
  month: string;
  source: string;
  monthlyRate: number;
  summary: InvoiceSummary;
  members: InvoiceMember[];
}

interface InvoiceRecord {
  id: number;
  userCompanyId: number;
  invoiceMonth: string;
  amountCents: number;
  memberEmail: string | null;
  status: string;
  sentAt: string | null;
  createdAt: string;
}

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    options.push({ value, label });
  }
  return options;
}

export default function AdminReferralInvoice() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [source, setSource] = useState("5d_community");

  const monthOptions = getMonthOptions();

  const { data, isLoading } = useQuery<{ success: boolean; data: InvoiceData }>({
    queryKey: ["/api/v2/admin/referral-invoice", month, source],
    queryFn: async () => {
      const params = new URLSearchParams({ month, source });
      const res = await fetch(`/api/v2/admin/referral-invoice?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch invoice data");
      return res.json();
    },
  });

  const invoice = data?.data;
  const summary = invoice?.summary;
  const members = invoice?.members ?? [];

  // History
  const { data: historyData, isLoading: historyLoading } = useQuery<{
    success: boolean;
    data: { records: Array<{ record: InvoiceRecord; companyName: string | null }> };
  }>({
    queryKey: ["/api/v2/admin/referral-invoice-records"],
    queryFn: async () => {
      const res = await fetch("/api/v2/admin/referral-invoice-records", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch invoice history");
      return res.json();
    },
  });
  const historyRecords = historyData?.data?.records ?? [];

  const resend = useMutation<unknown, Error, number>({
    mutationFn: async (userCompanyId: number) => {
      const res = await fetch(`/api/v2/admin/referral-invoice-records/${userCompanyId}/resend`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json?.data?.success) throw new Error(json?.data?.message || "Resend failed");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Resent", description: "Invoice resent to the partner." });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/referral-invoice-records"] });
    },
    onError: (e) => toast({ title: "Resend failed", description: e.message, variant: "destructive" }),
  });

  // Settings (system_config)
  const { data: configData } = useQuery<{ success: boolean; data: unknown }>({
    queryKey: ["/api/v2/admin/system-config"],
    queryFn: async () => {
      const res = await fetch("/api/v2/admin/system-config", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
  });

  const configList: { key: string; value: string }[] = (() => {
    const raw: any = configData?.data;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.configs)) return raw.configs;
    return [];
  })();
  const configMap: Record<string, string> = Object.fromEntries(configList.map((c) => [c.key, c.value]));

  const [sendDay, setSendDay] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");

  useEffect(() => {
    if (configMap["five_d_invoice_send_day"] !== undefined) setSendDay(configMap["five_d_invoice_send_day"]);
    if (configMap["five_d_partner_invoice_email"] !== undefined) setPartnerEmail(configMap["five_d_partner_invoice_email"]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configData]);

  const saveSettings = useMutation<unknown, Error, void>({
    mutationFn: async () => {
      const day = String(Math.min(28, Math.max(1, parseInt(sendDay || "7", 10) || 7)));
      const post = async (key: string, value: string) => {
        const res = await fetch("/api/v2/admin/system-config", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value }),
        });
        if (!res.ok) throw new Error(`Failed to save ${key}`);
      };
      await post("five_d_invoice_send_day", day);
      await post("five_d_partner_invoice_email", partnerEmail.trim());
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Invoice settings updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/system-config"] });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleExportCsv = () => {
    if (!members.length) return;
    const header = "Company Name,Email,Plan,Signed Up,Free Months,Upfront Subsidy\n";
    const rows = members
      .map((m) =>
        `"${m.companyName || ""}","${m.email || ""}","${m.planKey}","${m.signedUpAt ? new Date(m.signedUpAt).toLocaleDateString() : ""}",${m.freeMonths},${m.invoiceAmount.toFixed(2)}`
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `5d-subsidy-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyInvoiceText = () => {
    if (!invoice || !summary) return;
    const monthLabel = new Date(month + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const lines = [
      `5D Community Subsidy Report — ${monthLabel}`,
      `Source: ${invoice.source}`,
      `Rate: $${invoice.monthlyRate.toFixed(2)}/member/month, billed upfront for the full free period`,
      "",
      `New Members This Month: ${summary.newMembers}`,
      `Total Upfront Subsidy: $${summary.totalInvoiceAmount.toFixed(2)}`,
      "",
      "Members:",
      ...members.map(
        (m) =>
          `  ${m.companyName || "Unknown"} (${m.email || "N/A"}) — ${m.planKey} — ${m.freeMonths} months upfront — $${m.invoiceAmount.toFixed(2)}`
      ),
      "",
      `Total: $${summary.totalInvoiceAmount.toFixed(2)}`,
    ];

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      toast({ title: "Copied", description: "Subsidy text copied to clipboard." });
    });
  };

  const statusClass = (s: string) =>
    s === "sent"
      ? "bg-green-100 text-green-800"
      : s === "failed"
      ? "bg-red-100 text-red-800"
      : "bg-amber-100 text-amber-800";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">5D Subsidy Report</h1>
          <p className="text-sm text-muted-foreground mt-1">
            New 5D members billed upfront for their full free period.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5d_community">5D Community</SelectItem>
              <SelectItem value="partner">Partner</SelectItem>
              <SelectItem value="internal">Internal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{summary.newMembers}</p>
                  <p className="text-xs text-muted-foreground">New Members This Month</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">${summary.totalInvoiceAmount.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Total Upfront Subsidy</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-2xl font-bold">${summary.avgPerMember.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Avg per Member</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Members</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={members.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopyInvoiceText} disabled={!summary}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Subsidy Text
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Signed Up</TableHead>
                  <TableHead className="text-right">Free Months</TableHead>
                  <TableHead className="text-right">Upfront Subsidy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No new members for this month
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{m.companyName || "—"}</TableCell>
                      <TableCell>{m.email || "—"}</TableCell>
                      <TableCell>{m.planKey.charAt(0) + m.planKey.slice(1).toLowerCase()}</TableCell>
                      <TableCell>
                        {m.signedUpAt ? new Date(m.signedUpAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">{m.freeMonths}</TableCell>
                      <TableCell className="text-right font-medium">${m.invoiceAmount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {members.length > 0 && summary && (
            <div className="flex justify-end mt-4 pt-4 border-t">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Upfront Subsidy</p>
                <p className="text-xl font-bold">${summary.totalInvoiceAmount.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  {summary.newMembers} new member{summary.newMembers !== 1 ? "s" : ""} billed upfront
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No invoices recorded yet
                    </TableCell>
                  </TableRow>
                ) : (
                  historyRecords.map(({ record, companyName }) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{companyName || "—"}</TableCell>
                      <TableCell>{record.invoiceMonth}</TableCell>
                      <TableCell className="text-right">${(record.amountCents / 100).toFixed(2)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${statusClass(record.status)}`}>
                          {record.status}
                        </span>
                      </TableCell>
                      <TableCell>{record.sentAt ? new Date(record.sentAt).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resend.mutate(record.userCompanyId)}
                          disabled={resend.isPending}
                        >
                          {resend.isPending && resend.variables === record.userCompanyId ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          Resend
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1 max-w-xs">
            <label className="text-sm font-medium">Send day of month (1–28)</label>
            <Input
              type="number"
              min={1}
              max={28}
              value={sendDay}
              onChange={(e) => setSendDay(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The digest runs on this day each month, billing the prior month. Default 7.
            </p>
          </div>
          <div className="flex flex-col gap-1 max-w-md">
            <label className="text-sm font-medium">Partner invoice email</label>
            <Input
              type="email"
              value={partnerEmail}
              onChange={(e) => setPartnerEmail(e.target.value)}
              placeholder="partner@example.com"
            />
            <p className="text-xs text-muted-foreground">
              The monthly digest is sent here. Leave blank to pause sending.
            </p>
          </div>
          <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
            {saveSettings.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
