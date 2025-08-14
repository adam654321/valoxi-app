import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Download, 
  X, 
  FileText,
  Image as ImageIcon,
  AlertCircle,
  ExternalLink
} from "lucide-react";

interface Document {
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

interface DocumentViewerProps {
  document: Document | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (documentId: number, filename: string) => void;
}

export function DocumentViewer({ document, isOpen, onClose, onDownload }: DocumentViewerProps) {
  const { toast } = useToast();
  const [viewerError, setViewerError] = useState(false);

  if (!document) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isPDF = document.fileType === 'application/pdf';
  const isImage = document.fileType.startsWith('image/');
  const isText = document.fileType === 'text/plain';
  const isViewable = isPDF || isImage || isText;

  const viewerUrl = `/api/documents/${document.id}/view`;
  const downloadUrl = `/api/documents/${document.id}/download`;

  const handleViewerLoad = () => {
    setViewerError(false);
  };

  const handleViewerError = () => {
    setViewerError(true);
    toast({
      title: "Viewer Error",
      description: "Unable to display this document. You can still download it.",
      variant: "destructive",
    });
  };

  const openInNewTab = () => {
    window.open(viewerUrl, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-lg">{document.documentName}</DialogTitle>
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <span>{document.originalFilename}</span>
                <span>•</span>
                <span>{formatFileSize(document.fileSize)}</span>
                <span>•</span>
                <Badge variant="secondary" className="text-xs">
                  {document.documentCategory}
                </Badge>
                {document.isConfidential && (
                  <Badge variant="destructive" className="text-xs">
                    Confidential
                  </Badge>
                )}
              </div>
              {document.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {document.description}
                </p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>Uploaded by {document.uploadedByName}</span>
                <span>•</span>
                <span>{formatDate(document.uploadDate)}</span>
                <span>•</span>
                <span>{document.accessCount} views</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload(document.id, document.originalFilename)}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              {isViewable && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openInNewTab}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in New Tab
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {!isViewable ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <FileText className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Preview Not Available</h3>
              <p className="text-muted-foreground mb-4">
                This file type cannot be previewed in the browser.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                File type: {document.fileType}
              </p>
              <Button
                onClick={() => onDownload(document.id, document.originalFilename)}
              >
                <Download className="w-4 h-4 mr-2" />
                Download to View
              </Button>
            </div>
          ) : viewerError ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <AlertCircle className="w-16 h-16 text-destructive mb-4" />
              <h3 className="text-lg font-medium mb-2">Unable to Load Document</h3>
              <p className="text-muted-foreground mb-6">
                There was an error loading the document preview.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setViewerError(false)}
                >
                  Try Again
                </Button>
                <Button
                  onClick={() => onDownload(document.id, document.originalFilename)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Instead
                </Button>
              </div>
            </div>
          ) : isImage ? (
            <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg">
              <img
                src={viewerUrl}
                alt={document.documentName}
                className="max-w-full max-h-full object-contain"
                onLoad={handleViewerLoad}
                onError={handleViewerError}
              />
            </div>
          ) : isPDF ? (
            <div className="h-full w-full rounded-lg overflow-hidden">
              <iframe
                src={`${viewerUrl}#toolbar=1&navpanes=1&scrollbar=1&page=1&view=FitH`}
                className="w-full h-full border-0"
                title={document.documentName}
                onLoad={handleViewerLoad}
                onError={handleViewerError}
              />
            </div>
          ) : isText ? (
            <div className="h-full w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-auto">
              <iframe
                src={viewerUrl}
                className="w-full h-full border-0 bg-white dark:bg-gray-800 rounded"
                title={document.documentName}
                onLoad={handleViewerLoad}
                onError={handleViewerError}
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}