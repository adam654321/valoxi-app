import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Download, 
  FileText,
  AlertCircle,
  ExternalLink,
  Eye
} from "lucide-react";
import type { Document } from "./types";

interface DocumentPreviewProps {
  document: Document;
  onDownload: (documentId: number, filename: string) => void;
}

export function DocumentPreview({ document, onDownload }: DocumentPreviewProps) {
  const [viewerError, setViewerError] = useState(false);
  const [pdfLoadAttempted, setPdfLoadAttempted] = useState(false);

  const isPDF = document.fileType === 'application/pdf';
  const isImage = document.fileType.startsWith('image/');
  const isText = document.fileType === 'text/plain';
  const isViewable = isPDF || isImage || isText;

  const viewerUrl = `/api/v2/files/${document.id}/view`;

  const handleViewerLoad = () => {
    setViewerError(false);
  };

  const handleViewerError = () => {
    setViewerError(true);
  };

  const openInNewTab = () => {
    window.open(viewerUrl, '_blank');
  };

  if (!isViewable) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <FileText className="w-16 h-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Preview Not Available</h3>
        <p className="text-muted-foreground mb-4">
          This file type cannot be previewed in the browser.
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          File type: {document.fileType}
        </p>
        <Button onClick={() => onDownload(document.id, document.originalFilename)}>
          <Download className="w-4 h-4 mr-2" />
          Download to View
        </Button>
      </div>
    );
  }

  if (viewerError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <h3 className="text-lg font-medium mb-2">Unable to Load Document</h3>
        <p className="text-muted-foreground mb-6">
          There was an error loading the document preview.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setViewerError(false)}>
            Try Again
          </Button>
          <Button onClick={() => onDownload(document.id, document.originalFilename)}>
            <Download className="w-4 h-4 mr-2" />
            Download Instead
          </Button>
        </div>
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg">
        <img
          src={viewerUrl}
          alt={document.documentName}
          className="max-w-full max-h-full object-contain"
          onLoad={handleViewerLoad}
          onError={handleViewerError}
        />
      </div>
    );
  }

  if (isPDF) {
    return (
      <div className="h-full w-full rounded-lg overflow-hidden">
        {!pdfLoadAttempted ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <FileText className="w-16 h-16 text-blue-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">PDF Document Ready</h3>
            <p className="text-muted-foreground mb-6">
              This PDF document is ready to view. Choose your preferred viewing method below.
            </p>
            <div className="flex flex-col gap-3 w-full max-w-sm">
              <Button onClick={openInNewTab} className="w-full">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in New Tab (Recommended)
              </Button>
              <Button
                variant="outline"
                onClick={() => setPdfLoadAttempted(true)}
                className="w-full"
              >
                <Eye className="w-4 h-4 mr-2" />
                Try Inline Viewer
              </Button>
              <Button
                variant="outline"
                onClick={() => onDownload(document.id, document.originalFilename)}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Some browsers may block inline PDF viewing for security reasons
            </p>
          </div>
        ) : (
          <object
            data={`${viewerUrl}#toolbar=1&navpanes=1&scrollbar=1&page=1&view=FitH`}
            type="application/pdf"
            className="w-full h-full"
            onLoad={handleViewerLoad}
            onError={handleViewerError}
          >
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <AlertCircle className="w-16 h-16 text-amber-500 mb-4" />
              <h3 className="text-lg font-medium mb-2">PDF Viewer Blocked</h3>
              <p className="text-muted-foreground mb-4">
                Your browser is blocking the inline PDF viewer for security reasons.
              </p>
              <div className="flex gap-2">
                <Button onClick={openInNewTab}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in New Tab
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onDownload(document.id, document.originalFilename)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </object>
        )}
      </div>
    );
  }

  if (isText) {
    return (
      <div className="h-full w-full bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-auto">
        <iframe
          src={viewerUrl}
          className="w-full h-full border-0 bg-white dark:bg-gray-800 rounded"
          title={document.documentName}
          onLoad={handleViewerLoad}
          onError={handleViewerError}
        />
      </div>
    );
  }

  return null;
}
