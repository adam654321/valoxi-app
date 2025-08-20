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
import { Building2, Users, DollarSign, Calendar, ExternalLink, Eye, Plus, Loader2, Phone, Clock } from "lucide-react";
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
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [draggedCompany, setDraggedCompany] = useState<TargetCompany | null>(null);
  const [targetStage, setTargetStage] = useState<string | null>(null);

  const form = useForm<StageMoveFormValues>({
    resolver: zodResolver(stageMoveSchema),
    defaultValues: {
      notes: "",
    },
  });

  // Get pipeline stages
  const { data: stages, isLoading: stagesLoading } = useQuery<PipelineStage[]>({
    queryKey: ['/api/pipeline/stages'],
  });

  // Get companies with stats
  const { data: companies, isLoading: companiesLoading } = useQuery<TargetCompany[]>({
    queryKey: ['/api/target-companies'],
  });

  // Stage update mutation
  const updateStageMutation = useMutation({
    mutationFn: async ({ companyId, stage, notes }: { companyId: number; stage: string; notes?: string }) => {
      const response = await fetch(`/api/target-companies/${companyId}/stage`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stage, notes }),
      });
      if (!response.ok) {
        throw new Error('Failed to update stage');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Stage Updated",
        description: "Company has been moved to the new stage successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/target-companies'] });
      setShowNotesDialog(false);
      setDraggedCompany(null);
      setTargetStage(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update stage",
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
    // Remove dragging class from body
    document.body.classList.remove('dragging');
    
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
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
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

  const getDaysInStage = (dateString: string) => {
    const days = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  if (stagesLoading || companiesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6">
        <div className="flex gap-6 overflow-x-auto pb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-80 bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-6"></div>
                <div className="space-y-4">
                  {Array.from({ length: 2 }).map((_, j) => (
                    <div key={j} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Enhanced Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                M&A Pipeline Board
              </h1>
              <p className="text-lg text-muted-foreground">
                Drag and drop companies between pipeline stages to track your acquisition progress
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg px-4 py-2 shadow-sm border border-gray-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-sm">
                    {columns.reduce((acc, col) => acc + col.companies.length, 0)} Total Companies
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DragDropContext 
          onDragEnd={handleDragEnd}
          onBeforeDragStart={() => {
            // Add body class to prevent scroll during drag
            document.body.classList.add('dragging');
            
            // Reset any existing transforms that might interfere
            const allDraggables = document.querySelectorAll('[data-rbd-draggable-id]');
            allDraggables.forEach((el: any) => {
              if (el.style) {
                el.style.transformOrigin = '0 0';
              }
            });
          }}
          onDragStart={(start) => {
            // Ensure proper transform origin on the dragged element
            const draggedElement = document.querySelector(`[data-rbd-draggable-id="${start.draggableId}"]`);
            if (draggedElement) {
              (draggedElement as HTMLElement).style.transformOrigin = '0 0';
            }
          }}
          onDragUpdate={() => {
            // Maintain transform origin during drag
            const draggingElement = document.querySelector('.react-beautiful-dnd-dragging');
            if (draggingElement) {
              (draggingElement as HTMLElement).style.transformOrigin = '0 0';
            }
          }}
        >
          <div className="flex gap-6 overflow-x-auto pb-6" style={{ overflow: 'visible auto' }}>
            {columns.map((column, columnIndex) => {
              const stageColors = [
                { 
                  bg: 'bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20',
                  border: 'border-blue-200 dark:border-blue-700',
                  accent: 'bg-blue-500'
                },
                { 
                  bg: 'bg-gradient-to-b from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20',
                  border: 'border-yellow-200 dark:border-yellow-700',
                  accent: 'bg-yellow-500'
                },
                { 
                  bg: 'bg-gradient-to-b from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20',
                  border: 'border-orange-200 dark:border-orange-700',
                  accent: 'bg-orange-500'
                },
                { 
                  bg: 'bg-gradient-to-b from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20',
                  border: 'border-purple-200 dark:border-purple-700',
                  accent: 'bg-purple-500'
                },
                { 
                  bg: 'bg-gradient-to-b from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20',
                  border: 'border-pink-200 dark:border-pink-700',
                  accent: 'bg-pink-500'
                },
                { 
                  bg: 'bg-gradient-to-b from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20',
                  border: 'border-indigo-200 dark:border-indigo-700',
                  accent: 'bg-indigo-500'
                },
                { 
                  bg: 'bg-gradient-to-b from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20',
                  border: 'border-green-200 dark:border-green-700',
                  accent: 'bg-green-500'
                },
                { 
                  bg: 'bg-gradient-to-b from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20',
                  border: 'border-red-200 dark:border-red-700',
                  accent: 'bg-red-500'
                },
                { 
                  bg: 'bg-gradient-to-b from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20',
                  border: 'border-teal-200 dark:border-teal-700',
                  accent: 'bg-teal-500'
                },
                { 
                  bg: 'bg-gradient-to-b from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20',
                  border: 'border-emerald-200 dark:border-emerald-700',
                  accent: 'bg-emerald-500'
                }
              ];

              const colorScheme = stageColors[columnIndex % stageColors.length];

              return (
                <div key={column.stageName} className="flex-shrink-0 w-80">
                  {/* Floating Stage Header */}
                  <div className="mb-6 relative">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full ${colorScheme.accent} shadow-lg`}></div>
                        <h3 className="font-bold text-xl text-gray-900 dark:text-white">
                          {column.stageName}
                        </h3>
                      </div>
                      <div className={`${colorScheme.accent} text-white rounded-full px-4 py-2 shadow-lg`}>
                        <span className="text-sm font-bold">
                          {column.companies.length}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 ml-7">
                      {column.description}
                    </p>
                    {/* Subtle column background indicator */}
                    <div className={`absolute -inset-x-4 -inset-y-2 rounded-xl ${colorScheme.bg} opacity-20 -z-10`}></div>
                  </div>

                  {/* Invisible Drop Zone Container */}
                  <Droppable droppableId={column.stageName}>
                    {(provided: any, snapshot: any) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[600px] transition-all duration-300 relative ${
                          snapshot.isDraggingOver
                            ? 'bg-gradient-to-b from-blue-50/30 to-blue-100/30 dark:from-blue-900/10 dark:to-blue-800/10 rounded-xl scale-[1.01]'
                            : ''
                        }`}
                        style={{ 
                          border: snapshot.isDraggingOver ? '2px dashed #3b82f6' : '2px dashed transparent',
                          borderRadius: '12px',
                          padding: '8px'
                        }}
                      >
                        <div className="space-y-4">
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
                                    className={`cursor-grab active:cursor-grabbing ${
                                      snapshot.isDragging
                                        ? 'shadow-2xl ring-2 ring-blue-300 dark:ring-blue-500'
                                        : 'hover:shadow-lg hover:scale-[1.01] hover:-translate-y-1 transition-all duration-200'
                                    } bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700`}
                                    style={{
                                      ...provided.draggableProps.style,
                                      ...(snapshot.isDragging && {
                                        zIndex: 999999,
                                      })
                                    }}
                                  >
                                    <CardHeader className="pb-3">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                          <CardTitle className="text-base font-bold text-gray-900 dark:text-white truncate mb-1">
                                            {company.companyName}
                                          </CardTitle>
                                          {company.industry && (
                                            <div className="inline-block">
                                              <Badge 
                                                variant="secondary" 
                                                className="text-xs bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700"
                                              >
                                                {company.industry}
                                              </Badge>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1 ml-2">
                                          <Link href={`/target-companies/${company.id}`}>
                                            <Button 
                                              variant="ghost" 
                                              size="sm" 
                                              className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                                            >
                                              <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                            </Button>
                                          </Link>
                                          {company.website && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-900/30"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const url = company.website?.startsWith('http') 
                                                  ? company.website 
                                                  : `https://${company.website}`;
                                                window.open(url, '_blank');
                                              }}
                                            >
                                              <ExternalLink className="h-4 w-4 text-green-600 dark:text-green-400" />
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    </CardHeader>
                                    <CardContent className="pt-0 space-y-3">
                                      {/* Key Metrics Grid */}
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                                          <div className="flex items-center gap-2 mb-1">
                                            <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                                            <span className="text-xs text-green-700 dark:text-green-300 font-medium">Revenue</span>
                                          </div>
                                          <div className="text-sm font-bold text-green-800 dark:text-green-200">
                                            {formatCurrency(company.annualRevenue)}
                                          </div>
                                        </div>
                                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                                          <div className="flex items-center gap-2 mb-1">
                                            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                            <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Staff</span>
                                          </div>
                                          <div className="text-sm font-bold text-blue-800 dark:text-blue-200">
                                            {formatNumber(company.employeeCount)}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Bottom Stats */}
                                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-700">
                                        <div className="flex items-center gap-2">
                                          <Phone className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                            {company.totalContacts} contacts
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                            {company.stageUpdatedAt
                                              ? getDaysInStage(company.stageUpdatedAt)
                                              : getDaysInStage(company.createdAt)
                                            }d
                                          </span>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                            
                            {/* Empty State */}
                            {column.companies.length === 0 && (
                              <div className="text-center py-12">
                                <Building2 className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                                  No companies in this stage
                                </p>
                                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                                  Drag companies here to get started
                                </p>
                              </div>
                            )}
                        </div>
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
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
                          placeholder="Add any relevant notes about this stage change..."
                          className="min-h-[100px]"
                          {...field}
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
    </div>
  );
}