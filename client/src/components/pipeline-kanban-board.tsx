import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Building2, Users, DollarSign, Calendar, ExternalLink, Eye, Plus, Loader2 } from "lucide-react";
import { Link } from "wouter";

interface PipelineStage {
  id: number;
  stageName: string;
  stageOrder: number;
  description: string;
  isActive: boolean;
}

interface TargetCompany {
  id: number;
  companyName: string;
  industry: string | null;
  annualRevenue: string | null;
  employeeCount: string | null;
  stage: string | null;
  website: string | null;
  createdAt: string;
  stageUpdatedAt: string | null;
  totalContacts: number;
  contactCount: number;
  primaryContactName: string | null;
}

interface KanbanColumn {
  stageName: string;
  companies: TargetCompany[];
  stageOrder: number;
  description: string;
}

// Form schema for stage move with notes
const stageMoveSchema = z.object({
  notes: z.string().optional(),
});

type StageMoveFormValues = z.infer<typeof stageMoveSchema>;

export function PipelineKanbanBoard() {
  const { toast } = useToast();
  const [draggedCompany, setDraggedCompany] = useState<TargetCompany | null>(null);
  const [targetStage, setTargetStage] = useState<string | null>(null);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);

  // Form for adding notes when moving stages
  const form = useForm<StageMoveFormValues>({
    resolver: zodResolver(stageMoveSchema),
    defaultValues: {
      notes: "",
    },
  });

  // Query for pipeline stages
  const { data: stages, isLoading: stagesLoading } = useQuery<PipelineStage[]>({
    queryKey: ['/api/pipeline/stages'],
  });

  // Query for all target companies
  const { data: companies, isLoading: companiesLoading } = useQuery<TargetCompany[]>({
    queryKey: ['/api/target-companies'],
  });

  // Mutation for updating company stage
  const updateStageMutation = useMutation({
    mutationFn: async (data: { companyId: number; stage: string; notes?: string }) => {
      return await apiRequest('PUT', `/api/target-companies/${data.companyId}/stage`, { 
        stage: data.stage, 
        notes: data.notes || '' 
      });
    },
    onSuccess: () => {
      toast({
        title: "Stage updated",
        description: "Company moved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/target-companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline/overview'] });
      setShowNotesDialog(false);
      setDraggedCompany(null);
      setTargetStage(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error updating stage",
        description: error.message || "Failed to update company stage",
        variant: "destructive",
      });
      // Refresh to revert any optimistic updates
      queryClient.invalidateQueries({ queryKey: ['/api/target-companies'] });
    },
  });

  // Organize companies into columns by stage
  useEffect(() => {
    if (stages && companies) {
      const newColumns = stages.map(stage => ({
        stageName: stage.stageName,
        stageOrder: stage.stageOrder,
        description: stage.description,
        companies: companies.filter(company => 
          (company.stage || 'New Target') === stage.stageName
        ),
      }));
      setColumns(newColumns);
    }
  }, [stages, companies]);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // If dropped outside a droppable area
    if (!destination) {
      return;
    }

    // If dropped in the same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const companyId = parseInt(draggableId);
    const company = companies?.find(c => c.id === companyId);
    const newStage = destination.droppableId;

    if (!company || !newStage) {
      return;
    }

    // If it's the same stage, just return
    if ((company.stage || 'New Target') === newStage) {
      return;
    }

    // Set up for notes dialog
    setDraggedCompany(company);
    setTargetStage(newStage);
    setShowNotesDialog(true);

    // Optimistic update - move the company immediately in the UI
    const newColumns = [...columns];
    const sourceColumn = newColumns.find(col => col.stageName === source.droppableId);
    const destColumn = newColumns.find(col => col.stageName === destination.droppableId);

    if (sourceColumn && destColumn) {
      // Remove from source
      const [removed] = sourceColumn.companies.splice(source.index, 1);
      // Add to destination
      destColumn.companies.splice(destination.index, 0, { ...removed, stage: newStage });
      setColumns(newColumns);
    }
  };

  const handleStageMove = (data: StageMoveFormValues) => {
    if (!draggedCompany || !targetStage) return;

    updateStageMutation.mutate({
      companyId: draggedCompany.id,
      stage: targetStage,
      notes: data.notes,
    });
  };

  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return "N/A";
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: 'compact',
    }).format(num);
  };

  const formatNumber = (value: string | null | undefined) => {
    if (!value) return "N/A";
    const num = parseInt(value);
    if (isNaN(num)) return value;
    return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(num);
  };

  const getStageColor = (stageName: string): string => {
    switch (stageName) {
      case 'New Target':
        return 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700';
      case 'Initial Contact':
      case 'Documents Requested':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      case 'Under Review':
      case 'Offer Stage':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'Negotiation':
      case 'Due Diligence':
        return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
      case 'Legal & Accounting':
        return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800';
      case 'Completion':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'Not Qualified':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      default:
        return 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700';
    }
  };

  const getBadgeVariant = (stageName: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (stageName) {
      case 'New Target':
        return 'outline';
      case 'Initial Contact':
      case 'Documents Requested':
      case 'Under Review':
        return 'secondary';
      case 'Offer Stage':
      case 'Negotiation':
      case 'Due Diligence':
      case 'Legal & Accounting':
        return 'default';
      case 'Completion':
        return 'default';
      case 'Not Qualified':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (stagesLoading || companiesLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">M&A Pipeline Board</h1>
        <p className="text-muted-foreground">
          Drag and drop companies between pipeline stages to track your acquisition progress
        </p>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <div key={column.stageName} className="flex-shrink-0 w-80">
              <div className={`rounded-lg border-2 ${getStageColor(column.stageName)} min-h-96`}>
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-lg">{column.stageName}</h3>
                    <Badge variant={getBadgeVariant(column.stageName)}>
                      {column.companies.length}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{column.description}</p>
                </div>

                <Droppable droppableId={column.stageName}>
                  {(provided: any, snapshot: any) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`p-4 min-h-80 transition-colors ${
                        snapshot.isDraggingOver
                          ? 'bg-blue-100 dark:bg-blue-900/30'
                          : ''
                      }`}
                    >
                      <div className="space-y-3">
                        {column.companies.map((company, index) => (
                          <Draggable
                            key={company.id}
                            draggableId={company.id.toString()}
                            index={index}
                          >
                            {(provided: any, snapshot: any) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`cursor-grab active:cursor-grabbing transition-shadow ${
                                  snapshot.isDragging
                                    ? 'shadow-lg scale-105 rotate-1'
                                    : 'hover:shadow-md'
                                }`}
                              >
                                <CardHeader className="pb-2">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <CardTitle className="text-base font-semibold truncate">
                                        {company.companyName}
                                      </CardTitle>
                                      {company.industry && (
                                        <CardDescription className="text-xs mt-1">
                                          {company.industry}
                                        </CardDescription>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 ml-2">
                                      <Link href={`/target-companies/${company.id}`}>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                          <Eye className="h-3 w-3" />
                                        </Button>
                                      </Link>
                                      {company.website && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(company.website!, '_blank');
                                          }}
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                  <div className="space-y-2 text-xs">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <DollarSign className="h-3 w-3" />
                                        <span>Revenue</span>
                                      </div>
                                      <span className="font-medium">
                                        {formatCurrency(company.annualRevenue)}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <Users className="h-3 w-3" />
                                        <span>Employees</span>
                                      </div>
                                      <span className="font-medium">
                                        {formatNumber(company.employeeCount)}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <Users className="h-3 w-3" />
                                        <span>Contacts</span>
                                      </div>
                                      <span className="font-medium">{company.totalContacts}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <Calendar className="h-3 w-3" />
                                        <span>In stage</span>
                                      </div>
                                      <span className="font-medium">
                                        {company.stageUpdatedAt
                                          ? Math.floor((new Date().getTime() - new Date(company.stageUpdatedAt).getTime()) / (1000 * 60 * 60 * 24))
                                          : Math.floor((new Date().getTime() - new Date(company.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                                        } days
                                      </span>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Notes Dialog for Stage Changes */}
      <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Company to {targetStage}</DialogTitle>
            <DialogDescription>
              Moving <strong>{draggedCompany?.companyName}</strong> to <strong>{targetStage}</strong>.
              Would you like to add any notes about this stage change?
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleStageMove)} className="space-y-4">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Add notes about this stage change..."
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowNotesDialog(false);
                    // Revert optimistic update
                    queryClient.invalidateQueries({ queryKey: ['/api/target-companies'] });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateStageMutation.isPending}>
                  {updateStageMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Moving...
                    </>
                  ) : (
                    'Confirm Move'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}