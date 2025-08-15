import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, ArrowLeft, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";

const requirementItemSchema = z.object({
  requirementName: z.string().min(1, "Requirement name is required"),
  requirementDescription: z.string().min(1, "Description is required"),
  documentCategory: z.string().min(1, "Document category is required"),
  collectionStage: z.number().min(1, "Collection stage is required").max(2, "Stage must be 1 or 2"),
  priorityLevel: z.enum(["low", "medium", "high", "critical"]),
  isMandatory: z.boolean().default(true),
  submissionInstructions: z.string().optional(),
  helpText: z.string().optional(),
});

type RequirementItemFormData = z.infer<typeof requirementItemSchema>;

interface RequirementItem {
  id: number;
  templateId: number;
  requirementName: string;
  requirementDescription: string;
  documentCategory: string;
  collectionStage: number;
  priorityLevel: string;
  isMandatory: boolean;
  displayOrder: number;
  submissionInstructions?: string;
  helpText?: string;
}

interface Template {
  id: number;
  templateName: string;
  templateDescription: string;
  industryCategory: string;
  dealSizeCategory: string;
}

export default function TemplateRequirements() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const templateId = parseInt(params.templateId || "0");
  const [selectedItem, setSelectedItem] = useState<RequirementItem | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [expandedStages, setExpandedStages] = useState<{[key: number]: boolean}>({ 1: true, 2: true });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: template, isLoading: templateLoading } = useQuery<Template>({
    queryKey: ['/api/document-requirements/templates', templateId],
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery<RequirementItem[]>({
    queryKey: ['/api/document-requirements/templates', templateId, 'items'],
  });

  const createItemMutation = useMutation({
    mutationFn: (data: RequirementItemFormData) => 
      apiRequest(`/api/document-requirements/templates/${templateId}/items`, 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/document-requirements/templates', templateId, 'items'] });
      toast({ title: "Success", description: "Requirement item created successfully" });
      setIsCreateDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create requirement item", variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: RequirementItemFormData }) => 
      apiRequest(`/api/document-requirements/templates/${templateId}/items/${id}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/document-requirements/templates', templateId, 'items'] });
      toast({ title: "Success", description: "Requirement item updated successfully" });
      setIsEditDialogOpen(false);
      setSelectedItem(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update requirement item", variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/document-requirements/templates/${templateId}/items/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/document-requirements/templates', templateId, 'items'] });
      toast({ title: "Success", description: "Requirement item deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete requirement item", variant: "destructive" });
    },
  });

  const createForm = useForm<RequirementItemFormData>({
    resolver: zodResolver(requirementItemSchema),
    defaultValues: {
      requirementName: "",
      requirementDescription: "",
      documentCategory: "",
      collectionStage: 1,
      priorityLevel: "medium",
      isMandatory: true,
      submissionInstructions: "",
      helpText: "",
    },
  });

  const editForm = useForm<RequirementItemFormData>({
    resolver: zodResolver(requirementItemSchema),
  });

  const handleCreateSubmit = (data: RequirementItemFormData) => {
    createItemMutation.mutate(data);
  };

  const handleEditSubmit = (data: RequirementItemFormData) => {
    if (selectedItem) {
      updateItemMutation.mutate({ id: selectedItem.id, data });
    }
  };

  const handleEdit = (item: RequirementItem) => {
    setSelectedItem(item);
    editForm.reset({
      requirementName: item.requirementName,
      requirementDescription: item.requirementDescription,
      documentCategory: item.documentCategory,
      collectionStage: item.collectionStage,
      priorityLevel: item.priorityLevel as any,
      isMandatory: item.isMandatory,
      submissionInstructions: item.submissionInstructions || "",
      helpText: item.helpText || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (item: RequirementItem) => {
    if (confirm(`Are you sure you want to delete "${item.requirementName}"? This action cannot be undone.`)) {
      deleteItemMutation.mutate(item.id);
    }
  };

  const toggleStageExpansion = (stage: number) => {
    setExpandedStages(prev => ({
      ...prev,
      [stage]: !prev[stage]
    }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const documentCategories = [
    "Financial", "Legal", "Technical", "Commercial", "HR", "Operations", "Quality", "Other"
  ];

  const priorityLevels = [
    { value: "low", label: "Low Priority" },
    { value: "medium", label: "Medium Priority" },
    { value: "high", label: "High Priority" },
    { value: "critical", label: "Critical" },
  ];

  // Group items by stage
  const itemsByStage = items.reduce((acc, item) => {
    if (!acc[item.collectionStage]) {
      acc[item.collectionStage] = [];
    }
    acc[item.collectionStage].push(item);
    return acc;
  }, {} as Record<number, RequirementItem[]>);

  // Sort items by display order within each stage
  Object.keys(itemsByStage).forEach(stage => {
    itemsByStage[parseInt(stage)].sort((a, b) => a.displayOrder - b.displayOrder);
  });

  if (templateLoading || itemsLoading) {
    return <div data-testid="loading-requirements">Loading template requirements...</div>;
  }

  if (!template) {
    return <div data-testid="error-template-not-found">Template not found</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          onClick={() => setLocation('/templates')}
          data-testid="button-back-to-templates"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Templates
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold" data-testid="text-template-name">{template.templateName}</h1>
          <p className="text-muted-foreground" data-testid="text-template-description">{template.templateDescription}</p>
          <div className="flex gap-2 mt-2">
            <Badge variant="outline" data-testid="text-industry">{template.industryCategory}</Badge>
            <Badge variant="outline" data-testid="text-deal-size">{template.dealSizeCategory}</Badge>
          </div>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-requirement">
              <Plus className="h-4 w-4 mr-2" />
              Add Requirement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Requirement</DialogTitle>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="requirementName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requirement Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Financial Statements (3 Years)" data-testid="input-requirement-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="requirementDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Describe what documents are needed..." data-testid="input-requirement-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="documentCategory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Document Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-document-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {documentCategories.map(category => (
                              <SelectItem key={category} value={category}>{category}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="collectionStage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Collection Stage</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value.toString()}>
                          <FormControl>
                            <SelectTrigger data-testid="select-collection-stage">
                              <SelectValue placeholder="Select stage" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">Stage 1 - Initial Review</SelectItem>
                            <SelectItem value="2">Stage 2 - Due Diligence</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="priorityLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority Level</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-priority-level">
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {priorityLevels.map(level => (
                              <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="isMandatory"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-y-0 space-x-2 pt-7">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-mandatory" />
                        </FormControl>
                        <FormLabel>Mandatory Requirement</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={createForm.control}
                  name="submissionInstructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Submission Instructions (Optional)</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Provide specific instructions for document submission..." data-testid="input-submission-instructions" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="helpText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Help Text (Optional)</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Additional help or context for users..." data-testid="input-help-text" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createItemMutation.isPending} data-testid="button-save-requirement">
                    {createItemMutation.isPending ? "Creating..." : "Create Requirement"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Requirements by Stage */}
      <div className="space-y-6">
        {[1, 2].map(stageNumber => (
          <Card key={stageNumber}>
            <CardHeader 
              className="cursor-pointer"
              onClick={() => toggleStageExpansion(stageNumber)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {expandedStages[stageNumber] ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  Stage {stageNumber} - {stageNumber === 1 ? 'Initial Review' : 'Due Diligence'}
                  <Badge variant="outline" data-testid={`text-stage-${stageNumber}-count`}>
                    {itemsByStage[stageNumber]?.length || 0} requirements
                  </Badge>
                </CardTitle>
              </div>
            </CardHeader>
            {expandedStages[stageNumber] && (
              <CardContent>
                {itemsByStage[stageNumber]?.length > 0 ? (
                  <div className="space-y-4">
                    {itemsByStage[stageNumber].map((item, index) => (
                      <div key={item.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                              <h4 className="font-medium" data-testid={`text-requirement-name-${item.id}`}>
                                {item.requirementName}
                              </h4>
                              <Badge variant={getPriorityColor(item.priorityLevel) as any} data-testid={`badge-priority-${item.id}`}>
                                {item.priorityLevel}
                              </Badge>
                              {item.isMandatory && <Badge variant="destructive">Required</Badge>}
                              <Badge variant="outline" data-testid={`badge-category-${item.id}`}>
                                {item.documentCategory}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2" data-testid={`text-requirement-description-${item.id}`}>
                              {item.requirementDescription}
                            </p>
                            {item.submissionInstructions && (
                              <div className="text-sm mb-2">
                                <span className="font-medium">Instructions:</span> {item.submissionInstructions}
                              </div>
                            )}
                            {item.helpText && (
                              <div className="text-sm text-muted-foreground">
                                <span className="font-medium">Help:</span> {item.helpText}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1 ml-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(item)}
                              data-testid={`button-edit-requirement-${item.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(item)}
                              data-testid={`button-delete-requirement-${item.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No requirements defined for Stage {stageNumber}</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => {
                        createForm.setValue("collectionStage", stageNumber);
                        setIsCreateDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Requirement
                    </Button>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Requirement</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="requirementName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Requirement Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Financial Statements (3 Years)" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="requirementDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Describe what documents are needed..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="documentCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {documentCategories.map(category => (
                            <SelectItem key={category} value={category}>{category}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="collectionStage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Collection Stage</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select stage" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">Stage 1 - Initial Review</SelectItem>
                          <SelectItem value="2">Stage 2 - Due Diligence</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="priorityLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority Level</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {priorityLevels.map(level => (
                            <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="isMandatory"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-y-0 space-x-2 pt-7">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel>Mandatory Requirement</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="submissionInstructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Submission Instructions (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Provide specific instructions for document submission..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="helpText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Help Text (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Additional help or context for users..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateItemMutation.isPending}>
                  {updateItemMutation.isPending ? "Updating..." : "Update Requirement"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {items.length === 0 && (
        <div className="text-center py-12">
          <div className="text-lg font-medium mb-2">No Requirements Defined</div>
          <p className="text-muted-foreground mb-4">
            Start building this template by adding document requirements for Stage 1 and Stage 2.
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Requirement
          </Button>
        </div>
      )}
    </div>
  );
}