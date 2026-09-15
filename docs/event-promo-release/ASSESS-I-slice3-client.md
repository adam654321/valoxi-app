# Slice 3 client assessment

## Step 1 — Where the offer price is computed and rendered

```text
rg -n "localCalcs" client/src/components/deal-modeller/ValuationSection.tsx | head -30
216:  const localCalcs = useMemo<CalculationResult | null>(() => {
280:  const ev = localCalcs?.enterpriseValue ?? 0;
281:  const offerPrice = localCalcs?.offerPrice ?? 0;
282:  const avgEbitda = localCalcs?.averageAdjustedEbitda ?? 0;
283:  const receivablesInterestAnnual = localCalcs?.receivablesInterestAnnual ?? 0;
284:  const valuationEbitda = localCalcs?.valuationEbitda ?? avgEbitda;
286:    ? (localCalcs?.impliedMultiple ?? null)
496:                  {localCalcs?.impliedMultiple != null
497:                    ? `${localCalcs.impliedMultiple.toFixed(2)}x (implied)`

sed -n '205,235p' client/src/components/deal-modeller/ValuationSection.tsx
      assetBaseValue: f.assetBaseValue,
      ltvPercent: f.ltvPercent,
      amountUsed: f.amountUsed,
      interestRate: f.interestRate,
      termMonths: f.termMonths,
      arrangementFeePercent: null,
      isActive: f.isActive ?? false,
    })),
    [model.fundingLines]
  );

  const localCalcs = useMemo<CalculationResult | null>(() => {
    if (Object.keys(reportedEbitdaByYear).length === 0) return parentCalcs;
    const modelInput = buildModelInput(local, model);
    return calculateFullDealModel(reportedEbitdaByYear, adjustmentInputs, fundingInputs, modelInput);
  }, [local, reportedEbitdaByYear, adjustmentInputs, fundingInputs, model, parentCalcs]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const res = await apiRequest('PUT', `/api/v2/deal-models/${modelId}`, updates);
      return res.json();
    },
    onSuccess: () => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
      savePendingRef.current = false;
      if (!isEditingRef.current) {
        onDataChange();
      }
    },
    onError: (error: Error) => {

rg -n "offerPrice|Offer Price|Offer price" client/src/components/deal-modeller/ValuationSection.tsx | head -30
281:  const offerPrice = localCalcs?.offerPrice ?? 0;
516:                        : String(Math.round(offerPrice)))}
520:                    const seed = local.offerDriver === 'target_price' ? local.targetOfferPrice : offerPrice;
863:              <span className="text-base font-semibold">Offer Price</span>
864:              <span className="font-bold text-xl">{formatCurrency(offerPrice)}</span>

sed -n '845,872p' client/src/components/deal-modeller/ValuationSection.tsx
                            }}
                            disabled={isLocked}
                            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                          >
                            ← Use auto-calculation
                          </button>
                          <span className="text-xs text-muted-foreground">
                            Auto would be: {formatCurrency(calculatedTotal)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center justify-between px-4 py-3 bg-primary/5">
              <span className="text-base font-semibold">Offer Price</span>
              <span className="font-bold text-xl">{formatCurrency(offerPrice)}</span>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}

rg -c "" client/src/components/deal-modeller/ValuationSection.tsx
872
```

## Step 2 — Whether the screen knows about eligible years

```text
rg -n "reportedEbitda|eligibleYear|provisional|isProvisional" client/src/components/deal-modeller --glob "*.tsx" | head -20
client/src/components/deal-modeller/ValuationSection.tsx:44:  reportedEbitdaByYear: Record<string, number>;
client/src/components/deal-modeller/ValuationSection.tsx:127:  reportedEbitdaByYear,
client/src/components/deal-modeller/ValuationSection.tsx:217:    if (Object.keys(reportedEbitdaByYear).length === 0) return parentCalcs;
client/src/components/deal-modeller/ValuationSection.tsx:219:    return calculateFullDealModel(reportedEbitdaByYear, adjustmentInputs, fundingInputs, modelInput);
client/src/components/deal-modeller/ValuationSection.tsx:220:  }, [local, reportedEbitdaByYear, adjustmentInputs, fundingInputs, model, parentCalcs]);

rg -n "reportedEbitda|isProvisional" server/routes/deal-model.routes.ts | head -20
```

