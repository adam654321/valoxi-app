import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSubscriptionContext, useHasFeature, usePlanKey } from "@/context/subscription-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus, Mail, Edit, Trash2, Crown, Shield, Users, RefreshCw, X, ArrowRight, AlertTriangle, ChevronDown, ChevronUp, CheckCircle2, XCircle, DollarSign, BarChart2, FileDown, FileUp, Briefcase, Pencil, Building2 } from "lucide-react";
import { Link } from "wouter";

import type { UserInvitation, UserRole, TeamMember } from "@shared/schema";

const inviteSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address"),
  jobTitle: z.string().max(100).optional(),
  role: z.string().min(1, "Role is required"),
  message: z.string().optional(),
});

const updateMemberSchema = z.object({
  role: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

type InviteFormValues = z.infer<typeof inviteSchema>;
type UpdateMemberFormValues = z.infer<typeof updateMemberSchema>;

export default function TeamManagement() {
  const { toast } = useToast();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [seatLimitDialog, setSeatLimitDialog] = useState<{ currentSeats: number; maxSeats: number; canPurchaseMore: boolean } | null>(null);
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);

  const { effectiveMaxSeats, consumedSeats } = useSubscriptionContext();
  const canPurchaseSeats = useHasFeature("additionalSeatPurchasing");
  const currentPlan = usePlanKey();

  const isAtSeatLimit = effectiveMaxSeats !== null && consumedSeats >= effectiveMaxSeats;
  const seatUsagePercent = effectiveMaxSeats !== null && effectiveMaxSeats > 0
    ? Math.min(100, Math.round((consumedSeats / effectiveMaxSeats) * 100))
    : 0;

  const seatBarColor = seatUsagePercent >= 100
    ? "[&>div]:bg-red-500"
    : seatUsagePercent >= 80
    ? "[&>div]:bg-amber-500"
    : "[&>div]:bg-green-500";

  const { data: teamMembers, isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: ['/api/v2/team/members'],
    select: (response: any) => response.data,
  });

  const { data: invitations, isLoading: invitationsLoading } = useQuery<UserInvitation[]>({
    queryKey: ['/api/v2/team/invitations'],
    select: (response: any) => response.data,
  });

  const { data: roles, isLoading: rolesLoading } = useQuery<UserRole[]>({
    queryKey: ['/api/v2/team/roles'],
    select: (response: any) => response.data,
  });

  const inviteForm = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      jobTitle: "",
      role: "",
      message: "",
    },
  });

  const updateForm = useForm<UpdateMemberFormValues>({
    resolver: zodResolver(updateMemberSchema),
    defaultValues: {
      role: "",
      status: "active",
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteFormValues) => {
      const response = await apiRequest('POST', '/api/v2/team/invite', data);
      const result = await response.json();
      if (result.error === 'seat_limit_reached') {
        throw { seatLimit: true, ...result };
      }
      if (!result.success && result.message) {
        throw new Error(result.message);
      }
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Invitation sent",
        description: "Team member invitation has been sent successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/team/invitations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/billing/subscription'] });
      setIsInviteDialogOpen(false);
      inviteForm.reset();
    },
    onError: (error: any) => {
      if (error.seatLimit) {
        setIsInviteDialogOpen(false);
        setSeatLimitDialog({
          currentSeats: error.currentSeats,
          maxSeats: error.maxSeats,
          canPurchaseMore: error.canPurchaseMore,
        });
        return;
      }
      toast({
        title: "Error sending invitation",
        description: error.message || "Failed to send invitation.",
        variant: "destructive",
      });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateMemberFormValues }) => {
      const response = await apiRequest('PUT', `/api/v2/team/members/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Member updated",
        description: "Team member has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/team/members'] });
      setEditingMember(null);
      updateForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating member",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/v2/team/members/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Member removed",
        description: "Team member has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/team/members'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/billing/subscription'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error removing member",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('POST', `/api/v2/team/invitations/${id}/cancel`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation cancelled",
        description: "The invitation has been cancelled.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/team/invitations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/team/members'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/billing/subscription'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error cancelling invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resendInvitationMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('POST', `/api/v2/team/invitations/${id}/resend`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation resent",
        description: "The invitation has been resent.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/team/invitations'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error resending invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onInviteSubmit = (data: InviteFormValues) => {
    inviteMutation.mutate(data);
  };

  const onUpdateMember = (data: UpdateMemberFormValues) => {
    if (editingMember) {
      updateMemberMutation.mutate({ id: editingMember.id, data });
    }
  };

  if (membersLoading || invitationsLoading || rolesLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Team Management</h1>
          <p className="text-muted-foreground">Manage team members, roles, and invitations</p>

          {effectiveMaxSeats !== null && (
            <div className="space-y-1.5 max-w-xs pt-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Team: {consumedSeats} of {effectiveMaxSeats} seat{effectiveMaxSeats !== 1 ? "s" : ""} used
                </span>
                {isAtSeatLimit && (
                  <Badge variant="destructive" className="text-xs">At limit</Badge>
                )}
              </div>
              <Progress value={seatUsagePercent} className={`h-2 ${seatBarColor}`} />
            </div>
          )}

          {isAtSeatLimit && canPurchaseSeats && (
            <div className="flex items-center gap-2 pt-1">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">
                You've used all available seats.{" "}
                <Link href="/billing" className="text-primary underline hover:no-underline">
                  Purchase a seat
                  <ArrowRight className="inline h-3 w-3 ml-0.5" />
                </Link>
              </span>
            </div>
          )}
        </div>

        {canPurchaseSeats === false && currentPlan === "CORE" ? (
          <Card className="border-primary/20 bg-primary/5 max-w-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <p className="font-medium text-sm text-foreground">Want to collaborate?</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Upgrade to Professional to invite team members from £100/seat/month.
              </p>
              <Button size="sm" asChild>
                <Link href="/billing">Upgrade to Professional</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              {isAtSeatLimit ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button disabled>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Invite Member
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Seat limit reached — purchase additional seats on the Billing page</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Member
                </Button>
              )}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to add a new team member to your organization. They will receive an email to sign up with the email address you enter below.
                </DialogDescription>
              </DialogHeader>
              <Form {...inviteForm}>
                <form onSubmit={inviteForm.handleSubmit(onInviteSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={inviteForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Jane" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={inviteForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Smith" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={inviteForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input placeholder="colleague@company.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={inviteForm.control}
                    name="jobTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Title (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Senior Analyst" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={inviteForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {roles?.map((role) => (
                              <SelectItem key={role.roleName} value={role.roleName}>
                                {role.roleName.replaceAll('_', ' ').split(' ').map(word => 
                                  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                                ).join(' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={inviteForm.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Personal Message (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Add a personal message to the invitation..."
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={inviteMutation.isPending}>
                      {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members ({teamMembers?.length || 0})
          </CardTitle>
          <CardDescription>
            Manage your team members and their roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {teamMembers?.map((member) => {
              const isExpanded = expandedMemberId === member.id;
              const perms = member.permissions;
              const permissionList = perms ? [
                { key: 'canManageUsers', label: 'Manage Users', value: perms.canManageUsers, icon: Shield, sensitive: true },
                { key: 'canViewFinancials', label: 'View Financials', value: perms.canViewFinancials, icon: DollarSign, sensitive: true },
                { key: 'canManageCompany', label: 'Manage Company', value: perms.canManageCompany, icon: Building2, sensitive: true },
                { key: 'canCreateDeals', label: 'Create Deals', value: perms.canCreateDeals, icon: Briefcase, sensitive: false },
                { key: 'canEditAllDeals', label: 'Edit All Deals', value: perms.canEditAllDeals, icon: Pencil, sensitive: false },
                { key: 'canDeleteDeals', label: 'Delete Deals', value: perms.canDeleteDeals, icon: Trash2, sensitive: false },
                { key: 'canUploadDocuments', label: 'Upload Documents', value: perms.canUploadDocuments, icon: FileUp, sensitive: false },
                { key: 'canCreateOffers', label: 'Create Offers', value: perms.canCreateOffers, icon: Mail, sensitive: false },
                { key: 'canAccessAnalytics', label: 'Access Analytics', value: perms.canAccessAnalytics, icon: BarChart2, sensitive: false },
                { key: 'canExportData', label: 'Export Data', value: perms.canExportData, icon: FileDown, sensitive: false },
              ] : [];
              const sensitiveBadges = permissionList.filter(p => p.sensitive && p.value);

              return (
              <div key={member.id} className="border rounded-lg bg-card overflow-hidden">
                <div className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-sm font-medium text-foreground">
                      {member.firstName[0]}{member.lastName[0]}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground">
                        {member.firstName} {member.lastName}
                      </h4>
                      {member.isCompanyAdmin && (
                        <Badge variant="default" className="text-xs">
                          <Crown className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                      {!member.isActive && (
                        <Badge variant="secondary" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setExpandedMemberId(isExpanded ? null : member.id)}
                            className="inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Badge variant="outline" className="text-xs capitalize hover:bg-muted transition-colors">
                              {member.userRole?.replace(/_/g, ' ') || 'No Role'}
                              {perms && (isExpanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />)}
                            </Badge>
                          </button>
                        </TooltipTrigger>
                        {perms && (
                          <TooltipContent side="bottom" className="max-w-xs">
                            <p className="text-xs font-medium mb-1">Click to see permissions</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                      <Badge variant="outline" className="text-xs">
                        {member.assignedDealsCount || 0} Deals
                      </Badge>
                      {sensitiveBadges.map(p => (
                        <Badge key={p.key} variant="secondary" className="text-xs text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800">
                          <p.icon className="h-3 w-3 mr-1" />
                          {p.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => {
                        setEditingMember(member);
                        updateForm.setValue('role', member.userRole || '');
                        updateForm.setValue('status', member.isActive ? 'active' : 'inactive');
                      }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Team Member</DialogTitle>
                        <DialogDescription>
                          Update {member.firstName} {member.lastName}'s role and status.
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...updateForm}>
                        <form onSubmit={updateForm.handleSubmit(onUpdateMember)} className="space-y-4">
                          <FormField
                            control={updateForm.control}
                            name="role"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Role</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {roles?.map((role) => (
                                      <SelectItem key={role.roleName} value={role.roleName}>
                                        {role.roleName.replaceAll('_', ' ').split(' ').map(word => 
                                          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                                        ).join(' ')}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={updateForm.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditingMember(null)}>
                              Cancel
                            </Button>
                            <Button type="submit" disabled={updateMemberMutation.isPending}>
                              {updateMemberMutation.isPending ? "Updating..." : "Update Member"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                  {!member.isCompanyAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove {member.firstName} {member.lastName} from the team? 
                            This action will deactivate their account and cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => removeMemberMutation.mutate(member.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Remove Member
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                </div>

                {isExpanded && perms && (
                  <div className="border-t bg-muted/30 px-4 py-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Permissions</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                      {permissionList.map((p) => (
                        <div key={p.key} className="flex items-center gap-2">
                          {p.value ? (
                            <CheckCircle2 className={`h-3.5 w-3.5 flex-shrink-0 ${p.sensitive ? 'text-amber-500' : 'text-green-500'}`} />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/40" />
                          )}
                          <span className={`text-xs ${p.value ? (p.sensitive ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-foreground') : 'text-muted-foreground/60'}`}>
                            {p.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              );
            })}
            {(!teamMembers || teamMembers.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                No team members found. Invite your first team member to get started.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Pending Invitations ({invitations?.filter(inv => inv.invitationStatus === 'pending').length || 0})
          </CardTitle>
          <CardDescription>
            Manage sent invitations and track their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {invitations?.filter(inv => inv.invitationStatus === 'pending').map((invitation) => (
              <div key={invitation.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div>
                  <h4 className="font-medium text-foreground">{invitation.email}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {invitation.invitedRole}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {invitation.invitationStatus}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sent {invitation.sentAt ? new Date(invitation.sentAt).toLocaleDateString() : 'Unknown'} by {invitation.invitedBy}
                  </p>
                  {invitation.invitationMessage && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      "{invitation.invitationMessage}"
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => resendInvitationMutation.mutate(invitation.id)}
                    disabled={resendInvitationMutation.isPending}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => cancelInvitationMutation.mutate(invitation.id)}
                    disabled={cancelInvitationMutation.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {(!invitations || invitations.filter(inv => inv.invitationStatus === 'pending').length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                No pending invitations.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!seatLimitDialog} onOpenChange={(open) => { if (!open) setSeatLimitDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Seat Limit Reached</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You've used {seatLimitDialog?.currentSeats} of {seatLimitDialog?.maxSeats} available seat{(seatLimitDialog?.maxSeats ?? 0) !== 1 ? "s" : ""}.
                </p>
                {seatLimitDialog?.canPurchaseMore ? (
                  <p>Purchase an additional seat on the Billing page to invite more team members.</p>
                ) : (
                  <p>Upgrade to Professional or higher to add more team members.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSeatLimitDialog(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Link href="/billing">
                {seatLimitDialog?.canPurchaseMore ? "Go to Billing" : "Upgrade Plan"}
              </Link>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
