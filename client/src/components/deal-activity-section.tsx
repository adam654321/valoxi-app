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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, User, Phone, Mail, MessageSquare, FileText, Plus, Edit, Trash2, Bell, StickyNote, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { DealNote } from "@shared/schema";

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

const NOTE_TYPES = [
  { value: "Initial Discussion", label: "Initial Discussion" },
  { value: "Broker Discussion", label: "Broker Discussion" },
  { value: "Follow-up Call", label: "Follow-up Call" },
  { value: "Meeting Notes", label: "Meeting Notes" },
  { value: "Due Diligence", label: "Due Diligence" },
  { value: "Negotiation", label: "Negotiation" },
  { value: "General", label: "General" },
];

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

const getNoteTypeColor = (type: string) => {
  switch (type) {
    case "Initial Discussion": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300";
    case "Broker Discussion": return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300";
    case "Follow-up Call": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";
    case "Meeting Notes": return "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300";
    case "Due Diligence": return "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300";
    case "Negotiation": return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300";
    default: return "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300";
  }
};

interface UnifiedTimelineItem {
  id: string;
  type: 'activity' | 'note';
  date: Date;
  title: string;
  description: string | null;
  category: string;
  userName?: string;
  contactName?: string | null;
  contactTitle?: string | null;
  activityTime?: string | null;
  durationMinutes?: number | null;
  followUpDate?: string | null;
  reminderDate?: string | null;
  reminderCompleted?: boolean;
  originalData: ActivityWithDetails | DealNote;
}

