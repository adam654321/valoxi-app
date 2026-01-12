# Gemini Stage 1 Analysis Implementation Guide

This document describes the implementation process for replacing external webhook calls with internal Google Gemini LLM API calls for Stage 1 document analysis.

## Overview

When all 10 required target company files are uploaded (5 Company Accounts + Asset Register, Balance Sheet, Profit & Loss, Sales Ledger, Staff Matrix), the system now calls the Google Gemini API directly instead of external webhooks.

## Changes Made

### 1. Installed Gemini AI Integration

Replit's built-in Gemini AI integration was installed, which provides:
- Access to `gemini-3-flash-preview` model
- No API key required (billed to Replit credits)
- Automatic secret management via environment variables:
  - `AI_INTEGRATIONS_GEMINI_BASE_URL`
  - `AI_INTEGRATIONS_GEMINI_API_KEY`

**Files created by integration:**
- `server/replit_integrations/batch/` - Batch processing utilities
- `server/replit_integrations/chat/` - Chat functionality (optional)
- `server/replit_integrations/image/` - Image generation (optional)
- `shared/models/chat.ts` - Chat data models (optional)

### 2. Created Prompt Template

**File:** `server/prompts/stage1-analysis-prompt.ts`

Contains the Commercial Due Diligence prompt template with:
- Role definition (Senior Commercial Due Diligence Analyst)
- Analysis rules for financial data
- Markdown output format specification
- Placeholders: `{{company_name}}` and `{{sector}}`

**Key function:**
```typescript
buildStage1Prompt(companyName: string, sector: string): string
```

### 3. Created Gemini Analysis Service

**File:** `server/gemini-stage1-service.ts`

Contains:
- `GoogleGenAI` client configuration using Replit AI Integrations
- `runStage1GeminiAnalysis()` - Main analysis function
- `getMimeTypeForFile()` - MIME type helper

**Request format:**
```typescript
interface Stage1AnalysisRequest {
  companyName: string;
  sector: string;
  files: FileInfo[];  // Array of {fileUrl, mimeType, category}
}
```

**Gemini API payload structure:**
```typescript
{
  model: "gemini-3-flash-preview",
  contents: [{
    role: "user",
    parts: [
      { file_data: { mime_type: "...", file_uri: "..." } },
      // ... more file_data parts for each document
      { text: "<PROMPT>" }
    ]
  }],
  config: { temperature: 0 }
}
```

### 4. Added Document File URL Retrieval

**File:** `server/storage.ts`

**Interface addition:**
```typescript
getStage1DocumentFiles(targetCompanyId: number): Promise<{ fileUrl: string; mimeType: string; category: string }[]>
```

**Implementation:**
- Queries documents table for required categories
- Returns file paths (URLs), types, and categories

### 5. Modified Analysis Trigger Function

**File:** `server/routes.ts`

**Changes to `checkAndTriggerStage1Analysis()`:**
- Removed calls to `sendStage1AnalysisWebhook()` and `sendDetailedAnalysisWebhook()`
- Added call to new `runGeminiStage1Analysis()` function

**New function `runGeminiStage1Analysis()`:**
1. Gets document files from storage
2. Converts to FileInfo format
3. Calls Gemini analysis service
4. Stores markdown response in database
5. Sends SSE notification to connected clients

## Environment Variables

The following environment variables are automatically configured:
- `AI_INTEGRATIONS_GEMINI_BASE_URL` - Gemini API base URL
- `AI_INTEGRATIONS_GEMINI_API_KEY` - API key (managed by Replit)

## Detailed Analysis (Future)

The detailed analysis webhook (`sendDetailedAnalysisWebhook()`) has been removed from the automatic trigger. This will be implemented as an on-demand feature in a future update.

## Testing

To test the implementation:
1. Upload all 10 required documents for a target company:
   - 5 Company Accounts files
   - 1 Asset Register file
   - 1 Balance Sheet file
   - 1 Profit & Loss file
   - 1 Sales Ledger file
   - 1 Staff Matrix file
2. The analysis should automatically trigger
3. Check logs for `[GEMINI_STAGE1_ANALYSIS]` messages
4. Verify the markdown response is stored in `stage1_analysis_events` table

## Replicating in Another App

To replicate this implementation:

1. **Install Gemini Integration:**
   - Use Replit's integration installer for "Gemini AI"
   - This sets up environment variables automatically

2. **Copy these files:**
   - `server/prompts/stage1-analysis-prompt.ts`
   - `server/gemini-stage1-service.ts`

3. **Add storage function:**
   - Add `getStage1DocumentFiles()` to your storage interface and implementation

4. **Modify trigger function:**
   - Update your document upload trigger to call the Gemini service
   - Store the markdown response appropriately

5. **Ensure document URLs are accessible:**
   - Gemini needs public URLs to access the documents
   - If using private storage, generate signed URLs
