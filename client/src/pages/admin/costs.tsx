import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus } from "lucide-react";

const addCostSchema = z.object({
  costType: z.string().min(1, "Required"),
  provider: z.string().min(1, "Required"),
  description: z.string().min(1, "Required"),
  periodStart: z.string().min(1, "Required"),
  periodEnd: z.string().min(1, "Required"),
  amountUsd: z.string().min(1, "Required").refine((v) => !isNaN(Number(v)) && Number(v) >= 0, "Must be a valid number"),
  notes: z.string().optional(),
});

type AddCostForm = z.infer<typeof addCostSchema>;

export default function AdminCosts() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: costs, isLoading } = useQuery<any>({
    queryKey: ["/api/v2/admin/costs"],
    select: (r: any) => r?.data ?? r,
  });

  const form = useForm<AddCostForm>({
    resolver: zodResolver(addCostSchema),
    defaultValues: { costType: "", provider: "", description: "", periodStart: "", periodEnd: "", amountUsd: "", notes: "" },
  });

  const mutation = useMutation({
    mutationFn: async (data: AddCostForm) => {
      const res = await apiRequest("POST", "/api/v2/admin/costs", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/costs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/overview"] });
      form.reset();
      setOpen(false);
      toast({ title: "Cost entry added" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const rows = costs ?? [];
  const byType = (type: string) => rows.filter((r: any) => r.costType === type).reduce((s: number, r: any) => s + parseFloat(r.amountUsd ?? 0), 0);
  const googleTotal = byType("google_api");
  const replitTotal = byType("replit_storage") + byType("replit_compute");
  const otherTotal = byType("other");
  const grandTotal = googleTotal + replitTotal + otherTotal;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Platform Costs</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Cost</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Platform Cost</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
                <FormField control={form.control} name="costType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="google_api">Google API</SelectItem>
                        <SelectItem value="replit_storage">Replit Storage</SelectItem>
                        <SelectItem value="replit_compute">Replit Compute</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="provider" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. Google Cloud" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. Gemini API usage - Feb 2026" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="periodStart" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period Start</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="periodEnd" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period End</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="amountUsd" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (USD)</FormLabel>
                    <FormControl><Input {...field} placeholder="0.00" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl><Textarea {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={mutation.isPending}>
                  {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add Cost Entry
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Google API</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">${googleTotal.toFixed(2)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Replit</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">${replitTotal.toFixed(2)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Other</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">${otherTotal.toFixed(2)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Grand Total</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">${grandTotal.toFixed(2)}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date Range</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No cost entries yet</TableCell></TableRow>
              ) : (
                rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.periodStart} – {r.periodEnd}</TableCell>
                    <TableCell>{r.costType}</TableCell>
                    <TableCell>{r.provider}</TableCell>
                    <TableCell>{r.description}</TableCell>
                    <TableCell className="text-right font-mono">${parseFloat(r.amountUsd).toFixed(2)}</TableCell>
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
