import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus, Edit, Trash2, Users, Shield, Eye, Upload, MessageCircle, Building2 } from "lucide-react";

interface TeamMember {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  userRole: string;
  isCompanyAdmin: boolean;
  isActive: boolean;
}

interface DealAssignment {
  id: number;
  userId: number;
  targetCompanyId: number;
  assignedBy: number;
  assignmentRole: string;
  canEditCompany: boolean;
  canUploadDocuments: boolean;
  canCreateActivities: boolean;
  canManageContacts: boolean;
  isActive: boolean;
  assignedAt: Date;
  assignedByName: string;
  userName: string;
  userEmail: string;
}

interface DealTeamManagementProps {
  targetCompanyId: number;
  targetCompanyName: string;
}

// Form schemas
const assignMemberSchema = z.object({
  userId: z.number(),
  role: z.string().default("analyst"),
  canEditCompany: z.boolean().default(true),
  canUploadDocuments: z.boolean().default(true),
  canCreateActivities: z.boolean().default(true),
  canManageContacts: z.boolean().default(true),
});

const updatePermissionsSchema = z.object({
  role: z.string().optional(),
  canEditCompany: z.boolean().optional(),
  canUploadDocuments: z.boolean().optional(),
  canCreateActivities: z.boolean().optional(),
  canManageContacts: z.boolean().optional(),
});

type AssignMemberFormValues = z.infer<typeof assignMemberSchema>;
type UpdatePermissionsFormValues = z.infer<typeof updatePermissionsSchema>;

