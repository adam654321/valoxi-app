export interface Document {
  id: number;
  targetCompanyId: number;
  uploadedBy: number;
  documentName: string;
  originalFilename: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  documentCategory: string;
  description: string;
  isConfidential: boolean;
  uploadDate: string;
  lastAccessed: string | null;
  accessCount: number;
  createdAt: string;
  uploadedByName: string;
  categoryDescription?: string;
}

export interface DocumentAnalysisResult {
  id: number;
  documentId: number;
  fileUploadEventId: number;
  documentType: string;
  analysisData: any;
  processingTime?: number;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    thoughtsTokenCount?: number;
    promptTokensDetails?: Array<{ modality: string; tokenCount: number }>;
  };
  createdAt: string;
}

export interface DocumentViewerProps {
  document: Document | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (documentId: number, filename: string) => void;
  publicFileBaseUrl?: string;
}
