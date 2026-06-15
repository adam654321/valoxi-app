import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar, Clock, User, Phone, Mail, MessageSquare, FileText, Plus, Search, CheckCircle, RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ActivityType {
  id: number;
  typeName: string;
  description: string;
  requiresContact: boolean;
  defaultDuration: number | null;
  isActive: boolean;
}

interface Contact {
  id: number;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
}

interface ActivityWithDetails {
  id: number;
  targetCompanyId: number;
  userId: number;
  activityType: string;
  title: string;
  description: string | null;
  activityDate: string;
  activityTime: string | null;
  durationMinutes: number | null;
  contactId: number | null;
  isCompleted: boolean;
  followUpDate: string | null;
  createdAt: string;
  userName: string;
  contactName: string | null;
  contactTitle: string | null;
  typeDescription: string | null;
  companyName: string;
}

interface ActivityTimeline {
  [date: string]: ActivityWithDetails[];
}

interface DealActivitySectionProps {
  targetCompanyId: number;
  companyName: string;
  contacts: Contact[];
}

const activityFormSchema = z.object({
  activityType: z.string().min(1, "Activity type is required"),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  activityDate: z.string().min(1, "Date is required"),
  activityTime: z.string().optional(),
  durationMinutes: z.number().optional(),
  contactId: z.number().optional(),
  followUpDate: z.string().optional(),
});

type ActivityFormData = z.infer<typeof activityFormSchema>;

const getActivityIcon = (type: string) => {
  switch (type) {
    case "Phone Call": return <Phone className="h-4 w-4" />;
    case "Email": return <Mail className="h-4 w-4" />;
    case "Meeting": return <User className="h-4 w-4" />;
    case "Note": return <MessageSquare className="h-4 w-4" />;
    case "Document": return <FileText className="h-4 w-4" />;
    case "Follow-up": return <Clock className="h-4 w-4" />;
    case "Research": return <Search className="h-4 w-4" />;
    default: return <Calendar className="h-4 w-4" />;
  }
};

const getActivityColor = (type: string) => {
  switch (type) {
    case "Phone Call": return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
    case "Email": return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    case "Meeting": return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300";
    case "Note": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
    case "Document": return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
    case "Follow-up": return "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300";
    case "Research": return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300";
    case "Initial Discussion": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
    case "Broker Discussion": return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300";
    case "Follow-up Call": return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
    case "Meeting Notes": return "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300";
    case "Due Diligence": return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300";
    case "Heads of Terms": return "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300";
    case "General": return "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300";
    default: return "bg-muted text-foreground";
  }
};

