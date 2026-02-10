import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TrendingUp, Clock, ArrowRight, Edit3, History, Activity } from "lucide-react";

interface PipelineStage {
  id: number;
  stageName: string;
  stageOrder: number;
  description: string;
  isActive: boolean;
}

interface StageHistory {
  id: number;
  targetCompanyId: number;
  fromStage: string | null;
  toStage: string;
  changedBy: number;
  changedAt: string;
  notes: string | null;
  createdAt: string;
}

interface PipelineStageManagementProps {
  targetCompanyId: number;
  targetCompanyName: string;
  currentStage: string;
  stageUpdatedAt: string;
  stageUpdatedBy: number | null;
  daysInStage: number;
}

// Form schema for updating stage
const updateStageSchema = z.object({
  stage: z.string().min(1, "Stage is required"),
  notes: z.string().optional(),
});

type UpdateStageFormValues = z.infer<typeof updateStageSchema>;

export function PipelineStageManagement({
  targetCompanyId,
  targetCompanyName,
  currentStage,
  stageUpdatedAt,
  stageUpdatedBy,
  daysInStage
}: PipelineStageManagementProps) {
  const { toast } = useToast();
  const [isStageDialogOpen, setIsStageDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

  // Query for available pipeline stages
  const { data: stages, isLoading: stagesLoading } = useQuery<PipelineStage[]>({
    queryKey: ['/api/v2/pipeline/stages'],
    select: (response: any) => response.data,
  });

  // Query for stage history
  const { data: stageHistory, isLoading: historyLoading } = useQuery<StageHistory[]>({
    queryKey: ['/api/v2/pipeline/companies', targetCompanyId, 'stage-history'],
    select: (response: any) => response.data,
    enabled: isHistoryDialogOpen,
  });

  // Form for updating stage
  const form = useForm<UpdateStageFormValues>({
    resolver: zodResolver(updateStageSchema),
    defaultValues: {
      stage: currentStage,
      notes: "",
    },
  });

  // Mutation for updating company stage
  const updateStageMutation = useMutation({
    mutationFn: async (data: UpdateStageFormValues) => {
      return await apiRequest('PUT', `/api/v2/pipeline/companies/${targetCompanyId}/stage`, data);
    },
    onSuccess: () => {
      toast({
        title: "Stage updated",
        description: "Company stage has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/target-companies', targetCompanyId] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/target-companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/pipeline/overview'] });
      setIsStageDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error updating stage",
        description: error.message || "Failed to update company stage",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UpdateStageFormValues) => {
    updateStageMutation.mutate(data);
  };

  // Get stage badge color based on stage name
  const getStageVariant = (stageName: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (stageName) {
      case 'New Target':
        return 'outline';
      case 'Initial Contact':
      case 'Documents Requested':
        return 'secondary';
      case 'Under Review':
      case 'Offer Stage':
      case 'Heads of Terms':
        return 'default';
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

  // Get stage progress percentage
  const getStageProgress = (stageName: string): number => {
    const stageOrder = stages?.find(s => s.stageName === stageName)?.stageOrder || 1;
    const maxOrder = Math.max(...(stages?.map(s => s.stageOrder) || [10]));
    return Math.round((stageOrder / maxOrder) * 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Pipeline Status
            </CardTitle>
            <CardDescription>
              Track {targetCompanyName} through the acquisition pipeline
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <History className="mr-2 h-4 w-4" />
                  History
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Stage History</DialogTitle>
                  <DialogDescription>
                    Complete history of stage changes for {targetCompanyName}
                  </DialogDescription>
                </DialogHeader>
                <div className="max-h-96 overflow-y-auto">
                  {historyLoading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center space-x-4 animate-pulse">
                          <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : stageHistory && stageHistory.length > 0 ? (
                    <div className="space-y-4">
                      {stageHistory.map((entry, index) => (
                        <div key={entry.id} className="flex items-start space-x-4 pb-4 border-b last:border-b-0">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              {entry.fromStage && (
                                <>
                                  <Badge variant="outline">{entry.fromStage}</Badge>
                                  <ArrowRight className="h-4 w-4 text-gray-400" />
                                </>
                              )}
                              <Badge variant={getStageVariant(entry.toStage)}>{entry.toStage}</Badge>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {formatDateTime(entry.changedAt)}
                            </p>
                            {entry.notes && (
                              <p className="text-sm text-gray-900 dark:text-gray-100 mt-2">
                                {entry.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No stage history available.
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isStageDialogOpen} onOpenChange={setIsStageDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Edit3 className="mr-2 h-4 w-4" />
                  Update Stage
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Update Pipeline Stage</DialogTitle>
                  <DialogDescription>
                    Move {targetCompanyName} to a different stage in the acquisition pipeline.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="stage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Stage</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {stages?.map((stage) => (
                                <SelectItem key={stage.id} value={stage.stageName}>
                                  {stage.stageName}
                                  {stage.description && (
                                    <span className="text-sm text-gray-500 block">
                                      {stage.description}
                                    </span>
                                  )}
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
                      <Button type="button" variant="outline" onClick={() => setIsStageDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={updateStageMutation.isPending}>
                        {updateStageMutation.isPending ? "Updating..." : "Update Stage"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Current Stage Display */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge variant={getStageVariant(currentStage)} className="text-sm">
                  {currentStage}
                </Badge>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="mr-1 h-4 w-4" />
                  {daysInStage} days in stage
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Last updated: {formatDate(stageUpdatedAt)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {getStageProgress(currentStage)}%
              </div>
              <p className="text-xs text-gray-500">Pipeline Progress</p>
            </div>
          </div>

          {/* Stage Progress Bar */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Pipeline Progress</span>
              <span className="text-sm text-gray-500">{getStageProgress(currentStage)}% Complete</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${getStageProgress(currentStage)}%` }}
              />
            </div>
          </div>

          {/* Stage Description */}
          {stages && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Current Stage:</strong>{' '}
                {stages.find(s => s.stageName === currentStage)?.description || currentStage}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}