The client already receives `reportedEbitdaByYear`; an empty object tells `ValuationSection` that the company has no valuation-eligible year.

## Step 3 — Where sending happens in the client

```text
rg -ln "send-offer|/send|sendDocument|sendOffer" client/src --glob "*.tsx" | sort
client/src/components/dashboard/pending-send-widget.tsx
client/src/components/deal-documents/DealDocumentsSummary.tsx
client/src/components/target-company/DealModeller.tsx
client/src/lib/send-result-toast.tsx
client/src/pages/admin/broadcasts.tsx
client/src/pages/file-upload-test.tsx
client/src/pages/PortalManagement.tsx

rg -n -C 3 "send-offer|/send|sendDocument|sendOffer" client/src/components/dashboard/pending-send-widget.tsx | head -30
7-import { apiRequest, queryClient } from "@/lib/queryClient";
8-import { useToast } from "@/hooks/use-toast";
9-import { useServerConfig } from "@/hooks/useServerConfig";
10:import { handleSendResult } from "@/lib/send-result-toast";
11-
12-interface PendingDoc {
13-  id: number;
--
35-
36-  const sendMutation = useMutation({
37-    mutationFn: async (docId: number) => {
38:      const res = await apiRequest('POST', `/api/v2/deal-documents/${docId}/send`, {});
39-      return res.json();
40-    },
41-    onSuccess: (data) => {

rg -n -C 3 "send-offer|/send|sendDocument|sendOffer" client/src/components/deal-documents/DealDocumentsSummary.tsx | head -30
22-import { apiRequest, queryClient } from '@/lib/queryClient';
23-import { useToast } from '@/hooks/use-toast';
24-import { useServerConfig } from '@/hooks/useServerConfig';
25:import { handleSendResult } from '@/lib/send-result-toast';
26-
27-interface DocumentResponse {
28-  id: number;
--
119-
120-  const latestDealModelId: number | undefined = dealModelsData?.data?.[0]?.id;
121-
122:  const sendOfferPortalMutation = useMutation({
123-    mutationFn: async () => {
124-      // Wait for any in-flight model saves to settle before generating the offer.
125-      const deadline = Date.now() + 2500;
--
127-        await new Promise(resolve => setTimeout(resolve, 80));
128-      }
129-
130:      const res = await apiRequest('POST', '/api/v2/deal-documents/send-offer', {
131-        targetCompanyId,
132-        dealModelId: latestDealModelId,
133-      });
--
151-      const genData = await genRes.json();
152-      const docId = genData?.id ?? genData?.data?.id;
153-      if (!docId) throw new Error('Failed to generate HoT');
154:      const sendRes = await apiRequest('POST', `/api/v2/deal-documents/${docId}/send`, {});
155-      return sendRes.json();
156-    },

rg -n -C 3 "send-offer|/send|sendDocument|sendOffer" client/src/components/target-company/DealModeller.tsx | head -30
10-import { useToast } from '@/hooks/use-toast';
11-import { useServerConfig } from '@/hooks/useServerConfig';
12-import { apiRequest, queryClient } from '@/lib/queryClient';
13:import { handleSendResult } from '@/lib/send-result-toast';
14-import { isPartYearPeriod } from '@/lib/period-utils';
15-import {
16-  calculateFullDealModel,
--
485-    },
486-  });
487-
488:  const sendOfferMutation = useMutation({
489-    mutationFn: async () => {
490-      // Wait for any in-flight model saves (debounced fields) to complete before
491-      // generating the offer — ensures the server reads the latest model state.
--
494-        await new Promise(resolve => setTimeout(resolve, 80));
495-      }
496-
497:      const res = await apiRequest('POST', '/api/v2/deal-documents/send-offer', {
498-        targetCompanyId: companyId,
499-        dealModelId: selectedModelId,
500-      });
--
678-                    <Button
679-                      variant="default"
680-                      size="sm"
681:                      disabled={sendOfferMutation.isPending}
682-                      className="bg-green-600 hover:bg-green-700"
683-                    >

rg -n -C 3 "send-offer|/send|sendDocument|sendOffer" client/src/lib/send-result-toast.tsx | head -30
12-/**
13- * Surfaces the post-send banner per D25.11.
14- * Reads sendResult from either response shape:
15: *   - wrapped via sendSuccess/sendCreated: data.data.sendResult
16- *   - bare res.json(): data.sendResult
17- * Emits a Nylas success toast with the From address,
18- * or a Resend fallback toast with the connect-email banner.

rg -n -C 3 "send-offer|/send|sendDocument|sendOffer" client/src/pages/admin/broadcasts.tsx | head -30
61-
62-  const sendMutation = useMutation({
63-    mutationFn: async (payload: { isTest: boolean }) => {
64:      const res = await apiRequest("POST", "/api/v2/admin/broadcasts/send", {
65-        subject,
66-        bodyMarkdown,
67-        segmentKey,

rg -n -C 3 "send-offer|/send|sendDocument|sendOffer" client/src/pages/file-upload-test.tsx | head -30
69-  // Send webhook for file upload event
70-  const sendWebhookMutation = useMutation({
71-    mutationFn: async (eventId: number) => {
72:      const response = await apiRequest("POST", `/api/file-upload-events/${eventId}/send-webhook`);
73-      return response.json();
74-    },
75-    onSuccess: (data) => {

rg -n -C 3 "send-offer|/send|sendDocument|sendOffer" client/src/pages/PortalManagement.tsx | head -30
11-import { Checkbox } from '@/components/ui/checkbox';
12-import { ExternalLink, Users, FileText, Clock, Mail, Plus, ChevronRight, ArrowLeft, Building2, AlertTriangle, TimerOff, CalendarPlus, RefreshCw } from 'lucide-react';
13-import { apiRequest } from '@/lib/queryClient';
14:import { handleSendResult } from '@/lib/send-result-toast';
15-
16-interface TargetCompany {
17-  id: number;
```

