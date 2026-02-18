import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

export default function AdminCompanies() {
  const [, setLocation] = useLocation();

  const { data: companies, isLoading } = useQuery<any>({
    queryKey: ["/api/v2/admin/companies"],
    select: (r: any) => r?.data ?? r,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Companies</h1>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead className="text-right">Deals</TableHead>
                <TableHead className="text-right">Total Token Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(companies ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No companies</TableCell></TableRow>
              ) : (
                (companies ?? []).map((c: any) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setLocation(`/admin/companies/${c.id}`)}
                  >
                    <TableCell className="font-medium">{c.companyName}</TableCell>
                    <TableCell className="text-right">{c.userCount}</TableCell>
                    <TableCell className="text-right">{c.dealCount}</TableCell>
                    <TableCell className="text-right font-mono">${parseFloat(c.totalTokenCost ?? 0).toFixed(4)}</TableCell>
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
