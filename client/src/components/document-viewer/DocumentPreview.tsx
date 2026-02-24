import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { 
  Download, 
  FileText,
  AlertCircle,
  ExternalLink,
  Eye,
  Loader2
} from "lucide-react";
import type { Document } from "./types";
import mammoth from "mammoth";

type DocxStage = 'office' | 'mammoth' | 'failed';

interface DocumentPreviewProps {
  document: Document;
  onDownload: (documentId: number, filename: string) => void;
  publicFileBaseUrl?: string;
}

export function DocumentPreview({ document, onDownload, publicFileBaseUrl }: DocumentPreviewProps) {
  const [viewerError, setViewerError] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfLoadFailed, setPdfLoadFailed] = useState(false);
  const [docxStage, setDocxStage] = useState<DocxStage>('office');
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [docxLoading, setDocxLoading] = useState(false);
  const officeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPDF = document.fileType === 'application/pdf';
  const isImage = document.fileType.startsWith('image/');
  const isText = document.fileType === 'text/plain';
  const isDocx = document.fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || document.fileType === 'application/msword'
    || document.originalFilename?.toLowerCase().endsWith('.docx')
    || document.originalFilename?.toLowerCase().endsWith('.doc');
  const officeSpreadsheetTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  const officePresentationTypes = [
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];
  const isOtherOffice = officeSpreadsheetTypes.includes(document.fileType)
    || officePresentationTypes.includes(document.fileType);
  const isViewable = isPDF || isImage || isText || isDocx || isOtherOffice;

  const viewerUrl = publicFileBaseUrl
    ? `${publicFileBaseUrl}/${document.id}/view`
    : `/api/v2/files/${document.id}/view`;

  const downloadUrl = publicFileBaseUrl
    ? `${publicFileBaseUrl}/${document.id}/download`
    : `/api/v2/files/${document.id}/download`;

  const fullDownloadUrl = downloadUrl.startsWith('http')
    ? downloadUrl
    : `${window.location.origin}${downloadUrl}`;

  const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fullDownloadUrl)}`;

  const fallbackToMammoth = useCallback(() => {
    setDocxStage('mammoth');
    setDocxLoading(true);

    fetch(downloadUrl, { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        return res.arrayBuffer();
      })
      .then(arrayBuffer => mammoth.convertToHtml({ arrayBuffer }))
      .then(result => {
        setDocxHtml(result.value);
        setDocxLoading(false);
      })
      .catch(() => {
        setDocxStage('failed');
        setDocxLoading(false);
      });
  }, [downloadUrl]);

  useEffect(() => {
    setDocxStage('office');
    setDocxHtml(null);
    setDocxLoading(false);
    setPdfBlobUrl(null);
    setPdfLoading(false);
    setPdfLoadFailed(false);
    if (officeTimerRef.current) {
      clearTimeout(officeTimerRef.current);
      officeTimerRef.current = null;
    }
  }, [document.id]);

  useEffect(() => {
    if (!isPDF) return;
    let revoked = false;
    setPdfLoading(true);
    setPdfLoadFailed(false);

    const fetchUrl = publicFileBaseUrl
      ? `${publicFileBaseUrl}/${document.id}/view`
      : `/api/v2/files/${document.id}/view`;

    fetch(fetchUrl, { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        if (revoked) return;
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
        setPdfLoading(false);
      })
      .catch(() => {
        if (revoked) return;
        setPdfLoading(false);
        setPdfLoadFailed(true);
      });

    return () => {
      revoked = true;
      setPdfBlobUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [document.id, isPDF, publicFileBaseUrl]);

  useEffect(() => {
    return () => {
      if (officeTimerRef.current) {
        clearTimeout(officeTimerRef.current);
      }
    };
  }, []);

  const handleOfficeIframeLoad = useCallback(() => {
    if (officeTimerRef.current) {
      clearTimeout(officeTimerRef.current);
      officeTimerRef.current = null;
    }
  }, []);

  const handleOfficeIframeError = useCallback(() => {
    if (officeTimerRef.current) {
      clearTimeout(officeTimerRef.current);
      officeTimerRef.current = null;
    }
    fallbackToMammoth();
  }, [fallbackToMammoth]);

  const startOfficeTimeout = useCallback(() => {
    officeTimerRef.current = setTimeout(() => {
      fallbackToMammoth();
    }, 8000);
  }, [fallbackToMammoth]);

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
    if (pdfLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <h3 className="text-lg font-medium mb-2">Loading PDF...</h3>
          <p className="text-muted-foreground">Preparing document for viewing</p>
        </div>
      );
    }

    if (pdfLoadFailed || !pdfBlobUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <AlertCircle className="w-16 h-16 text-amber-500 mb-4" />
          <h3 className="text-lg font-medium mb-2">Unable to Load PDF</h3>
          <p className="text-muted-foreground mb-6">
            The PDF could not be loaded for inline viewing.
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
      );
    }

    return (
      <div className="h-full w-full rounded-lg overflow-hidden">
        <iframe
          src={`${pdfBlobUrl}#toolbar=1&navpanes=1&scrollbar=1&page=1&view=FitH`}
          className="w-full h-full border-0"
          title={document.documentName}
        />
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

  if (isDocx) {
    if (docxStage === 'office') {
      return (
        <div className="h-full w-full rounded-lg overflow-hidden relative">
          <iframe
            src={officeViewerUrl}
            className="w-full h-full border-0"
            title={document.documentName}
            onLoad={handleOfficeIframeLoad}
            onError={handleOfficeIframeError}
            ref={(el) => {
              if (el && !officeTimerRef.current) {
                startOfficeTimeout();
              }
            }}
          />
          <div className="absolute bottom-3 right-3 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="opacity-70 hover:opacity-100 text-xs"
              onClick={fallbackToMammoth}
            >
              Switch to Simple View
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="opacity-70 hover:opacity-100 text-xs"
              onClick={() => onDownload(document.id, document.originalFilename)}
            >
              <Download className="w-3 h-3 mr-1" />
              Download
            </Button>
          </div>
        </div>
      );
    }

    if (docxStage === 'mammoth') {
      if (docxLoading) {
        return (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <h3 className="text-lg font-medium mb-2">Loading Document...</h3>
            <p className="text-muted-foreground">Rendering document content</p>
          </div>
        );
      }

      if (docxHtml) {
        return (
          <div className="h-full w-full bg-white dark:bg-gray-900 rounded-lg overflow-auto">
            <div
              className="p-8 max-w-4xl mx-auto prose prose-sm dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: docxHtml }}
            />
          </div>
        );
      }
    }

    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <FileText className="w-16 h-16 text-amber-500 mb-4" />
        <h3 className="text-lg font-medium mb-2">Inline Preview Unavailable</h3>
        <p className="text-muted-foreground mb-6 max-w-md">
          This document format could not be rendered inline. It may be saved in an older format. Please download to view.
        </p>
        <Button onClick={() => onDownload(document.id, document.originalFilename)}>
          <Download className="w-4 h-4 mr-2" />
          Download to View
        </Button>
      </div>
    );
  }

  if (isOtherOffice) {
    const fileExt = document.originalFilename?.split('.').pop()?.toUpperCase() || 'Office';
    const otherOfficeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fullDownloadUrl)}`;
    return (
      <div className="h-full w-full rounded-lg overflow-hidden relative">
        <iframe
          src={otherOfficeViewerUrl}
          className="w-full h-full border-0"
          title={document.documentName}
        />
        <div className="absolute bottom-3 right-3">
          <Button
            size="sm"
            variant="secondary"
            className="opacity-70 hover:opacity-100 text-xs"
            onClick={() => onDownload(document.id, document.originalFilename)}
          >
            <Download className="w-3 h-3 mr-1" />
            Download {fileExt}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