`client/src/components/target-company/DealModeller.tsx` owns the primary `Send Offer` button pressed by a user to send an offer to the seller. `DealDocumentsSummary.tsx` also owns a separate `Send via Portal` button.

## Step 4 — Confirm-dialog convention

```text
ls client/src/components/ui | sort
accordion.tsx
alert-dialog.tsx
alert.tsx
aspect-ratio.tsx
avatar.tsx
badge.tsx
breadcrumb.tsx
button.tsx
calendar.tsx
card.tsx
carousel.tsx
chart.tsx
checkbox.tsx
collapsible.tsx
command.tsx
context-menu.tsx
dialog.tsx
drawer.tsx
dropdown-menu.tsx
empty-state.tsx
form.tsx
hover-card.tsx
input-otp.tsx
input.tsx
label.tsx
menubar.tsx
navigation-menu.tsx
pagination.tsx
popover.tsx
progress.tsx
radio-group.tsx
resizable.tsx
scroll-area.tsx
select.tsx
separator.tsx
sheet.tsx
sidebar.tsx
skeleton.tsx
slider.tsx
switch.tsx
table.tsx
tabs.tsx
textarea.tsx
toaster.tsx
toast.tsx
toggle-group.tsx
toggle.tsx
tooltip.tsx

rg -ln "AlertDialog" client/src --glob "*.tsx" | head -10
client/src/components/document-management.tsx
client/src/pages/billing.tsx
client/src/components/enhanced-portal-display.tsx
client/src/pages/team-management.tsx
client/src/pages/enhanced-target-companies.tsx
client/src/components/settings/connected-accounts-section.tsx
client/src/components/deal-team-management.tsx
client/src/components/portal/HoTReview.tsx
client/src/components/target-companies/delete-company-dialog.tsx
client/src/components/portal/OfferReview.tsx

sed -n '35,84p' client/src/components/target-companies/delete-company-dialog.tsx
    }
  };

  const handleConfirm = () => {
    if (company && confirmText === "DELETE") {
      onConfirm(company.id);
      setConfirmText("");
    }
  };

  return (
    <AlertDialog open={!!company} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">Delete company</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <span className="block">
              You are about to permanently delete <strong>{company?.companyName}</strong> and all associated data including contacts, documents, activities, deal documents, and financial data.
            </span>
            <span className="block font-medium text-foreground">
              This cannot be undone.
            </span>
            <span className="block">
              Type <strong>DELETE</strong> to confirm.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
          placeholder="Type DELETE to confirm"
          className="mt-2"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && confirmText === 'DELETE') handleConfirm();
          }}
        />
        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={confirmText !== "DELETE" || isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Delete permanently
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
```

