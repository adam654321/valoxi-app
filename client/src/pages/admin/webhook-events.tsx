import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const COLLISION_ERROR = "duplicate_checkout_existing_subscription";

export default function AdminWebhookEvents() {
  const [collisionsOnly, setCollisionsOnly] = useState(false);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/v2/admin/webhook-events", { collisionsOnly }],
    queryFn: async () => {
      const url = collisionsOnly
        ? `/api/v2/admin/webhook-events?error=${encodeURIComponent(COLLISION_ERROR)}`
        : "/api/v2/admin/webhook-events";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`webhook-events fetch failed: ${res.status}`);
      return res.json();
    },
    select: (r: any) => r?.data ?? r,
  });

  const rows = data?.rows ?? [];

  const isCollision = (e: any) =>
    e.status === "error" && e.error === COLLISION_ERROR;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusColor = (s: string) => {
    if (s === "processed") return "default";
    if (s === "failed") return "destructive";
    return "secondary";
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Webhook Events</h1>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={collisionsOnly}
              onChange={(ev) => setCollisionsOnly(ev.target.checked)}
            />
            Collisions only (double-payment)
          </label>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No webhook events</TableCell></TableRow>
              ) : (
                rows.map((e: any) => (
                  <TableRow key={e.id} className={isCollision(e) ? "bg-destructive/10" : undefined}>
                    <TableCell className="font-medium">{e.source}</TableCell>
                    <TableCell>{e.eventType}</TableCell>
                    <TableCell>
                      {isCollision(e)
                        ? <Badge variant="destructive">collision</Badge>
                        : <Badge variant={statusColor(e.status)}>{e.status}</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[260px]">
                      {isCollision(e) ? (
                        <div className="space-y-1">
                          <div className="truncate">{e.error}</div>
                          <div className="text-xs break-all">
                            email: {e.payload?.customer_details?.email ?? "—"}
                            {" · refused sub: "}
                            {e.payload?.subscription ?? "—"}
                          </div>
                        </div>
                      ) : (
                        <div className="truncate">{e.error ?? "—"}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{new Date(e.createdAt).toLocaleString()}</TableCell>
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
