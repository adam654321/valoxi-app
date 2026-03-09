import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminCompanies() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: companies, isLoading } = useQuery<any>({
    queryKey: ["/api/v2/admin/companies"],
    select: (r: any) => r?.data ?? r,
  });

  const planOverrideMutation = useMutation({
    mutationFn: async ({ companyId, planOverride }: { companyId: number; planOverride: string | null }) => {
      return apiRequest("POST", `/api/v2/admin/companies/${companyId}/plan-override`, { planOverride });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/companies"] });
      toast({ title: "Plan override updated" });
    },
    onError: () => {
      toast({ title: "Failed to update plan override", variant: "destructive" });
    },
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
                <TableHead>Beta Plan Override</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead className="text-right">Deals</TableHead>
                <TableHead className="text-right">Total Token Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(companies ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No companies</TableCell></TableRow>
              ) : (
                (companies ?? []).map((c: any) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell
                      className="font-medium"
                      onClick={() => setLocation(`/admin/companies/${c.id}`)}
                    >
                      <div className="flex items-center gap-2">
                        {c.companyName}
                        {c.betaPlanOverride && (
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700 text-xs">
                            BETA OVERRIDE: {c.betaPlanOverride.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={c.betaPlanOverride ?? "none"}
                        onValueChange={(value) => {
                          planOverrideMutation.mutate({
                            companyId: c.id,
                            planOverride: value === "none" ? null : value,
                          });
                        }}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Override</SelectItem>
                          <SelectItem value="core">Core</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="expert">Expert</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right" onClick={() => setLocation(`/admin/companies/${c.id}`)}>{c.userCount}</TableCell>
                    <TableCell className="text-right" onClick={() => setLocation(`/admin/companies/${c.id}`)}>{c.dealCount}</TableCell>
                    <TableCell className="text-right font-mono" onClick={() => setLocation(`/admin/companies/${c.id}`)}>${parseFloat(c.totalTokenCost ?? 0).toFixed(4)}</TableCell>
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
