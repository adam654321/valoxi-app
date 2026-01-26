import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Plus, Edit, Trash2, Mail, Phone, User, MapPin, Globe, Calendar, Users, DollarSign, Building2, ExternalLink, TrendingUp, FileText, RefreshCw, BarChart, CheckCircle, AlertTriangle, BarChart3, ChevronDown, MessageSquare, Loader2, Bell, Clock, StickyNote } from "lucide-react";
import type { TargetCompany, TargetContact, Stage1AnalysisEvent, DealNote } from "@shared/schema";
import { DealTeamManagement } from "@/components/deal-team-management";
import { PipelineStageManagement } from "@/components/pipeline-stage-management";
import { ActivityManagement } from "@/components/activity-management";
import { DocumentManagement } from "@/components/document-management";
import { DetailedAnalysisDisplay } from "@/components/detailed-analysis-display";
import { Stage1AnalysisDisplay } from "@/components/stage1-analysis-display";
import { DealSheetVisualDisplay } from "@/components/deal-sheet-visual-display";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Enhanced profile interface to match the backend CompanyProfile
interface CompanyProfile extends TargetCompany {
  createdByName: string;
  userCompanyName: string;
  totalContacts: number;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  primaryContactTitle: string | null;
  yearsInBusiness: number | null;
  revenuePerEmployee: number | null;
  contacts: TargetContact[];
}

// Contact form schema
const contactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  title: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

// Note type options
const NOTE_TYPES = [
  { value: "Initial Discussion", label: "Initial Discussion" },
  { value: "Broker Discussion", label: "Broker Discussion" },
  { value: "Follow-up Call", label: "Follow-up Call" },
  { value: "Meeting Notes", label: "Meeting Notes" },
  { value: "Due Diligence", label: "Due Diligence" },
  { value: "Negotiation", label: "Negotiation" },
  { value: "General", label: "General" },
];

