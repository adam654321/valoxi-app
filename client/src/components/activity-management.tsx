import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar, Clock, User, Phone, Mail, MessageSquare, FileText, Calendar as CalendarIcon, Search } from "lucide-react";
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

interface ActivityManagementProps {
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
    case "Phone Call": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "Email": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "Meeting": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case "Note": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    case "Document": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    case "Follow-up": return "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300";
    case "Research": return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300";
    default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  }
};

export function ActivityManagement({ targetCompanyId, companyName, contacts }: ActivityManagementProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<ActivityFormData>({
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

  // Get activity types using v2 endpoint
  const { data: activityTypes = [] } = useQuery<ActivityType[]>({
    queryKey: ["/api/v2/activities/types"],
    select: (response: any) => response.data,
  });

  // Get activities timeline using v2 endpoint
  const { data: timeline = {}, isLoading: timelineLoading } = useQuery<ActivityTimeline>({
    queryKey: ["/api/v2/activities/company", targetCompanyId, "timeline"],
    select: (response: any) => response.data,
  });

  // Create activity mutation using v2 endpoint
  const createActivityMutation = useMutation({
    mutationFn: async (data: ActivityFormData) => {
      const payload = {
        ...data,
        activityDate: new Date(data.activityDate).toISOString(),
        followUpDate: data.followUpDate ? new Date(data.followUpDate).toISOString() : null,
        contactId: data.contactId || null,
        durationMinutes: data.durationMinutes || null,
      };
      return apiRequest(`/api/v2/activities/company/${targetCompanyId}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/v2/activities/company", targetCompanyId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/v2/activities/company", targetCompanyId, "timeline"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/v2/activities/recent"],
      });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Activity logged successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to log activity",
        variant: "destructive",
      });
    },
  });

  // Update form fields based on activity type
  const watchedActivityType = form.watch("activityType");
  const selectedActivityType = activityTypes.find(type => type.typeName === watchedActivityType);

  useEffect(() => {
    if (selectedActivityType) {
      // Set default duration
      if (selectedActivityType.defaultDuration) {
        form.setValue("durationMinutes", selectedActivityType.defaultDuration);
      }
      
      // Clear contact if not required
      if (!selectedActivityType.requiresContact) {
        form.setValue("contactId", undefined);
      }
    }
  }, [selectedActivityType, form]);

  const onSubmit = (data: ActivityFormData) => {
    createActivityMutation.mutate(data);
  };

  // Filter activities by type
  const filteredTimeline: ActivityTimeline = {};
  Object.entries(timeline).forEach(([date, activities]) => {
    const filtered = activities.filter(activity => 
      filterType === "all" || activity.activityType === filterType
    );
    if (filtered.length > 0) {
      filteredTimeline[date] = filtered;
    }
  });

  const sortedDates = Object.keys(filteredTimeline).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Activity Timeline</h3>
        <div className="flex items-center gap-4">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter activities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Activities</SelectItem>
              {activityTypes.map((type) => (
                <SelectItem key={type.typeName} value={type.typeName}>
                  {type.typeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Calendar className="h-4 w-4 mr-2" />
                Log Activity
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Log New Activity for {companyName}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
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
                      control={form.control}
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
                    control={form.control}
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
                      control={form.control}
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
                        control={form.control}
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
                        control={form.control}
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
                    control={form.control}
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
                    control={form.control}
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
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
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

      {timelineLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sortedDates.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Calendar className="h-8 w-8 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-400">
              No activities logged yet. Click "Log Activity" to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date} className="space-y-3">
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 sticky top-0 bg-background py-2">
                {format(new Date(date), "EEEE, MMMM d, yyyy")}
              </h4>
              <div className="space-y-3">
                {filteredTimeline[date].map((activity) => (
                  <Card key={activity.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900">
                            {getActivityIcon(activity.activityType)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="font-medium">{activity.title}</h5>
                              <Badge className={getActivityColor(activity.activityType)}>
                                {activity.activityType}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                              <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {activity.userName}
                                </span>
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
                              <p className="text-sm mt-2">{activity.description}</p>
                            )}
                            {activity.followUpDate && (
                              <div className="flex items-center gap-1 mt-2 text-sm text-orange-600 dark:text-orange-400">
                                <CalendarIcon className="h-3 w-3" />
                                Follow-up: {format(new Date(activity.followUpDate), "MMM d, yyyy")}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}