## Step 5 — Route file for the new endpoint

```text
rg -n "router.post\('/:id/send'" server/routes/deal-document.routes.ts
474:router.post('/:id/send', requirePermission('canCreateOffers'), asyncHandler(async (req, res) => {

sed -n '474,484p' server/routes/deal-document.routes.ts
router.post('/:id/send', requirePermission('canCreateOffers'), asyncHandler(async (req, res) => {
  const userCompanyId = req.session.userCompanyId;
  const userId = req.session.userId;
  if (!userCompanyId || !userId) return res.status(401).json({ message: 'Unauthorized' });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid document ID' });
  const existing = await dealDocumentService.getDocumentById(id);
  if (!existing || existing.userCompanyId !== userCompanyId) return res.status(404).json({ message: 'Document not found' });
  const result = await dealDocumentService.sendDocument(id, userId);
  res.json(result);
}));

rg -n "^import" server/routes/deal-document.routes.ts | head -20
1:import { Router, Request, Response } from 'express';
2:import { dealDocumentService } from '../services/deal-document.service';
3:import { z } from 'zod';
4:import { asyncHandler } from '../utils/async-handler';
5:import { db } from '../db';
6:import { eq, and, isNotNull, desc } from 'drizzle-orm';
7:import { dealDocuments } from '@shared/schema/deal-documents';
8:import { targetCompanies } from '@shared/schema/deals';
9:import { sendSuccess } from '../utils/response';
10:import { UnauthorizedError } from '../utils/errors';
11:import { requirePermission } from '../middleware/auth';
12:import { buildNdaHtml, buildOfferLetterHtml, buildHoTHtml, buildSignatureBlock, buildPhysicalSignatureBlock } from '../utils/document-html-builders';
13:import { isOfferPriceSupportable } from '@shared/calculators/deal-model.calc';
14:import { generatePdfFromHtml } from '../utils/pdf-generator';
```

## Step 6 — How the client calls mutations

```text
rg -n "useMutation" client/src/components/deal-modeller --glob "*.tsx" | head -10
client/src/components/deal-modeller/ValuationSection.tsx:2:import { useMutation } from '@tanstack/react-query';
client/src/components/deal-modeller/ValuationSection.tsx:222:  const updateMutation = useMutation({
client/src/components/deal-modeller/FundingSection.tsx:2:import { useMutation } from '@tanstack/react-query';
client/src/components/deal-modeller/FundingSection.tsx:190:  const updateMutation = useMutation({
client/src/components/deal-modeller/FundingSection.tsx:206:  const deleteMutation = useMutation({
client/src/components/deal-modeller/FundingSection.tsx:536:  const updateMutation = useMutation({
client/src/components/deal-modeller/FundingSection.tsx:548:  const deleteMutation = useMutation({
client/src/components/deal-modeller/FundingSection.tsx:692:  const updateMutation = useMutation({
client/src/components/deal-modeller/FundingSection.tsx:704:  const deleteMutation = useMutation({
client/src/components/deal-modeller/FundingSection.tsx:848:  const addMutation = useMutation({

sed -n '222,261p' client/src/components/deal-modeller/ValuationSection.tsx
  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const res = await apiRequest('PUT', `/api/v2/deal-models/${modelId}`, updates);
      return res.json();
    },
    onSuccess: () => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
      savePendingRef.current = false;
      if (!isEditingRef.current) {
        onDataChange();
      }
    },
    onError: (error: Error) => {
      setSaveStatus('idle');
      savePendingRef.current = false;
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    },
  });

  const debounceSave = useCallback((updates: Record<string, any>) => {
    pendingRef.current = { ...(pendingRef.current || {}), ...updates };
    savePendingRef.current = true;
    setSaveStatus('saving');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (pendingRef.current) {
        updateMutation.mutate(pendingRef.current);
        pendingRef.current = null;
      }
    }, 600);
  }, [updateMutation]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const updateLocal = useCallback((field: keyof LocalValues, value: number, dbField?: string) => {
```