// Deal Notes Section Component
function DealNotesSection({ targetCompanyId }: { targetCompanyId: number }) {
  const { toast } = useToast();
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [editingNote, setEditingNote] = useState<DealNote | null>(null);
  const [noteType, setNoteType] = useState("General");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [reminderDate, setReminderDate] = useState("");

  const { data: notes = [], isLoading } = useQuery<DealNote[]>({
    queryKey: ["/api/v2/notes/company", targetCompanyId],
    enabled: !!targetCompanyId,
    select: (response: any) => response.data,
  });

  const createNoteMutation = useMutation({
    mutationFn: (data: { noteType: string; title: string; content: string; reminderDate: string | null }) =>
      apiRequest("POST", `/api/v2/notes/company/${targetCompanyId}`, data),
    onSuccess: () => {
      toast({ title: "Success", description: "Note added" });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/notes/company", targetCompanyId] });
      resetForm();
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
      resetForm();
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

  const resetForm = () => {
    setShowNoteDialog(false);
    setEditingNote(null);
    setNoteType("General");
    setNoteTitle("");
    setNoteContent("");
    setReminderDate("");
  };

  const handleSubmit = () => {
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

  const openEditDialog = (note: DealNote) => {
    setEditingNote(note);
    setNoteType(note.noteType || "General");
    setNoteTitle(note.title);
    setNoteContent(note.content || "");
    setReminderDate(note.reminderDate ? new Date(note.reminderDate).toISOString().slice(0, 16) : "");
    setShowNoteDialog(true);
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-lg">Deal Notes</CardTitle>
          </div>
          <Button size="sm" onClick={() => setShowNoteDialog(true)} data-testid="button-add-note">
            <Plus className="w-4 h-4 mr-1" />
            Add Note
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <StickyNote className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>No notes yet. Add notes to track conversations, reminders, and important details.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                data-testid={`note-card-${note.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {note.noteType || "General"}
                      </Badge>
                      <h4 className="font-medium">{note.title}</h4>
                      {note.reminderDate && (
                        <Badge
                          variant={note.reminderCompleted ? "secondary" : "outline"}
                          className={`text-xs cursor-pointer ${!note.reminderCompleted && new Date(note.reminderDate) < new Date() ? 'border-red-500 text-red-500' : ''}`}
                          onClick={() => toggleReminderComplete(note)}
                          data-testid={`badge-reminder-${note.id}`}
                        >
                          <Bell className="w-3 h-3 mr-1" />
                          {note.reminderCompleted ? 'Done' : new Date(note.reminderDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Badge>
                      )}
                    </div>
                    {note.content && (
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{note.content}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {new Date(note.createdAt!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(note)}
                      data-testid={`button-edit-note-${note.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm("Delete this note?")) {
                          deleteNoteMutation.mutate(note.id);
                        }
                      }}
                      data-testid={`button-delete-note-${note.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={showNoteDialog} onOpenChange={(open) => { if (!open) resetForm(); else setShowNoteDialog(true); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingNote ? "Edit Note" : "Add New Note"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Note Type</label>
              <Select value={noteType} onValueChange={setNoteType}>
                <SelectTrigger data-testid="select-note-type">
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
                data-testid="input-note-title"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Content</label>
              <Textarea
                placeholder="Add details, key points, or action items..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={4}
                data-testid="input-note-content"
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
                data-testid="input-note-reminder"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetForm} data-testid="button-cancel-note">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createNoteMutation.isPending || updateNoteMutation.isPending}
              data-testid="button-save-note"
            >
              {(createNoteMutation.isPending || updateNoteMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingNote ? "Save Changes" : "Add Note"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function TargetCompanyDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<TargetContact | null>(null);

  const contactForm = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      title: "",
      email: "",
      phone: "",
      isPrimary: false,
      notes: "",
    },
  });

  // Get comprehensive company profile with enhanced data
  const { data: profile, isLoading: profileLoading, isFetching: profileFetching, refetch: refetchProfile } = useQuery<CompanyProfile>({
    queryKey: ["/api/target-companies", id, "profile"],
    enabled: !!id,
    // More aggressive polling for website analysis
    refetchInterval: (query) => {
      // Get the actual profile data from the query state
      const data = query?.state?.data as CompanyProfile | undefined;
      
      // Only log when checking for website analysis
      if (!data?.websiteAnalysis) {
        console.log('Checking for website analysis...', { 
          companyId: id,
          hasWebsite: !!data?.website 
        });
      }
      
      // Poll every 5 seconds if no website analysis is available yet
      if (!data?.websiteAnalysis) {
        return 5000; // 5 seconds for faster updates
      }
      return false; // Stop polling once analysis is available
    },
    refetchIntervalInBackground: false,
    // Don't use stale data
    staleTime: 0,
    // Force refetch on mount
    refetchOnMount: 'always',
  });

  // Get stage 1 analysis events
  const { data: stage1Events = [], isLoading: analysisLoading } = useQuery<Stage1AnalysisEvent[]>({
    queryKey: ["/api/target-companies", id, "stage1-analysis"],
    enabled: !!id,
    refetchInterval: 30000, // Poll every 30 seconds for new Stage 1 analysis results
    refetchIntervalInBackground: false, // Only poll when tab is active
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  // Extract company and contacts from profile
  const company = profile;
  const contacts = profile?.contacts || [];

  // Add contact mutation
  const addContactMutation = useMutation({
    mutationFn: (data: ContactFormData) =>
      apiRequest("POST", `/api/target-companies/${id}/contacts`, {
        ...data,
        targetCompanyId: parseInt(id!),
      }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies", id, "profile"] });
      setShowContactForm(false);
      contactForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add contact",
        variant: "destructive",
      });
    },
  });

  // Edit contact mutation
  const editContactMutation = useMutation({
    mutationFn: (data: ContactFormData) =>
      apiRequest("PUT", `/api/contacts/${editingContact?.id}`, data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies", id, "profile"] });
      setShowContactForm(false);
      setEditingContact(null);
      contactForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update contact",
        variant: "destructive",
      });
    },
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: (contactId: number) =>
      apiRequest("DELETE", `/api/contacts/${contactId}`),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies", id, "profile"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete contact",
        variant: "destructive",
      });
    },
  });

  // Trigger detailed analysis mutation
  const triggerDetailedAnalysisMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/target-companies/${id}/trigger-detailed-analysis`),
    onSuccess: () => {
      toast({
        title: "Detailed Analysis Started",
        description: "The detailed analysis is now being generated. This may take a few minutes.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/target-companies", id, "stage1-analysis"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start detailed analysis",
        variant: "destructive",
      });
    },
  });

  // Helper functions
  const formatCurrency = (amount: string | number) => {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleAddContact = () => {
    setEditingContact(null);
    contactForm.reset();
    setShowContactForm(true);
  };

  const handleEditContact = (contact: TargetContact) => {
    setEditingContact(contact);
    contactForm.reset({
      firstName: contact.firstName,
      lastName: contact.lastName,
      title: contact.title || "",
      email: contact.email || "",
      phone: contact.phone || "",
      isPrimary: contact.isPrimary || false,
      notes: contact.notes || "",
    });
    setShowContactForm(true);
  };

  const handleDeleteContact = (contactId: number) => {
    if (confirm("Are you sure you want to delete this contact?")) {
      deleteContactMutation.mutate(contactId);
    }
  };

  const handleSubmitContact = (data: ContactFormData) => {
    if (editingContact) {
      editContactMutation.mutate(data);
    } else {
      addContactMutation.mutate(data);
    }
  };

  const emailContact = (email: string) => {
    if (email) {
      window.location.href = `mailto:${email}`;
    }
  };

  const callContact = (phone: string) => {
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  };

  const visitWebsite = (website: string) => {
    if (website) {
      window.open(website, '_blank');
    }
  };

  const viewOnMap = (address: string) => {
    if (address) {
      window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank');
    }
  };

  // Loading state
  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950/50">
        <div className="bg-white dark:bg-gray-900 border-b">
          <div className="container mx-auto px-6 py-4">
            <Skeleton className="h-8 w-64" />
          </div>
        </div>
        <div className="container mx-auto px-6 py-6 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950/50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-6 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">Company Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The requested company could not be found or you don't have access to it.
            </p>
            <Link href="/target-companies">
              <Button>Return to Companies</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryContact = contacts.find(c => c.isPrimary);
  const otherContacts = contacts.filter(c => !c.isPrimary);

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950/50">
      {/* Modern Header */}
      <div className="bg-white dark:bg-gray-900 border-b sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/target-companies">
                <Button variant="ghost" size="sm" data-testid="button-back">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-company-name">
                    {company.companyName}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    {company.industry && (
                      <Badge variant="secondary" className="text-xs" data-testid="badge-industry">
                        {company.industry}
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {profile?.yearsInBusiness ? `${profile.yearsInBusiness} years` : 'New business'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button onClick={handleAddContact} size="sm" data-testid="button-add-contact">
                <Plus className="w-4 h-4 mr-2" />
                Add Contact
              </Button>
              {company.website && (
                <Button variant="outline" size="sm" onClick={() => visitWebsite(company.website!)} data-testid="button-visit-website">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6 max-w-7xl">
        {/* Key Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">Annual Revenue</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100" data-testid="metric-revenue">
                    {company.annualRevenue ? formatCurrency(company.annualRevenue) : 'N/A'}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Employees</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100" data-testid="metric-employees">
                    {company.employeeCount ? formatNumber(company.employeeCount) : 'N/A'}
                  </p>
                </div>
                <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 border-purple-200 dark:border-purple-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Revenue/Employee</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100" data-testid="metric-revenue-per-employee">
                    {profile?.revenuePerEmployee ? formatCurrency(profile.revenuePerEmployee.toString()) : 'N/A'}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200 dark:border-orange-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Contacts</p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100" data-testid="metric-contacts">
                    {profile?.totalContacts || 0}
                  </p>
                </div>
                <User className="w-8 h-8 text-orange-600 dark:text-orange-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modern Tabbed Interface */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Contacts
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-2">
              <BarChart className="w-4 h-4" />
              Analysis
            </TabsTrigger>
            <TabsTrigger value="activities" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Activities
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Pipeline
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Team
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Company Information */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Company Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {company.website && (
                    <div className="flex items-center gap-3" data-testid="info-website">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-muted-foreground">Website</span>
                        <div>
                          <a 
                            href={company.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            {company.website.replace(/^https?:\/\//, '')}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {company.email && (
                    <div className="flex items-center gap-3" data-testid="info-email">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-muted-foreground">Email</span>
                        <div>
                          <a href={`mailto:${company.email}`} className="text-blue-600 hover:underline">
                            {company.email}
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {company.phone && (
                    <div className="flex items-center gap-3" data-testid="info-phone">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-muted-foreground">Phone</span>
                        <div>
                          <a href={`tel:${company.phone}`} className="text-blue-600 hover:underline">
                            {company.phone}
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {company.address && (
                    <div className="flex items-start gap-3" data-testid="info-address">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-muted-foreground">Address</span>
                        <div>
                          <button 
                            onClick={() => viewOnMap(company.address!)}
                            className="text-blue-600 hover:underline text-left"
                          >
                            {company.address}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {company.yearEstablished && (
                    <div className="flex items-center gap-3" data-testid="info-year-established">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-muted-foreground">Established</span>
                        <div>{company.yearEstablished}</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Business Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {company.description && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Description</span>
                      <p className="mt-2 text-sm leading-relaxed" data-testid="info-description">
                        {company.description}
                      </p>
                    </div>
                  )}

                  {/* Website Analysis Section */}
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Website Analysis</span>
                      {profileFetching && !profileLoading && (
                        <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {profileLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    ) : company.websiteAnalysis ? (
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">
                          Analysis completed: {company.websiteAnalysisProcessedAt 
                            ? new Date(company.websiteAnalysisProcessedAt).toLocaleString()
                            : 'Unknown'
                          }
                        </div>
                        <div 
                          className="prose prose-xs max-w-none dark:prose-invert text-sm leading-relaxed [&>*]:text-sm [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&>p]:text-sm [&>ul]:text-sm [&>ol]:text-sm [&>li]:text-sm"
                          data-testid="website-analysis-content"
                        >
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {company.websiteAnalysis}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">Website Analysis Pending</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              queryClient.invalidateQueries({ queryKey: ["/api/target-companies", id, "profile"] });
                              refetchProfile();
                            }}
                            disabled={profileFetching}
                            className="h-7 px-2"
                            data-testid="button-refresh-analysis-business-info"
                          >
                            <RefreshCw className={`w-4 h-4 mr-1 ${profileFetching ? 'animate-spin' : ''}`} />
                            {profileFetching ? 'Checking...' : 'Refresh'}
                          </Button>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Website analysis is currently being processed. This usually takes about 30 seconds.
                        </div>
                        {profileFetching && (
                          <div className="flex items-center gap-2 mt-2 text-sm text-blue-600">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Checking for updates...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Show a placeholder if neither description nor analysis is available */}
                  {!company.description && !company.websiteAnalysis && !profileLoading && (
                    <div className="text-center py-6 text-muted-foreground">
                      <FileText className="w-6 h-6 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No business information available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Deal Notes Section */}
            <DealNotesSection targetCompanyId={parseInt(id!)} />

            {/* System Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Record Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Created By</span>
                    <div className="mt-1">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{profile?.createdByName || 'Unknown'}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {formatDate(company.createdAt ? company.createdAt.toString() : undefined)}
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Organization</span>
                    <div className="mt-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{profile?.userCompanyName || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Primary Contact</span>
                    <div className="mt-1">
                      {profile?.primaryContactName ? (
                        <div>
                          <div className="font-medium">{profile.primaryContactName}</div>
                          {profile.primaryContactEmail && (
                            <div className="text-sm text-muted-foreground">{profile.primaryContactEmail}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No primary contact</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>



          <TabsContent value="contacts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Directory</CardTitle>
                <CardDescription>
                  Key people at {company.companyName} ({profile?.totalContacts || 0} contacts)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {contacts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">No contacts added yet</p>
                    <p className="text-sm mb-4">Add contacts to track key people at this company</p>
                    <Button onClick={handleAddContact} data-testid="button-add-first-contact">
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Contact
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Primary Contact Highlight */}
                    {primaryContact && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                        <h3 className="font-semibold text-lg mb-4 text-blue-900 dark:text-blue-100">Primary Contact</h3>
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                          <div className="space-y-3">
                            <div>
                              <h4 className="text-xl font-bold" data-testid="primary-contact-name">
                                {primaryContact.firstName} {primaryContact.lastName}
                              </h4>
                              {primaryContact.title && (
                                <p className="text-muted-foreground font-medium" data-testid="primary-contact-title">
                                  {primaryContact.title}
                                </p>
                              )}
                            </div>
                            
                            <div className="flex flex-wrap gap-4">
                              {primaryContact.email && (
                                <a 
                                  href={`mailto:${primaryContact.email}`} 
                                  className="flex items-center gap-2 text-blue-600 hover:underline"
                                  data-testid="primary-contact-email"
                                >
                                  <Mail className="w-4 h-4" />
                                  {primaryContact.email}
                                </a>
                              )}
                              {primaryContact.phone && (
                                <a 
                                  href={`tel:${primaryContact.phone}`} 
                                  className="flex items-center gap-2 text-blue-600 hover:underline"
                                  data-testid="primary-contact-phone"
                                >
                                  <Phone className="w-4 h-4" />
                                  {primaryContact.phone}
                                </a>
                              )}
                            </div>
                            
                            {primaryContact.notes && (
                              <p className="text-sm text-muted-foreground bg-white dark:bg-gray-800 p-3 rounded border" data-testid="primary-contact-notes">
                                {primaryContact.notes}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex gap-2 lg:flex-col">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditContact(primaryContact)}
                              data-testid="button-edit-primary-contact"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Other Contacts */}
                    {otherContacts.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-lg mb-4">Other Contacts</h3>
                        <div className="grid gap-4">
                          {otherContacts.map((contact) => (
                            <Card key={contact.id} className="hover:shadow-sm transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <h4 className="font-semibold" data-testid={`contact-name-${contact.id}`}>
                                        {contact.firstName} {contact.lastName}
                                      </h4>
                                    </div>
                                    
                                    {contact.title && (
                                      <p className="text-sm text-muted-foreground mb-2" data-testid={`contact-title-${contact.id}`}>
                                        {contact.title}
                                      </p>
                                    )}
                                    
                                    <div className="flex flex-wrap gap-3 text-sm">
                                      {contact.email && (
                                        <a 
                                          href={`mailto:${contact.email}`} 
                                          className="text-blue-600 hover:underline flex items-center gap-1"
                                          data-testid={`contact-email-${contact.id}`}
                                        >
                                          <Mail className="w-3 h-3" />
                                          {contact.email}
                                        </a>
                                      )}
                                      {contact.phone && (
                                        <a 
                                          href={`tel:${contact.phone}`} 
                                          className="text-blue-600 hover:underline flex items-center gap-1"
                                          data-testid={`contact-phone-${contact.id}`}
                                        >
                                          <Phone className="w-3 h-3" />
                                          {contact.phone}
                                        </a>
                                      )}
                                    </div>
                                    
                                    {contact.notes && (
                                      <p className="text-sm text-muted-foreground mt-2" data-testid={`contact-notes-${contact.id}`}>
                                        {contact.notes}
                                      </p>
                                    )}
                                  </div>
                                  
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEditContact(contact)}
                                      data-testid={`button-edit-contact-${contact.id}`}
                                    >
                                      <Edit className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteContact(contact.id)}
                                      data-testid={`button-delete-contact-${contact.id}`}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <DocumentManagement 
              targetCompanyId={parseInt(id!)}
              companyName={company.companyName}
            />
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            {analysisLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
                <Skeleton className="h-64 w-full" />
              </div>
            ) : stage1Events.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No analysis available yet</p>
                <p className="text-sm mb-4">Analysis will be automatically generated when all 5 required documents are uploaded and analyzed</p>
                <div className="text-xs text-muted-foreground">
                  Required documents: Asset Register, Balance Sheet, Profit & Loss, Sales Ledger, Staff Matrix
                </div>
              </div>
            ) : (
              <Tabs defaultValue="investment-summary" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="investment-summary" data-testid="tab-investment-summary">
                    Investment Summary & Recommendation
                  </TabsTrigger>
                  <TabsTrigger value="detailed-analysis" data-testid="tab-detailed-analysis">
                    Detailed Analysis
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="investment-summary" className="space-y-6">
                  {(() => {
                    const successfulEvent = stage1Events.find(event => event.webhookStatus === 'success');
                    const eventToShow = successfulEvent || stage1Events[0];
                    
                    if (!eventToShow) {
                      return (
                        <div className="text-center py-12 text-muted-foreground">
                          <BarChart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p className="text-lg font-medium mb-2">No analysis available</p>
                          <p className="text-sm">Analysis will appear here when ready</p>
                        </div>
                      );
                    }

                    if (eventToShow.webhookStatus === 'pending') {
                      return (
                        <div className="text-center py-12 text-muted-foreground">
                          <RefreshCw className="w-12 h-12 mx-auto mb-4 animate-spin opacity-50" />
                          <p className="text-lg font-medium mb-2">Analysis in progress...</p>
                          <p className="text-sm">Please wait while we analyze your documents</p>
                        </div>
                      );
                    }

                    if (eventToShow.webhookStatus === 'failed') {
                      return (
                        <div className="text-center py-12 text-red-600 dark:text-red-400">
                          <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p className="text-lg font-medium mb-2">Analysis failed</p>
                          <p className="text-sm">{eventToShow.webhookResponse || 'An error occurred during analysis'}</p>
                        </div>
                      );
                    }

                    if (!eventToShow.webhookResponse) {
                      return (
                        <div className="text-center py-12 text-muted-foreground">
                          <BarChart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p className="text-lg font-medium mb-2">No analysis data</p>
                          <p className="text-sm">Analysis response is empty</p>
                        </div>
                      );
                    }

                    // Parse usage metadata if available
                    let usageMetadata = null;
                    if (eventToShow.usageMetadata) {
                      try {
                        usageMetadata = typeof eventToShow.usageMetadata === 'string' 
                          ? JSON.parse(eventToShow.usageMetadata) 
                          : eventToShow.usageMetadata;
                      } catch (e) {
                        console.error('Failed to parse usage metadata:', e);
                      }
                    }

                    // Get the markdown content - the response is stored as the analysis directly
                    const markdownContent = eventToShow.webhookResponse;

                    return (
                      <Stage1AnalysisDisplay 
                        markdown={markdownContent}
                        usageMetadata={usageMetadata}
                        processingTime={eventToShow.processingTime || undefined}
                      />
                    );
                  })()}
                </TabsContent>


                <TabsContent value="detailed-analysis" className="space-y-6">
                  {(() => {
                    const successfulEvent = stage1Events.find(event => event.webhookStatus === 'success');
                    
                    if (!successfulEvent) {
                      return (
                        <div className="text-center py-12 text-muted-foreground">
                          <BarChart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p className="text-lg font-medium mb-2">Basic analysis required first</p>
                          <p className="text-sm">Please complete the basic analysis before running detailed analysis</p>
                        </div>
                      );
                    }

                    if (successfulEvent.detailedAnalysisStatus === 'processing') {
                      return (
                        <div className="text-center py-12 text-muted-foreground">
                          <RefreshCw className="w-12 h-12 mx-auto mb-4 animate-spin opacity-50" />
                          <p className="text-lg font-medium mb-2">Detailed analysis in progress...</p>
                          <p className="text-sm">This may take a few minutes. The page will update automatically when complete.</p>
                        </div>
                      );
                    }

                    if (successfulEvent.detailedAnalysisStatus === 'failed') {
                      return (
                        <div className="text-center py-12">
                          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500 opacity-70" />
                          <p className="text-lg font-medium mb-2 text-red-600">Detailed analysis failed</p>
                          <p className="text-sm text-muted-foreground mb-4">{successfulEvent.detailedAnalysisMarkdown || 'An error occurred during analysis'}</p>
                          <Button 
                            onClick={() => triggerDetailedAnalysisMutation.mutate()}
                            disabled={triggerDetailedAnalysisMutation.isPending}
                          >
                            {triggerDetailedAnalysisMutation.isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Starting...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Retry Detailed Analysis
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    }

                    if (successfulEvent.detailedAnalysisStatus === 'success' && successfulEvent.detailedAnalysisMarkdown) {
                      let detailedUsageMetadata = null;
                      if (successfulEvent.detailedAnalysisUsageMetadata) {
                        try {
                          detailedUsageMetadata = typeof successfulEvent.detailedAnalysisUsageMetadata === 'string' 
                            ? JSON.parse(successfulEvent.detailedAnalysisUsageMetadata) 
                            : successfulEvent.detailedAnalysisUsageMetadata;
                        } catch (e) {
                          console.error('Failed to parse detailed analysis usage metadata:', e);
                        }
                      }

                      return (
                        <DealSheetVisualDisplay 
                          markdown={successfulEvent.detailedAnalysisMarkdown}
                          usageMetadata={detailedUsageMetadata}
                          processingTime={successfulEvent.detailedAnalysisProcessingTime || undefined}
                        />
                      );
                    }

                    return (
                      <div className="text-center py-12 text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">Detailed Analysis Available</p>
                        <p className="text-sm mb-6">Generate a comprehensive Deal Sheet with detailed due diligence insights</p>
                        <Button 
                          onClick={() => triggerDetailedAnalysisMutation.mutate()}
                          disabled={triggerDetailedAnalysisMutation.isPending}
                          size="lg"
                        >
                          {triggerDetailedAnalysisMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Starting Analysis...
                            </>
                          ) : (
                            <>
                              <BarChart3 className="w-4 h-4 mr-2" />
                              Generate Detailed Analysis
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })()}
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>

          <TabsContent value="activities" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Activity Timeline</CardTitle>
                <CardDescription>
                  Track all interactions and activities with {company.companyName}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ActivityManagement 
                  targetCompanyId={parseInt(id!)}
                  companyName={company.companyName}
                  contacts={contacts}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-6">
            <PipelineStageManagement 
              targetCompanyId={parseInt(id!)}
              targetCompanyName={company.companyName}
              currentStage={company.stage || 'New Target'}
              stageUpdatedAt={company.stageUpdatedAt ? (typeof company.stageUpdatedAt === 'string' ? company.stageUpdatedAt : company.stageUpdatedAt.toISOString()) : (company.createdAt ? (typeof company.createdAt === 'string' ? company.createdAt : company.createdAt.toISOString()) : new Date().toISOString())}
              stageUpdatedBy={company.stageUpdatedBy}
              daysInStage={company.stageUpdatedAt 
                ? Math.floor((new Date().getTime() - new Date(company.stageUpdatedAt).getTime()) / (1000 * 60 * 60 * 24))
                : company.createdAt 
                  ? Math.floor((new Date().getTime() - new Date(company.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                  : 0
              }
            />
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            <DealTeamManagement 
              targetCompanyId={parseInt(id!)} 
              targetCompanyName={company.companyName} 
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Contact Form Dialog */}
      <Dialog open={showContactForm} onOpenChange={setShowContactForm}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? "Edit Contact" : "Add New Contact"}
            </DialogTitle>
          </DialogHeader>

          <Form {...contactForm}>
            <form onSubmit={contactForm.handleSubmit(handleSubmitContact)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={contactForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={contactForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={contactForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
                    <FormControl>
                      <Input placeholder="CEO, Owner, Manager..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={contactForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@company.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={contactForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={contactForm.control}
                name="isPrimary"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Set as primary contact
                      </FormLabel>
                      <p className="text-[0.8rem] text-muted-foreground">
                        The primary contact will be highlighted in the company profile
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={contactForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Additional notes about this contact..."
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowContactForm(false)}
                  disabled={addContactMutation.isPending || editContactMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addContactMutation.isPending || editContactMutation.isPending}
                >
                  {addContactMutation.isPending || editContactMutation.isPending
                    ? "Saving..."
                    : editingContact
                    ? "Update Contact"
                    : "Add Contact"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}