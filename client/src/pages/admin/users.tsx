import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Loader2, KeyRound, Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminUsers() {
  const { toast } = useToast();
  const [resetTarget, setResetTarget] = useState<{ id: number; name: string } | null>(null);

  const { data: users, isLoading } = useQuery<any>({
    queryKey: ["/api/v2/admin/users"],
    select: (r: any) => r?.data ?? r,
  });

  const resetMutation = useMutation({
    mutationFn: async ({ userId }: { userId: number }) => {
      const res = await apiRequest("POST", `/api/v2/admin/users/${userId}/reset-password`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: data?.data?.message || "Sign-in link sent." });
      setResetTarget(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message || "Failed to send sign-in link.", variant: "destructive" });
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
      <h1 className="text-2xl font-bold">Users</h1>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No users</TableCell></TableRow>
              ) : (
                (users ?? []).map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.firstName} {u.lastName}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.companyName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{u.userRole ?? u.role}</TableCell>
                    <TableCell>
                      {u.isSystemAdmin ? <Badge variant="default" className="bg-amber-500">System Admin</Badge> : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "Never"}
                    </TableCell>
                    <TableCell>
                      {u.isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">Inactive</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!u.isSystemAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="View app as this user"
                            onClick={async () => {
                              try {
                                const res = await apiRequest('POST', `/api/v2/admin/users/${u.id}/view-as`);
                                if (res.ok) {
                                  window.location.href = '/dashboard';
                                } else {
                                  const body = await res.json();
                                  toast({ title: 'Error', description: body.message || 'Failed to switch view', variant: 'destructive' });
                                }
                              } catch {
                                toast({ title: 'Error', description: 'Failed to switch view', variant: 'destructive' });
                              }
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setResetTarget({ id: u.id, name: `${u.firstName} ${u.lastName}` })}
                          title="Send sign-in link"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!resetTarget} onOpenChange={(open) => { if (!open) setResetTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Sign-in Link</DialogTitle>
            <DialogDescription>
              This will send a one-time sign-in link to <strong>{resetTarget?.name}</strong>. The link expires in 24 hours.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => resetTarget && resetMutation.mutate({ userId: resetTarget.id })}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? "Sending..." : "Send Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
