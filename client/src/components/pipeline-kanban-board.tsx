import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Building2, Users, DollarSign, Eye, ExternalLink, Phone, Clock, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
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

const stageMoveSchema = z.object({
  notes: z.string().optional(),
});

type StageMoveFormValues = z.infer<typeof stageMoveSchema>;

const STAGE_COLORS = [
  { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800/60", accent: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
  { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800/60", accent: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  { bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800/60", accent: "bg-orange-500", text: "text-orange-600 dark:text-orange-400" },
  { bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800/60", accent: "bg-purple-500", text: "text-purple-600 dark:text-purple-400" },
  { bg: "bg-pink-50 dark:bg-pink-950/30", border: "border-pink-200 dark:border-pink-800/60", accent: "bg-pink-500", text: "text-pink-600 dark:text-pink-400" },
  { bg: "bg-indigo-50 dark:bg-indigo-950/30", border: "border-indigo-200 dark:border-indigo-800/60", accent: "bg-indigo-500", text: "text-indigo-600 dark:text-indigo-400" },
  { bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800/60", accent: "bg-green-500", text: "text-green-600 dark:text-green-400" },
  { bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800/60", accent: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  { bg: "bg-teal-50 dark:bg-teal-950/30", border: "border-teal-200 dark:border-teal-800/60", accent: "bg-teal-500", text: "text-teal-600 dark:text-teal-400" },
  { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800/60", accent: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
];

export function PipelineKanbanBoard() {
  const { toast } = useToast();
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [draggedCompany, setDraggedCompany] = useState<TargetCompany | null>(null);
  const [targetStage, setTargetStage] = useState<string | null>(null);

  const form = useForm<StageMoveFormValues>({
    resolver: zodResolver(stageMoveSchema),
    defaultValues: { notes: "" },
  });

  const { data: stages, isLoading: stagesLoading } = useQuery<PipelineStage[]>({
    queryKey: ['/api/v2/pipeline/stages'],
    select: (response: any) => response.data,
  });

  const { data: companies, isLoading: companiesLoading } = useQuery<TargetCompany[]>({
    queryKey: ['/api/v2/target-companies'],
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ companyId, stage, notes }: { companyId: number; stage: string; notes?: string }) => {
      const response = await apiRequest('PUT', `/api/v2/pipeline/companies/${companyId}/stage`, { stage, notes });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Stage Updated", description: "Company moved to the new stage." });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/target-companies'] });
      setShowNotesDialog(false);
      setDraggedCompany(null);
      setTargetStage(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update stage", variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/target-companies'] });
    },
  });

  useEffect(() => {
    if (stages && companies) {
      const newColumns = stages.map(stage => ({
        stageName: stage.stageName,
        stageOrder: stage.stageOrder,
        description: stage.description,
        companies: companies.filter(company => (company.stage || 'New Target') === stage.stageName),
      }));
      setColumns(newColumns);
    }
  }, [stages, companies]);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const companyId = parseInt(draggableId);
    const company = companies?.find(c => c.id === companyId);
    const newStage = destination.droppableId;

    if (!company || !newStage) return;
    if ((company.stage || 'New Target') === newStage) return;

    setDraggedCompany(company);
    setTargetStage(newStage);
    setShowNotesDialog(true);

    const newColumns = columns.map(col => ({
      ...col,
      companies: [...col.companies],
    }));

    const sourceColumn = newColumns.find(col => col.stageName === source.droppableId);
    const destColumn = newColumns.find(col => col.stageName === destination.droppableId);

    if (sourceColumn && destColumn) {
      const [removed] = sourceColumn.companies.splice(source.index, 1);
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

  const handleCancelMove = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/v2/target-companies'] });
    setShowNotesDialog(false);
    setDraggedCompany(null);
    setTargetStage(null);
    form.reset();
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
    return Math.floor((new Date().getTime() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
  };

  if (stagesLoading || companiesLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 min-w-0 overflow-hidden">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">M&A Pipeline Board</h1>
        <p className="text-muted-foreground">Drag and drop companies between stages</p>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column, columnIndex) => {
            const colors = STAGE_COLORS[columnIndex % STAGE_COLORS.length];

            return (
              <div
                key={column.stageName}
                className="flex-shrink-0 w-72"
                data-testid={`pipeline-column-${column.stageName.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className={`rounded-lg ${colors.bg} ${colors.border} border p-3 mb-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${colors.accent}`} />
                      <h3 className="font-semibold text-foreground">{column.stageName}</h3>
                    </div>
                    <Badge variant="secondary" className={colors.text}>
                      {column.companies.length}
                    </Badge>
                  </div>
                  {column.description && (
                    <p className="text-xs text-muted-foreground mt-1 ml-5">{column.description}</p>
                  )}
                </div>

                <Droppable droppableId={column.stageName}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[500px] rounded-lg p-2 transition-colors ${
                        snapshot.isDraggingOver
                          ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-dashed border-blue-400'
                          : 'bg-muted/50 border-2 border-transparent'
                      }`}
                      data-testid={`droppable-${column.stageName.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {column.companies.map((company, index) => (
                        <Draggable
                          key={company.id}
                          draggableId={company.id.toString()}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`mb-3 ${snapshot.isDragging ? 'rotate-2' : ''}`}
                              style={provided.draggableProps.style}
                              data-testid={`card-company-${company.id}`}
                            >
                              <Card
                                className={`cursor-grab active:cursor-grabbing transition-shadow ${
                                  snapshot.isDragging
                                    ? 'shadow-xl ring-2 ring-blue-400'
                                    : 'hover:shadow-md'
                                }`}
                              >
                                <CardHeader className="pb-2 pt-3 px-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <CardTitle className="text-sm font-semibold truncate">
                                        {company.companyName}
                                      </CardTitle>
                                      {company.industry && (
                                        <Badge variant="outline" className="mt-1 text-xs">
                                          {company.industry}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Link href={`/target-companies/${company.id}`}>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0"
                                          data-testid={`button-view-${company.id}`}
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                        </Button>
                                      </Link>
                                      {company.website && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const url = company.website?.startsWith('http')
                                              ? company.website
                                              : `https://${company.website}`;
                                            window.open(url, '_blank');
                                          }}
                                          data-testid={`button-website-${company.id}`}
                                        >
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent className="pt-0 pb-3 px-3">
                                  <div className="grid grid-cols-2 gap-2 mb-2">
                                    <div className="bg-green-50 dark:bg-green-950/30 rounded p-2">
                                      <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                        <DollarSign className="h-3 w-3" />
                                        <span className="text-xs">Revenue</span>
                                      </div>
                                      <p className="text-xs font-semibold text-green-700 dark:text-green-300">
                                        {formatCurrency(company.annualRevenue)}
                                      </p>
                                    </div>
                                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded p-2">
                                      <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                        <Users className="h-3 w-3" />
                                        <span className="text-xs">Staff</span>
                                      </div>
                                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                                        {formatNumber(company.employeeCount)}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                                    <div className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      <span>{company.totalContacts} contacts</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      <span>
                                        {company.stageUpdatedAt
                                          ? getDaysInStage(company.stageUpdatedAt)
                                          : getDaysInStage(company.createdAt)}d
                                      </span>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {column.companies.length === 0 && !snapshot.isDraggingOver && (
                        <EmptyState icon={Building2} title="No companies" size="sm" />
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      <Dialog open={showNotesDialog} onOpenChange={(open) => !open && handleCancelMove()}>
        <DialogContent data-testid="dialog-stage-move">
          <DialogHeader>
            <DialogTitle>Move Company to {targetStage}</DialogTitle>
            <DialogDescription>
              Moving <strong>{draggedCompany?.companyName}</strong> to <strong>{targetStage}</strong>.
              Add optional notes about this stage change.
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
                        placeholder="Add notes about this stage change..."
                        {...field}
                        data-testid="input-stage-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCancelMove} data-testid="button-cancel-move">
                  Cancel
                </Button>
                <Button type="submit" disabled={updateStageMutation.isPending} data-testid="button-confirm-move">
                  {updateStageMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Move
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
