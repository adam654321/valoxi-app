import { DocumentManagement } from "@/components/document-management";

interface DocumentsTabProps {
  targetCompanyId: number;
  companyName: string;
}

export function DocumentsTab({ targetCompanyId, companyName }: DocumentsTabProps) {
  return (
    <DocumentManagement 
      targetCompanyId={targetCompanyId}
      companyName={companyName}
    />
  );
}
