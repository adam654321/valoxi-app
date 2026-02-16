import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentManagement } from "@/components/document-management";
import DealDocumentsSummary from "@/components/deal-documents/DealDocumentsSummary";
import { DueDiligenceTab } from "@/components/target-company/DueDiligenceTab";
import { FileCheck, FileText, Shield } from "lucide-react";

interface DocumentsTabProps {
  companyId: string;
  targetCompanyId: number;
  companyName: string;
}

export function DocumentsTab({ companyId, targetCompanyId, companyName }: DocumentsTabProps) {
  return (
    <Tabs defaultValue="stage1" className="space-y-4">
      <TabsList className="h-9 bg-muted/50">
        <TabsTrigger value="stage1" className="text-xs gap-1.5 px-3">
          <FileText className="w-3.5 h-3.5" />
          Stage 1: Financial
        </TabsTrigger>
        <TabsTrigger value="stage2" className="text-xs gap-1.5 px-3">
          <FileCheck className="w-3.5 h-3.5" />
          Stage 2: Due Diligence
        </TabsTrigger>
        <TabsTrigger value="deal-documents" className="text-xs gap-1.5 px-3">
          <Shield className="w-3.5 h-3.5" />
          Deal Documents
        </TabsTrigger>
      </TabsList>

      <TabsContent value="stage1">
        <DocumentManagement targetCompanyId={targetCompanyId} companyName={companyName} />
      </TabsContent>

      <TabsContent value="stage2">
        <DueDiligenceTab targetCompanyId={targetCompanyId} />
      </TabsContent>

      <TabsContent value="deal-documents">
        <DealDocumentsSummary targetCompanyId={targetCompanyId} />
      </TabsContent>
    </Tabs>
  );
}
