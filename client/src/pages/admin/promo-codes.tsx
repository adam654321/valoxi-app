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
import { Loader2, RefreshCw, ExternalLink, Plus, Download } from "lucide-react";

interface StripeCoupon {
  id: string;
  name: string | null;
  percentOff: number | null;
  amountOff: number | null;
  duration: string;
  durationInMonths: number | null;
  valid: boolean;
}

interface Campaign {
  id: number;
  name: string;
  stripeCouponId: string;
  referralSource: string;
  freeMonthsTotal: number;
  codePrefix: string;
  maxUsesPerCode: number;
  expiresAt: string | null;
  createdAt: string;
  generatedCount: number;
  claimedCount: number;
  remainingCount: number;
}

interface PromoCodeRow {
  id: number;
  campaignId: number;
  code: string;
  usesCount: number;
  maxUses: number;
  claimedByUserCompanyId: number | null;
  claimedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  companyName: string | null;
}

function formatDiscount(coupon: StripeCoupon): string {
  if (coupon.percentOff) return `${coupon.percentOff}% off`;
  if (coupon.amountOff) return `£${(coupon.amountOff / 100).toFixed(2)} off`;
  return "—";
}

function formatDuration(coupon: StripeCoupon): string {
  if (coupon.duration === "forever") return "Forever";
  if (coupon.duration === "once") return "Once";
  if (coupon.duration === "repeating" && coupon.durationInMonths) return `${coupon.durationInMonths} months`;
  return coupon.duration;
}

