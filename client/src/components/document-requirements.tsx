import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle, Clock, FileText, Users, Building2, Shield, HelpCircle, Star } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';



interface CompanyDocumentRequirement {
  id: number;
  targetCompanyId: number;
  requirementName: string;
  requirementDescription: string;
  documentCategory: string;
  collectionStage: number;
  priorityLevel: 'low' | 'medium' | 'high' | 'critical';
  isMandatory: boolean;
  submissionInstructions?: string;
  helpText?: string;
  displayOrder: number;
  requirementStatus: 'pending' | 'submitted' | 'approved' | 'rejected' | 'waived';
  submittedAt?: string;
  reviewedAt?: string;

  createdBy: number;
  createdAt: string;
  updatedAt?: string;
}

interface DocumentStageProgression {
  id: number;
  targetCompanyId: number;
  currentStage: number;
  stage1Status: 'locked' | 'active' | 'completed';
  stage2Status: 'locked' | 'active' | 'completed';
  stage1CompletedAt?: string;
  stage2CompletedAt?: string;
  createdBy: number;
  createdAt: string;
  updatedAt?: string;
}



interface DocumentRequirementsProps {
  targetCompanyId: number;
  companyName: string;
}

const priorityColors = {
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const statusColors = {
  pending: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  waived: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
};

const categoryIcons = {
  financial: FileText,
  legal: Shield,
  commercial: Building2,
  operational: Users,
  hr: Users,
  regulatory: Shield,
  tax: FileText,
};

export function DocumentRequirements({ targetCompanyId, companyName }: DocumentRequirementsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isInitializing, setIsInitializing] = useState(false);

  // Fetch company document requirements
  const { data: requirements = [], isLoading: requirementsLoading, refetch: refetchRequirements } = useQuery<CompanyDocumentRequirement[]>({
    queryKey: ['/api/companies', targetCompanyId, 'requirements'],
  });

  // Fetch stage progression
  const { data: stageProgression, isLoading: progressionLoading } = useQuery<DocumentStageProgression>({
    queryKey: ['/api/companies', targetCompanyId, 'stage-progression'],
  });

  // Initialize standardized requirements mutation
  const initializeRequirements = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/companies/${targetCompanyId}/requirements/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to initialize requirements');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Standardized document requirements have been initialized for this company.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/companies', targetCompanyId, 'requirements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/companies', targetCompanyId, 'stage-progression'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to initialize document requirements. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleInitialize = async () => {
    setIsInitializing(true);
    try {
      await initializeRequirements.mutateAsync();
    } finally {
      setIsInitializing(false);
    }
  };



  // Group requirements by stage and category
  const stage1Requirements = requirements.filter((req) => req.collectionStage === 1);
  const stage2Requirements = requirements.filter((req) => req.collectionStage === 2);

  const groupByCategory = (reqs: CompanyDocumentRequirement[]) => {
    return reqs.reduce((groups: Record<string, CompanyDocumentRequirement[]>, req) => {
      const category = req.documentCategory;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(req);
      return groups;
    }, {});
  };

  // Calculate completion percentages
  const calculateStageCompletion = (reqs: CompanyDocumentRequirement[]) => {
    if (reqs.length === 0) return 0;
    const completed = reqs.filter((req) => 
      req.requirementStatus === 'approved' || req.requirementStatus === 'waived'
    ).length;
    return Math.round((completed / reqs.length) * 100);
  };

  const stage1Completion = calculateStageCompletion(stage1Requirements);
  const stage2Completion = calculateStageCompletion(stage2Requirements);

  if (requirementsLoading || progressionLoading) {
    return (
      <Card data-testid="document-requirements-loading">
        <CardHeader>
          <CardTitle>Document Requirements</CardTitle>
          <CardDescription>Loading requirements system...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Show initialization interface if no requirements exist
  if (requirements.length === 0) {
    return (
      <Card data-testid="document-requirements-initialize">
        <CardHeader>
          <CardTitle>Initialize Document Requirements</CardTitle>
          <CardDescription>
            Set up standardized document collection requirements for {companyName}. This will apply our comprehensive 29-requirement checklist with two-stage collection process.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Standardized Requirements</h4>
              <p className="text-sm text-muted-foreground mb-3">
                This will initialize our comprehensive due diligence requirements system with:
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Stage 1</Badge>
                  <span className="text-muted-foreground">6 pre-offer requirements for initial evaluation</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Stage 2</Badge>
                  <span className="text-muted-foreground">23 comprehensive due diligence requirements</span>
                </div>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleInitialize} 
            disabled={isInitializing}
            className="w-full"
            data-testid="button-initialize-requirements"
          >
            {isInitializing ? 'Initializing...' : 'Initialize Standardized Requirements'}
          </Button>
        </CardContent>
      </Card>
    );
  }


  const RequirementCard = ({ requirement }: { requirement: CompanyDocumentRequirement }) => {
    const IconComponent = categoryIcons[requirement.documentCategory as keyof typeof categoryIcons] || FileText;
    
    return (
      <Card key={requirement.id} className="relative">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <IconComponent className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <CardTitle className="text-base flex items-center gap-2">
                  {requirement.requirementName}
                  {requirement.isMandatory && <Star className="h-4 w-4 text-amber-500" />}
                </CardTitle>
                <CardDescription className="mt-1">
                  {requirement.requirementDescription}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                className={priorityColors[requirement.priorityLevel]}
                data-testid={`priority-${requirement.priorityLevel}`}
              >
                {requirement.priorityLevel}
              </Badge>
              <Badge 
                className={statusColors[requirement.requirementStatus]}
                data-testid={`status-${requirement.requirementStatus}`}
              >
                {requirement.requirementStatus}
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {requirement.submissionInstructions && (
            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">Instructions:</p>
              <p className="text-sm text-blue-800 dark:text-blue-200">{requirement.submissionInstructions}</p>
            </div>
          )}
          
          {requirement.helpText && (
            <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900/20 rounded-md">
              <div className="flex items-center gap-2 mb-1">
                <HelpCircle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Help:</p>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">{requirement.helpText}</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {requirement.requirementStatus === 'pending' && (
                <>
                  <Button size="sm" variant="outline" data-testid={`button-submit-${requirement.id}`}>
                    Submit Document
                  </Button>

                </>
              )}

            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6" data-testid="document-requirements-main">
      {/* Stage Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Requirements Progress
          </CardTitle>
          <CardDescription>
            Track document collection progress across different stages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Stage 1: Initial Documents</span>
                <span className="text-sm text-muted-foreground">{stage1Completion}%</span>
              </div>
              <Progress value={stage1Completion} className="h-2" />
              <p className="text-sm text-muted-foreground">
                {stage1Requirements.filter(r => r.requirementStatus === 'approved').length} of {stage1Requirements.length} completed
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Stage 2: Post-Heads of Terms</span>
                <span className="text-sm text-muted-foreground">{stage2Completion}%</span>
              </div>
              <Progress value={stage2Completion} className="h-2" />
              <p className="text-sm text-muted-foreground">
                {stage2Requirements.filter(r => r.requirementStatus === 'approved').length} of {stage2Requirements.length} completed
              </p>
            </div>
          </div>

          {stageProgression && stageProgression.currentStage === 1 && stage1Completion < 100 && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Complete Stage 1 requirements before proceeding to Stage 2 documents.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Requirements by Stage */}
      <Tabs defaultValue="stage1" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="stage1" className="relative" data-testid="tab-stage1">
            Stage 1: Initial Documents
            {stageProgression?.stage1Status === 'completed' && (
              <CheckCircle className="h-4 w-4 ml-2 text-green-600" />
            )}
            {stageProgression?.stage1Status === 'active' && (
              <Clock className="h-4 w-4 ml-2 text-blue-600" />
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="stage2" 
            disabled={stageProgression?.stage2Status === 'locked'} 
            className="relative"
            data-testid="tab-stage2"
          >
            Stage 2: Post-Heads of Terms
            {stageProgression?.stage2Status === 'completed' && (
              <CheckCircle className="h-4 w-4 ml-2 text-green-600" />
            )}
            {stageProgression?.stage2Status === 'active' && (
              <Clock className="h-4 w-4 ml-2 text-blue-600" />
            )}
            {stageProgression?.stage2Status === 'locked' && (
              <Shield className="h-4 w-4 ml-2 text-gray-400" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stage1" className="space-y-6 mt-6">
          {Object.entries(groupByCategory(stage1Requirements)).map(([category, categoryRequirements]) => (
            <div key={category}>
              <h3 className="text-lg font-semibold mb-3 capitalize flex items-center gap-2">
                {(() => {
                  const IconComponent = categoryIcons[category as keyof typeof categoryIcons] || FileText;
                  return <IconComponent className="h-5 w-5" />;
                })()}
                {category} Documents
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {categoryRequirements.map((requirement) => (
                  <RequirementCard key={requirement.id} requirement={requirement} />
                ))}
              </div>
              <Separator className="mt-6" />
            </div>
          ))}
        </TabsContent>

        <TabsContent value="stage2" className="space-y-6 mt-6">
          {stageProgression?.stage2Status === 'locked' ? (
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Stage 2 requirements are locked until Stage 1 is completed and Heads of Terms are signed.
              </AlertDescription>
            </Alert>
          ) : (
            Object.entries(groupByCategory(stage2Requirements)).map(([category, categoryRequirements]) => (
              <div key={category}>
                <h3 className="text-lg font-semibold mb-3 capitalize flex items-center gap-2">
                  {(() => {
                    const IconComponent = categoryIcons[category as keyof typeof categoryIcons] || FileText;
                    return <IconComponent className="h-5 w-5" />;
                  })()}
                  {category} Documents
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {categoryRequirements.map((requirement) => (
                    <RequirementCard key={requirement.id} requirement={requirement} />
                  ))}
                </div>
                <Separator className="mt-6" />
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}