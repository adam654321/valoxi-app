import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Copy, Loader2 } from "lucide-react";

interface PromoCampaign {
  id: number;
  name: string;
  slug: string;
  stripeCouponId: string;
  referralSource: string;
  freeMonthsTotal: number;
  maxTotalClaims: number | null;
  isActive: boolean;
  postFreePeriodCouponId: string | null;
  expiresAt: string | null;
  createdAt: string;
  totalClaimedByUsers: number;
}

const SITE_BASE = "https://valoxi.ai/";
const WELCOME_APP_BASE = "https://app.valoxi.ai/welcome";
const WELCOME_SLUG = "welcome";

const emptyForm = {
  name: "",
  slug: "",
  stripeCouponId: "",
  referralSource: "",
  freeMonthsTotal: "0",
  maxTotalClaims: "",
  isActive: true,
  expiresAt: "",
};

export default function AdminPromoCampaigns() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: campaignsData, isLoading } = useQuery<{ success: boolean; data: PromoCampaign[] }>({
    queryKey: ["/api/v2/admin/promo-campaigns"],
  });
  const campaigns = campaignsData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/v2/admin/promo-campaigns", body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Campaign created", description: "The promo campaign is now live." });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/promo-campaigns"] });
      setCreateOpen(false);
      setForm({ ...emptyForm });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create campaign", description: error.message, variant: "destructive" });
    },
  });

  function promoUrl(slug: string) {
    return slug === WELCOME_SLUG
      ? `${WELCOME_APP_BASE}?promo=${slug}`
      : `${SITE_BASE}?promo=${slug}`;
  }

  function copyPromoUrl(slug: string) {
    const url = promoUrl(slug);
    navigator.clipboard.writeText(url);
    toast({ title: "URL copied", description: url });
  }

  function handleCreate() {
    if (!form.name.trim() || !form.slug.trim() || !form.stripeCouponId.trim() || !form.referralSource.trim()) {
      toast({
        title: "Missing fields",
        description: "Name, slug, coupon ID and referral source are required.",
        variant: "destructive",
      });
      return;
    }
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase(),
      stripeCouponId: form.stripeCouponId.trim(),
      referralSource: form.referralSource.trim().toLowerCase(),
      freeMonthsTotal: Number(form.freeMonthsTotal) || 0,
      isActive: form.isActive,
    };
    if (form.maxTotalClaims.trim() !== "") {
      body.maxTotalClaims = Number(form.maxTotalClaims);
    }
    if (form.expiresAt.trim() !== "") {
      body.expiresAt = new Date(form.expiresAt).toISOString();
    }
    createMutation.mutate(body);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Promo Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Each campaign has a URL slug. Share the welcome URL to apply the campaign automatically.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Referral source</TableHead>
                  <TableHead>Free months</TableHead>
                  <TableHead>Claims</TableHead>
                  <TableHead>Coupon</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell><code className="text-xs">{c.slug}</code></TableCell>
                    <TableCell>{c.referralSource}</TableCell>
                    <TableCell>{c.freeMonthsTotal}</TableCell>
                    <TableCell>
                      {c.totalClaimedByUsers}
                      {c.maxTotalClaims != null ? ` / ${c.maxTotalClaims}` : ""}
                    </TableCell>
                    <TableCell><code className="text-xs">{c.stripeCouponId}</code></TableCell>
                    <TableCell>
                      <Badge variant={c.isActive ? "default" : "secondary"}>
                        {c.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => copyPromoUrl(c.slug)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy URL
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New promo campaign</DialogTitle>
            <DialogDescription>
              {`The slug becomes the public URL: ${SITE_BASE}?promo=<slug> (or ${WELCOME_APP_BASE}?promo=welcome for the welcome campaign)`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pc-name">Name</Label>
              <Input
                id="pc-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-slug">Slug</Label>
              <Input
                id="pc-slug"
                value={form.slug}
                placeholder="e.g. early-bird"
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers and hyphens only.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-coupon">Stripe coupon ID</Label>
              <Input
                id="pc-coupon"
                value={form.stripeCouponId}
                placeholder="e.g. t7DDiD9J"
                onChange={(e) => setForm({ ...form, stripeCouponId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-source">Referral source</Label>
              <Input
                id="pc-source"
                value={form.referralSource}
                placeholder="e.g. 5d_community or early_bird"
                onChange={(e) => setForm({ ...form, referralSource: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Existing values: 5d_community, early_bird.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pc-months">Free months total</Label>
                <Input
                  id="pc-months"
                  type="number"
                  min="0"
                  value={form.freeMonthsTotal}
                  onChange={(e) => setForm({ ...form, freeMonthsTotal: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pc-max">Max total claims</Label>
                <Input
                  id="pc-max"
                  type="number"
                  min="1"
                  value={form.maxTotalClaims}
                  placeholder="Unlimited"
                  onChange={(e) => setForm({ ...form, maxTotalClaims: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-expires">Expires at</Label>
              <Input
                id="pc-expires"
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="pc-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v === true })}
              />
              <Label htmlFor="pc-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