function getCodeStatus(code: PromoCodeRow): { label: string; className: string } {
  if (code.claimedAt) return { label: "Claimed", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" };
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) return { label: "Expired", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" };
  return { label: "Unclaimed", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" };
}

export default function AdminPromoCodes() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [formName, setFormName] = useState("");
  const [formStripeCouponId, setFormStripeCouponId] = useState("");
  const [formReferralSource, setFormReferralSource] = useState("");
  const [formFreeMonths, setFormFreeMonths] = useState("0");
  const [formCodePrefix, setFormCodePrefix] = useState("");
  const [formCodeCount, setFormCodeCount] = useState("10");
  const [formMaxUses, setFormMaxUses] = useState("1");
  const [formExpiresAt, setFormExpiresAt] = useState("");

  const { data: couponsData, isLoading: couponsLoading, refetch: refetchCoupons } = useQuery<{ success: boolean; data: StripeCoupon[] }>({
    queryKey: ["/api/v2/admin/stripe-coupons"],
  });

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery<{ success: boolean; data: Campaign[] }>({
    queryKey: ["/api/v2/admin/promo-campaigns"],
  });

  const buildCodesUrl = () => {
    const params = new URLSearchParams();
    if (campaignFilter !== "all") params.set("campaignId", campaignFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const qs = params.toString();
    return `/api/v2/admin/promo-codes${qs ? `?${qs}` : ""}`;
  };

  const { data: codesData, isLoading: codesLoading } = useQuery<{ success: boolean; data: PromoCodeRow[] }>({
    queryKey: ["/api/v2/admin/promo-codes", campaignFilter, statusFilter],
    queryFn: async () => {
      const res = await fetch(buildCodesUrl(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch promo codes");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/v2/admin/promo-campaigns", body);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Campaign created", description: `${data.data?.codesGenerated ?? 0} codes generated.` });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/promo-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/promo-codes"] });
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create campaign", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormStripeCouponId("");
    setFormReferralSource("");
    setFormFreeMonths("0");
    setFormCodePrefix("");
    setFormCodeCount("10");
    setFormMaxUses("1");
    setFormExpiresAt("");
  };

  const handleCreateSubmit = () => {
    createMutation.mutate({
      name: formName,
      stripeCouponId: formStripeCouponId,
      referralSource: formReferralSource,
      freeMonthsTotal: parseInt(formFreeMonths, 10) || 0,
      codePrefix: formCodePrefix,
      codeCount: parseInt(formCodeCount, 10) || 10,
      maxUsesPerCode: parseInt(formMaxUses, 10) || 1,
      expiresAt: formExpiresAt || null,
    });
  };

  const handleExport = (status?: string) => {
    const params = new URLSearchParams();
    if (campaignFilter !== "all") params.set("campaignId", campaignFilter);
    if (status) params.set("status", status);
    const qs = params.toString();
    window.open(`/api/v2/admin/promo-codes/export${qs ? `?${qs}` : ""}`, "_blank");
  };

  const coupons = couponsData?.data ?? [];
  const campaigns = campaignsData?.data ?? [];
  const codes = codesData?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Promo Codes</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage campaigns, codes, and Stripe coupons.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Stripe Coupons</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetchCoupons()}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="https://dashboard.stripe.com/coupons" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open Stripe Dashboard
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {couponsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Coupon ID</TableHead>
                  <TableHead>Valid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No coupons found in Stripe
                    </TableCell>
                  </TableRow>
                ) : (
                  coupons.map((coupon) => (
                    <TableRow key={coupon.id}>
                      <TableCell className="font-medium">{coupon.name || "—"}</TableCell>
                      <TableCell>{formatDiscount(coupon)}</TableCell>
                      <TableCell>{formatDuration(coupon)}</TableCell>
                      <TableCell className="font-mono text-xs">{coupon.id}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={coupon.valid ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"}>
                          {coupon.valid ? "Yes" : "No"}
                        </Badge>
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
          <div className="flex items-center justify-between">
            <CardTitle>Campaigns</CardTitle>
            <Button size="sm" onClick={() => { resetForm(); setCreateDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" />
              Create Campaign
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {campaignsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Stripe Coupon</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Free Months</TableHead>
                  <TableHead className="text-right">Generated</TableHead>
                  <TableHead className="text-right">Claimed</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Expiry</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No campaigns created yet
                    </TableCell>
                  </TableRow>
                ) : (
                  campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.name}</TableCell>
                      <TableCell className="font-mono text-xs">{campaign.stripeCouponId}</TableCell>
                      <TableCell>{campaign.referralSource}</TableCell>
                      <TableCell>{campaign.freeMonthsTotal}</TableCell>
                      <TableCell className="text-right">{campaign.generatedCount}</TableCell>
                      <TableCell className="text-right">{campaign.claimedCount}</TableCell>
                      <TableCell className="text-right">{campaign.remainingCount}</TableCell>
                      <TableCell>
                        {campaign.expiresAt ? new Date(campaign.expiresAt).toLocaleDateString() : "—"}
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
          <div className="flex items-center justify-between">
            <CardTitle>Code List</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Campaign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campaigns</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unclaimed">Unclaimed</SelectItem>
                  <SelectItem value="claimed">Claimed</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => handleExport()}>
                <Download className="h-4 w-4 mr-1" />
                Export All CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("unclaimed")}>
                <Download className="h-4 w-4 mr-1" />
                Export Unclaimed CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {codesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Claimed By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No codes found
                    </TableCell>
                  </TableRow>
                ) : (
                  codes.map((code) => {
                    const status = getCodeStatus(code);
                    return (
                      <TableRow key={code.id}>
                        <TableCell className="font-mono text-sm">{code.code}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={status.className}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>{code.companyName || "—"}</TableCell>
                        <TableCell>
                          {code.claimedAt ? new Date(code.claimedAt).toLocaleDateString() : "—"}
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

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Campaign Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. 5D Community Launch" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Stripe Coupon ID</Label>
              <Select value={formStripeCouponId} onValueChange={setFormStripeCouponId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a coupon" />
                </SelectTrigger>
                <SelectContent>
                  {coupons.filter((c) => c.valid).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name || c.id} — {formatDiscount(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Referral Source</Label>
              <Input value={formReferralSource} onChange={(e) => setFormReferralSource(e.target.value)} placeholder="e.g. 5d_community" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Free Months</Label>
                <Input type="number" min="0" value={formFreeMonths} onChange={(e) => setFormFreeMonths(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Code Prefix</Label>
                <Input value={formCodePrefix} onChange={(e) => setFormCodePrefix(e.target.value)} placeholder="e.g. 5DA" maxLength={10} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Number of Codes</Label>
                <Input type="number" min="1" max="1000" value={formCodeCount} onChange={(e) => setFormCodeCount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Max Uses per Code</Label>
                <Input type="number" min="1" value={formMaxUses} onChange={(e) => setFormMaxUses(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Expires At (optional)</Label>
              <Input type="date" value={formExpiresAt} onChange={(e) => setFormExpiresAt(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateSubmit}
              disabled={createMutation.isPending || !formName || !formStripeCouponId || !formReferralSource}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