export function DealActivitySection({ targetCompanyId, companyName, contacts }: DealActivitySectionProps) {
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const activityForm = useForm<ActivityFormData>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      activityType: "",
      title: "",
      description: "",
      activityDate: new Date().toISOString().split('T')[0],
      activityTime: "",
      durationMinutes: undefined,
      contactId: undefined,
      followUpDate: "",
    },
  });

  const { data: activityTypes = [] } = useQuery<ActivityType[]>({
    queryKey: ["/api/v2/activities/types"],
    select: (response: any) => response.data,
  });

  const { data: timeline = {}, isLoading } = useQuery<ActivityTimeline>({
    queryKey: ["/api/v2/activities/company", targetCompanyId, "timeline"],
    select: (response: any) => response.data,
  });

  const createActivityMutation = useMutation({
    mutationFn: async (data: ActivityFormData) => {
      const payload = {
        ...data,
        activityDate: new Date(data.activityDate).toISOString(),
        followUpDate: data.followUpDate ? new Date(data.followUpDate).toISOString() : null,
        contactId: data.contactId || null,
        durationMinutes: data.durationMinutes || null,
      };
      return apiRequest("POST", `/api/v2/activities/company/${targetCompanyId}`, payload);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/activities/company", targetCompanyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/activities/company", targetCompanyId, "timeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/activities/recent"] });
      
      queryClient.invalidateQueries({ queryKey: ["/api/v2/target-companies", targetCompanyId.toString(), "profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/target-companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/target-companies/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/dashboard/data/pipeline-overview"] });
      
      setIsActivityDialogOpen(false);
      activityForm.reset();
      toast({ title: "Success", description: "Activity logged successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to log activity", variant: "destructive" });
    },
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: ({ id, isCompleted }: { id: number; isCompleted: boolean }) =>
      apiRequest("PUT", `/api/v2/activities/${id}`, { isCompleted: !isCompleted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/activities/company", targetCompanyId, "timeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/activities/recent"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update activity", variant: "destructive" });
    },
  });

  const watchedActivityType = activityForm.watch("activityType");
  const selectedActivityType = activityTypes.find(type => type.typeName === watchedActivityType);

  useEffect(() => {
    if (selectedActivityType) {
      if (selectedActivityType.defaultDuration) {
        activityForm.setValue("durationMinutes", selectedActivityType.defaultDuration);
      }
      if (!selectedActivityType.requiresContact) {
        activityForm.setValue("contactId", undefined);
      }
    }
  }, [selectedActivityType, activityForm]);

  const onActivitySubmit = (data: ActivityFormData) => {
    createActivityMutation.mutate(data);
  };

  const timelineItems: ActivityWithDetails[] = [];

  Object.entries(timeline).forEach(([date, activities]) => {
    activities.forEach(activity => {
      if (filterType === "all" || activity.activityType === filterType) {
        timelineItems.push(activity);
      }
    });
  });

  timelineItems.sort((a, b) => new Date(b.activityDate).getTime() - new Date(a.activityDate).getTime());

  const groupedByDate: { [date: string]: ActivityWithDetails[] } = {};
  timelineItems.forEach(item => {
    const dateKey = format(new Date(item.activityDate), "yyyy-MM-dd");
    if (!groupedByDate[dateKey]) {
      groupedByDate[dateKey] = [];
    }
    groupedByDate[dateKey].push(item);
  });

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-lg">Deal Activity</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={isActivityDialogOpen} onOpenChange={setIsActivityDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Log Activity
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Log New Activity for {companyName}</DialogTitle>
                </DialogHeader>
                <Form {...activityForm}>
                  <form onSubmit={activityForm.handleSubmit(onActivitySubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={activityForm.control}
                        name="activityType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Activity Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {activityTypes.map((type) => (
                                  <SelectItem key={type.typeName} value={type.typeName}>
                                    {type.typeName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={activityForm.control}
                        name="activityDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={activityForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Brief description of activity" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={activityForm.control}
                        name="activityTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Time (optional)</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {selectedActivityType?.requiresContact && (
                        <FormField
                          control={activityForm.control}
                          name="contactId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contact</FormLabel>
                              <Select 
                                onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)} 
                                defaultValue={field.value?.toString()}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select contact" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {contacts.map((contact) => (
                                    <SelectItem key={contact.id} value={contact.id.toString()}>
                                      {contact.firstName} {contact.lastName}
                                      {contact.title && ` - ${contact.title}`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {selectedActivityType?.defaultDuration !== null && (
                        <FormField
                          control={activityForm.control}
                          name="durationMinutes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Duration (minutes)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field}
                                  onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <FormField
                      control={activityForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Detailed notes about this activity"
                              className="min-h-[100px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={activityForm.control}
                      name="followUpDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Follow-up Date (optional)</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsActivityDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createActivityMutation.isPending}>
                        {createActivityMutation.isPending ? "Logging..." : "Log Activity"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : sortedDates.length === 0 ? (
          <EmptyState icon={Calendar} title="No activity yet" description="Log activities to track your deal progress." />
        ) : (
          <div className="space-y-6">
            {sortedDates.map((dateKey) => (
              <div key={dateKey} className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground sticky top-0 bg-background py-2 border-b">
                  {format(new Date(dateKey), "EEEE, MMMM d, yyyy")}
                </h4>
                <div className="space-y-3 pl-4 border-l-2 border-muted">
                  {groupedByDate[dateKey].map((activity) => (
                    <div
                      key={activity.id}
                      className={`relative border rounded-lg p-4 hover:bg-muted/30 transition-colors border-l-4 ${activity.isCompleted ? 'border-l-green-500' : 'border-l-blue-500'}`}
                    >
                      <div className="absolute -left-[25px] top-4 w-4 h-4 rounded-full bg-background border-2 border-muted flex items-center justify-center">
                        {getActivityIcon(activity.activityType)}
                      </div>
                      
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${getActivityColor(activity.activityType)}`}
                            >
                              {activity.activityType}
                            </Badge>
                            {activity.isCompleted && (
                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                                Completed
                              </Badge>
                            )}
                            <h5 className={`font-medium ${activity.isCompleted ? 'line-through text-muted-foreground' : ''}`}>{activity.title}</h5>
                          </div>
                          
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div className="flex items-center gap-4">
                              {activity.userName && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {activity.userName}
                                </span>
                              )}
                              {activity.activityTime && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {activity.activityTime}
                                </span>
                              )}
                              {activity.durationMinutes && (
                                <span>({activity.durationMinutes} min)</span>
                              )}
                            </div>
                            {activity.contactName && (
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {activity.contactName}
                                {activity.contactTitle && ` - ${activity.contactTitle}`}
                              </div>
                            )}
                          </div>
                          
                          {activity.description && (
                            <p className="text-sm mt-2 whitespace-pre-wrap">{activity.description}</p>
                          )}
                          
                          {activity.followUpDate && (
                            <div className="flex items-center gap-1 mt-2 text-sm text-orange-600 dark:text-orange-400">
                              <Calendar className="h-3 w-3" />
                              Follow-up: {format(new Date(activity.followUpDate), "MMM d, yyyy")}
                            </div>
                          )}
                        </div>

                        <button
                          title={activity.isCompleted ? "Reopen" : "Mark complete"}
                          disabled={toggleCompleteMutation.isPending}
                          onClick={() => toggleCompleteMutation.mutate({ id: activity.id, isCompleted: activity.isCompleted })}
                          className="ml-3 shrink-0 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                        >
                          {activity.isCompleted
                            ? <RotateCcw className="h-4 w-4" />
                            : <CheckCircle className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