export function DealTeamManagement({ targetCompanyId, targetCompanyName }: DealTeamManagementProps) {
  const { toast } = useToast();
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<DealAssignment | null>(null);

  // Queries
  const { data: dealTeam, isLoading: dealTeamLoading } = useQuery<DealAssignment[]>({
    queryKey: ['/api/v2/deals', targetCompanyId, 'team'],
    select: (response: any) => response.data,
  });

  const { data: availableMembers, isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: ['/api/v2/team/members'],
    select: (response: any) => response.data,
  });

  // Forms
  const assignForm = useForm<AssignMemberFormValues>({
    resolver: zodResolver(assignMemberSchema),
    defaultValues: {
      userId: 0,
      role: "analyst",
      canEditCompany: true,
      canUploadDocuments: true,
      canCreateActivities: true,
      canManageContacts: true,
    },
  });

  const updateForm = useForm<UpdatePermissionsFormValues>({
    resolver: zodResolver(updatePermissionsSchema),
    defaultValues: {
      role: "",
      canEditCompany: true,
      canUploadDocuments: true,
      canCreateActivities: true,
      canManageContacts: true,
    },
  });

  // Mutations
  const assignMemberMutation = useMutation({
    mutationFn: async (data: AssignMemberFormValues) => {
      const response = await apiRequest('POST', `/api/v2/deals/${targetCompanyId}/assign`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Team member assigned",
        description: "Team member has been assigned to this deal successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/deals', targetCompanyId, 'team'] });
      setIsAssignDialogOpen(false);
      assignForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error assigning team member",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: number; data: UpdatePermissionsFormValues }) => {
      const response = await apiRequest('PUT', `/api/v2/deals/${targetCompanyId}/team/${userId}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Permissions updated",
        description: "Team member permissions have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/deals', targetCompanyId, 'team'] });
      setEditingAssignment(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating permissions",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest('DELETE', `/api/v2/deals/${targetCompanyId}/assign/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Team member removed",
        description: "Team member has been removed from this deal.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/deals', targetCompanyId, 'team'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error removing team member",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onAssignSubmit = (data: AssignMemberFormValues) => {
    assignMemberMutation.mutate(data);
  };

  const onUpdatePermissions = (data: UpdatePermissionsFormValues) => {
    if (editingAssignment) {
      updatePermissionsMutation.mutate({ userId: editingAssignment.userId, data });
    }
  };

  // Get available members (not already assigned)
  // Show all active team members (allow multiple roles per person)
  const availableTeamMembers = availableMembers?.filter(member => member.isActive) || [];

  if (dealTeamLoading || membersLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Deal Team
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Deal Team ({dealTeam?.length || 0})
            </CardTitle>
            <CardDescription>
              Manage team members assigned to {targetCompanyName}
            </CardDescription>
          </div>
          {availableTeamMembers.length > 0 && (
            <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Assign Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Team Member</DialogTitle>
                  <DialogDescription>
                    Assign a team member to work on {targetCompanyName} with specific permissions.
                  </DialogDescription>
                </DialogHeader>
                <Form {...assignForm}>
                  <form onSubmit={assignForm.handleSubmit(onAssignSubmit)} className="space-y-4">
                    <FormField
                      control={assignForm.control}
                      name="userId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Team Member</FormLabel>
                          <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a team member" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableTeamMembers.map((member) => (
                                <SelectItem key={member.id} value={member.id.toString()}>
                                  {member.firstName} {member.lastName} ({member.email})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={assignForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role on Deal</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="lead">Lead</SelectItem>
                              <SelectItem value="analyst">Analyst</SelectItem>
                              <SelectItem value="associate">Associate</SelectItem>
                              <SelectItem value="contributor">Contributor</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="space-y-3">
                      <FormLabel>Permissions</FormLabel>
                      <div className="space-y-2">
                        <FormField
                          control={assignForm.control}
                          name="canEditCompany"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="text-sm">
                                  Edit Company Information
                                </FormLabel>
                              </div>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={assignForm.control}
                          name="canUploadDocuments"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="text-sm">
                                  Upload Documents
                                </FormLabel>
                              </div>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={assignForm.control}
                          name="canCreateActivities"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="text-sm">
                                  Create Activities
                                </FormLabel>
                              </div>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={assignForm.control}
                          name="canManageContacts"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="text-sm">
                                  Manage Contacts
                                </FormLabel>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={assignMemberMutation.isPending}>
                        {assignMemberMutation.isPending ? "Assigning..." : "Assign Member"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {dealTeam?.map((assignment) => (
            <div key={assignment.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div className="flex items-center space-x-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-sm font-medium text-foreground">
                    {assignment.userName ? assignment.userName.split(' ').map(n => n[0]).join('') : '??'}
                  </span>
                </div>
                <div>
                  <h4 className="font-medium text-foreground">
                    {assignment.userName || 'Unknown User'}
                  </h4>
                  <p className="text-sm text-muted-foreground">{assignment.userEmail}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {assignment.assignmentRole}
                    </Badge>
                    <div className="flex items-center gap-1">
                      {assignment.canEditCompany && (
                        <Badge variant="secondary" className="text-xs">
                          <Building2 className="h-3 w-3 mr-1" />
                          Edit
                        </Badge>
                      )}
                      {assignment.canUploadDocuments && (
                        <Badge variant="secondary" className="text-xs">
                          <Upload className="h-3 w-3 mr-1" />
                          Upload
                        </Badge>
                      )}
                      {assignment.canCreateActivities && (
                        <Badge variant="secondary" className="text-xs">
                          <MessageCircle className="h-3 w-3 mr-1" />
                          Activities
                        </Badge>
                      )}
                      {assignment.canManageContacts && (
                        <Badge variant="secondary" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          Contacts
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Assigned {new Date(assignment.assignedAt).toLocaleDateString()} by {assignment.assignedByName}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => {
                      setEditingAssignment(assignment);
                      updateForm.setValue('role', assignment.assignmentRole);
                      updateForm.setValue('canEditCompany', assignment.canEditCompany);
                      updateForm.setValue('canUploadDocuments', assignment.canUploadDocuments);
                      updateForm.setValue('canCreateActivities', assignment.canCreateActivities);
                      updateForm.setValue('canManageContacts', assignment.canManageContacts);
                    }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Team Member Permissions</DialogTitle>
                      <DialogDescription>
                        Update {assignment.userName}'s role and permissions for this deal.
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...updateForm}>
                      <form onSubmit={updateForm.handleSubmit(onUpdatePermissions)} className="space-y-4">
                        <FormField
                          control={updateForm.control}
                          name="role"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Role on Deal</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="lead">Lead</SelectItem>
                                  <SelectItem value="analyst">Analyst</SelectItem>
                                  <SelectItem value="associate">Associate</SelectItem>
                                  <SelectItem value="contributor">Contributor</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="space-y-3">
                          <FormLabel>Permissions</FormLabel>
                          <div className="space-y-2">
                            <FormField
                              control={updateForm.control}
                              name="canEditCompany"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="text-sm">
                                      Edit Company Information
                                    </FormLabel>
                                  </div>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={updateForm.control}
                              name="canUploadDocuments"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="text-sm">
                                      Upload Documents
                                    </FormLabel>
                                  </div>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={updateForm.control}
                              name="canCreateActivities"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="text-sm">
                                      Create Activities
                                    </FormLabel>
                                  </div>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={updateForm.control}
                              name="canManageContacts"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="text-sm">
                                      Manage Contacts
                                    </FormLabel>
                                  </div>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setEditingAssignment(null)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={updatePermissionsMutation.isPending}>
                            {updatePermissionsMutation.isPending ? "Updating..." : "Update Permissions"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove from Deal</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to remove {assignment.userName} from this deal? 
                        They will lose access to all deal-related information.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => removeMemberMutation.mutate(assignment.userId)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Remove from Deal
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
          {(!dealTeam || dealTeam.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              No team members assigned to this deal yet.
              {availableTeamMembers.length > 0 && (
                <p className="mt-2">Click "Assign Member" to add team members to this deal.</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}