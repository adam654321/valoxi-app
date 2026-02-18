import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export default function AdminWebhookEvents() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/v2/admin/webhook-events"],
    select: (r: any) => r?.data ?? r,
  });

  const rows = data?.rows ?? [];

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
        <CardContent className="pt-6">
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
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.source}</TableCell>
                    <TableCell>{e.eventType}</TableCell>
                    <TableCell><Badge variant={statusColor(e.status)}>{e.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{e.error ?? "—"}</TableCell>
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