export function DealActivitySection({ targetCompanyId, companyName, contacts }: DealActivitySectionProps) {
  const [activeTab, setActiveTab] = useState<"all" | "activities" | "notes">("all");
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<DealNote | null>(null);
  const [noteType, setNoteType] = useState("General");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [reminderDate, setReminderDate] = useState("");
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

  const { data: timeline = {}, isLoading: timelineLoading } = useQuery<ActivityTimeline>({
    queryKey: ["/api/v2/activities/company", targetCompanyId, "timeline"],
    select: (response: any) => response.data,
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery<DealNote[]>({
    queryKey: ["/api/v2/notes/company", targetCompanyId],
    enabled: !!targetCompanyId,
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
      
      // Invalidate company profile and pipeline data (for stage changes like Initial Discussion)
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies", targetCompanyId.toString(), "profile"] });
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

  const createNoteMutation = useMutation({
    mutationFn: (data: { noteType: string; title: string; content: string; reminderDate: string | null }) =>
      apiRequest("POST", `/api/v2/notes/company/${targetCompanyId}`, data),
    onSuccess: () => {
      toast({ title: "Success", description: "Note added" });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/notes/company", targetCompanyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies", targetCompanyId] });
      resetNoteForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add note", variant: "destructive" });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: (data: { noteId: number; noteType: string; title: string; content: string; reminderDate: string | null; reminderCompleted?: boolean }) =>
      apiRequest("PUT", `/api/v2/notes/${data.noteId}`, { noteType: data.noteType, title: data.title, content: data.content, reminderDate: data.reminderDate, reminderCompleted: data.reminderCompleted }),
    onSuccess: () => {
      toast({ title: "Success", description: "Note updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/notes/company", targetCompanyId] });
      resetNoteForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update note", variant: "destructive" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: number) => apiRequest("DELETE", `/api/v2/notes/${noteId}`),
    onSuccess: () => {
      toast({ title: "Success", description: "Note deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/notes/company", targetCompanyId] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete note", variant: "destructive" });
    },
  });

  const resetNoteForm = () => {
    setIsNoteDialogOpen(false);
    setEditingNote(null);
    setNoteType("General");
    setNoteTitle("");
    setNoteContent("");
    setReminderDate("");
  };

  const handleNoteSubmit = () => {
    if (!noteTitle.trim()) {
      toast({ title: "Error", description: "Title is required", variant: "destructive" });
      return;
    }
    if (editingNote) {
      updateNoteMutation.mutate({
        noteId: editingNote.id,
        noteType,
        title: noteTitle,
        content: noteContent,
        reminderDate: reminderDate || null,
      });
    } else {
      createNoteMutation.mutate({
        noteType,
        title: noteTitle,
        content: noteContent,
        reminderDate: reminderDate || null,
      });
    }
  };

  const openEditNoteDialog = (note: DealNote) => {
    setEditingNote(note);
    setNoteType(note.noteType || "General");
    setNoteTitle(note.title);
    setNoteContent(note.content || "");
    setReminderDate(note.reminderDate ? new Date(note.reminderDate).toISOString().slice(0, 16) : "");
    setIsNoteDialogOpen(true);
  };

  const toggleReminderComplete = (note: DealNote) => {
    updateNoteMutation.mutate({
      noteId: note.id,
      noteType: note.noteType || "General",
      title: note.title,
      content: note.content || "",
      reminderDate: note.reminderDate ? new Date(note.reminderDate).toISOString() : null,
      reminderCompleted: !note.reminderCompleted,
    });
  };

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

  const unifiedTimeline: UnifiedTimelineItem[] = [];

  Object.entries(timeline).forEach(([date, activities]) => {
    activities.forEach(activity => {
      if (filterType === "all" || activity.activityType === filterType) {
        unifiedTimeline.push({
          id: `activity-${activity.id}`,
          type: 'activity',
          date: new Date(activity.activityDate),
          title: activity.title,
          description: activity.description,
          category: activity.activityType,
          userName: activity.userName,
          contactName: activity.contactName,
          contactTitle: activity.contactTitle,
          activityTime: activity.activityTime,
          durationMinutes: activity.durationMinutes,
          followUpDate: activity.followUpDate,
          originalData: activity,
        });
      }
    });
  });

  notes.forEach(note => {
    if (filterType === "all" || note.noteType === filterType) {
      unifiedTimeline.push({
        id: `note-${note.id}`,
        type: 'note',
        date: new Date(note.createdAt!),
        title: note.title,
        description: note.content,
        category: note.noteType || "General",
        reminderDate: note.reminderDate ? new Date(note.reminderDate).toISOString() : null,
        reminderCompleted: note.reminderCompleted || false,
        originalData: note,
      });
    }
  });

  const filteredTimeline = unifiedTimeline.filter(item => {
    if (activeTab === "all") return true;
    if (activeTab === "activities") return item.type === "activity";
    if (activeTab === "notes") return item.type === "note";
    return true;
  });

  filteredTimeline.sort((a, b) => b.date.getTime() - a.date.getTime());

  const groupedByDate: { [date: string]: UnifiedTimelineItem[] } = {};
  filteredTimeline.forEach(item => {
    const dateKey = format(item.date, "yyyy-MM-dd");
    if (!groupedByDate[dateKey]) {
      groupedByDate[dateKey] = [];
    }
    groupedByDate[dateKey].push(item);
  });

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  const isLoading = timelineLoading || notesLoading;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-lg">Deal Activity</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={isNoteDialogOpen} onOpenChange={(open) => { if (!open) resetNoteForm(); else setIsNoteDialogOpen(true); }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <StickyNote className="w-4 h-4 mr-1" />
                  Add Note
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingNote ? "Edit Note" : "Add New Note"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Note Type</label>
                    <Select value={noteType} onValueChange={setNoteType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {NOTE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Title *</label>
                    <Input
                      placeholder="e.g., Initial Call Notes, Follow-up Reminder..."
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Content</label>
                    <Textarea
                      placeholder="Add details, key points, or action items..."
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        Reminder (optional)
                      </div>
                    </label>
                    <Input
                      type="datetime-local"
                      value={reminderDate}
                      onChange={(e) => setReminderDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={resetNoteForm}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleNoteSubmit}
                    disabled={createNoteMutation.isPending || updateNoteMutation.isPending}
                  >
                    {editingNote ? "Save Changes" : "Add Note"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

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
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "activities" | "notes")} className="mb-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="activities">Activities</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>No activity yet. Add notes or log activities to track your deal progress.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map((dateKey) => (
              <div key={dateKey} className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground sticky top-0 bg-background py-2 border-b">
                  {format(new Date(dateKey), "EEEE, MMMM d, yyyy")}
                </h4>
                <div className="space-y-3 pl-4 border-l-2 border-muted">
                  {groupedByDate[dateKey].map((item) => (
                    <div
                      key={item.id}
                      className={`relative border rounded-lg p-4 hover:bg-muted/30 transition-colors ${
                        item.type === 'activity' ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-amber-500'
                      }`}
                    >
                      <div className="absolute -left-[25px] top-4 w-4 h-4 rounded-full bg-background border-2 border-muted flex items-center justify-center">
                        {item.type === 'activity' ? (
                          getActivityIcon((item.originalData as ActivityWithDetails).activityType)
                        ) : (
                          <StickyNote className="h-3 w-3 text-amber-600" />
                        )}
                      </div>
                      
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${
                                item.type === 'activity' 
                                  ? getActivityColor(item.category) 
                                  : getNoteTypeColor(item.category)
                              }`}
                            >
                              {item.category}
                            </Badge>
                            <h5 className="font-medium">{item.title}</h5>
                            {item.type === 'note' && item.reminderDate && (
                              <Badge
                                variant={item.reminderCompleted ? "secondary" : "outline"}
                                className={`text-xs cursor-pointer ${!item.reminderCompleted && new Date(item.reminderDate) < new Date() ? 'border-red-500 text-red-500' : ''}`}
                                onClick={() => toggleReminderComplete(item.originalData as DealNote)}
                              >
                                <Bell className="w-3 h-3 mr-1" />
                                {item.reminderCompleted ? 'Done' : format(new Date(item.reminderDate), 'MMM d, yyyy')}
                              </Badge>
                            )}
                          </div>
                          
                          {item.type === 'activity' && (
                            <div className="text-sm text-muted-foreground space-y-1">
                              <div className="flex items-center gap-4">
                                {item.userName && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {item.userName}
                                  </span>
                                )}
                                {item.activityTime && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {item.activityTime}
                                  </span>
                                )}
                                {item.durationMinutes && (
                                  <span>({item.durationMinutes} min)</span>
                                )}
                              </div>
                              {item.contactName && (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {item.contactName}
                                  {item.contactTitle && ` - ${item.contactTitle}`}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {item.description && (
                            <p className="text-sm mt-2 whitespace-pre-wrap">{item.description}</p>
                          )}
                          
                          {item.type === 'activity' && item.followUpDate && (
                            <div className="flex items-center gap-1 mt-2 text-sm text-orange-600 dark:text-orange-400">
                              <Calendar className="h-3 w-3" />
                              Follow-up: {format(new Date(item.followUpDate), "MMM d, yyyy")}
                            </div>
                          )}
                          
                          {item.type === 'note' && (
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {format(item.date, 'h:mm a')}
                            </div>
                          )}
                        </div>
                        
                        {item.type === 'note' && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditNoteDialog(item.originalData as DealNote)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm("Delete this note?")) {
                                  deleteNoteMutation.mutate((item.originalData as DealNote).id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
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
