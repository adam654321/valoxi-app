import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Copy, Users, PoundSterling, TrendingUp, Tag, Loader2, FileText, ExternalLink } from "lucide-react";

const INVOICE_RATE = 50.25;

interface InvoiceMember {
  companyName: string;
  email: string | null;
  planKey: string;
  freeMonthsStartedAt: string;
  monthsElapsed: number;
  monthsRemaining: number;
  invoiceAmount: number;
  isInFreePeriod: boolean;
}

interface InvoiceSummary {
  totalMembersOnFreePeriod: number;
  totalInvoiceAmount: number;
  avgPerMember: number;
  codesRemainingUnclaimed: number;
}

interface InvoiceData {
  month: string;
  source: string;
  invoiceRate: number;
  summary: InvoiceSummary;
  members: InvoiceMember[];
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

interface PartnerInvoiceItem {
  id: string;
  description: string;
  amount: number;
  currency: string;
  quantity: number;
}

interface PartnerInvoicePreview {
  itemCount: number;
  totalAmount: number;
  currency: string;
  items: PartnerInvoiceItem[];
}

interface PartnerInvoiceResult {
  invoiceId: string;
  invoiceUrl: string;
  total: number;
  currency: string;
}

export default function AdminReferralInvoice() {
  const { toast } = useToast();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [source, setSource] = useState("5d_community");
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewData, setPreviewData] = useState<PartnerInvoicePreview | null>(null);
  const [invoiceResult, setInvoiceResult] = useState<PartnerInvoiceResult | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/v2/admin/partner-invoice/preview");
      return res.json();
    },
    onSuccess: (data: { success: boolean; data: PartnerInvoicePreview }) => {
      if (data.data.itemCount === 0) {
        toast({ title: "No pending items", description: "There are no pending invoice items for the partner account." });
        return;
      }
      setPreviewData(data.data);
      setShowPreviewDialog(true);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to fetch pending invoice items.", variant: "destructive" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/v2/admin/partner-invoice/generate");
      return res.json();
    },
    onSuccess: (data: { success: boolean; data: PartnerInvoiceResult }) => {
      setShowPreviewDialog(false);
      setInvoiceResult(data.data);
      setShowResultDialog(true);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate invoice.", variant: "destructive" });
    },
  });

  const formatAmount = (amount: number, currency: string) => {
    const symbol = currency === 'usd' ? '$' : '£';
    return `${symbol}${(amount / 100).toFixed(2)}`;
  };

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
  const activeMembers = members.filter((m) => m.isInFreePeriod);

  const handleExportCsv = () => {
    if (!members.length) return;
    const header = "Company Name,Email,Plan,Free Period Start,Months Elapsed,Months Remaining,Invoice Amount\n";
    const rows = members
      .filter((m) => m.isInFreePeriod)
      .map((m) =>
        `"${m.companyName || ""}","${m.email || ""}","${m.planKey}","${m.freeMonthsStartedAt ? new Date(m.freeMonthsStartedAt).toLocaleDateString() : ""}",${m.monthsElapsed},${m.monthsRemaining},${m.invoiceAmount.toFixed(2)}`
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `5d-invoice-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyInvoiceText = () => {
    if (!invoice || !summary) return;
    const monthLabel = new Date(month + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const lines = [
      `5D Community Invoice — ${monthLabel}`,
      `Source: ${invoice.source}`,
      `Rate: £${INVOICE_RATE.toFixed(2)}/member/month`,
      "",
      `Total Members on Free Period: ${summary.totalMembersOnFreePeriod}`,
      `Total Invoice Amount: £${summary.totalInvoiceAmount.toFixed(2)}`,
      "",
      "Members:",
      ...activeMembers.map(
        (m) =>
          `  ${m.companyName || "Unknown"} (${m.email || "N/A"}) — ${m.planKey} — Elapsed: ${m.monthsElapsed}m, Remaining: ${m.monthsRemaining}m — £${m.invoiceAmount.toFixed(2)}`
      ),
      "",
      `Total: £${summary.totalInvoiceAmount.toFixed(2)}`,
    ];

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      toast({ title: "Copied", description: "Invoice text copied to clipboard." });
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">5D Invoice Report</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monthly invoice for community referral free-period members.
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
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{summary.totalMembersOnFreePeriod}</p>
                  <p className="text-xs text-muted-foreground">Members on Free Period</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <PoundSterling className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">£{summary.totalInvoiceAmount.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Total Invoice Amount</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-2xl font-bold">£{summary.avgPerMember.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Avg per Member</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Tag className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">{summary.codesRemainingUnclaimed}</p>
                  <p className="text-xs text-muted-foreground">Codes Remaining Unclaimed</p>
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
              <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={activeMembers.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopyInvoiceText} disabled={!summary}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Invoice Text
              </Button>
              <Button
                size="sm"
                onClick={() => previewMutation.mutate()}
                disabled={previewMutation.isPending}
              >
                {previewMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Generate Partner Invoice
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
                  <TableHead>Free Period Start</TableHead>
                  <TableHead className="text-right">Months Elapsed</TableHead>
                  <TableHead className="text-right">Months Remaining</TableHead>
                  <TableHead className="text-right">This Month's Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No members on free period for this month
                    </TableCell>
                  </TableRow>
                ) : (
                  activeMembers.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{m.companyName || "—"}</TableCell>
                      <TableCell>{m.email || "—"}</TableCell>
                      <TableCell>{m.planKey.charAt(0) + m.planKey.slice(1).toLowerCase()}</TableCell>
                      <TableCell>
                        {m.freeMonthsStartedAt
                          ? new Date(m.freeMonthsStartedAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">{m.monthsElapsed}</TableCell>
                      <TableCell className="text-right">{m.monthsRemaining}</TableCell>
                      <TableCell className="text-right font-medium">£{m.invoiceAmount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {activeMembers.length > 0 && summary && (
            <div className="flex justify-end mt-4 pt-4 border-t">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Invoice</p>
                <p className="text-xl font-bold">£{summary.totalInvoiceAmount.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  {summary.totalMembersOnFreePeriod} member{summary.totalMembersOnFreePeriod !== 1 ? "s" : ""} × £{INVOICE_RATE.toFixed(2)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Partner Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              {previewData && (
                <div className="space-y-3 mt-2">
                  <p className="text-sm">
                    <strong>{previewData.itemCount}</strong> pending item{previewData.itemCount !== 1 ? "s" : ""} totalling{" "}
                    <strong>{formatAmount(previewData.totalAmount, previewData.currency)}</strong>
                  </p>
                  <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-1">
                    {previewData.items.map((item) => (
                      <p key={item.id} className="text-xs text-muted-foreground">
                        {item.description} — {formatAmount(item.amount, item.currency)}
                      </p>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This will create a draft invoice in Stripe. You can review it before sending.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Invoice Created</AlertDialogTitle>
            <AlertDialogDescription>
              {invoiceResult && (
                <div className="space-y-2 mt-2">
                  <p className="text-sm">
                    Invoice <strong>{invoiceResult.invoiceId}</strong> created for{" "}
                    <strong>{formatAmount(invoiceResult.total, invoiceResult.currency)}</strong>.
                  </p>
                  <p className="text-sm">Review in Stripe before sending.</p>
                  {invoiceResult.invoiceUrl && (
                    <a
                      href={invoiceResult.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View in Stripe
                    </a>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Done</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
