import type { PlanKey } from './schema/billing';

export interface TierLimits {
  maxActiveTargets: number | null;
  maxSeats: number | null;
  maxStorageGb: number | null;
  maxDealModelVersions: number | null;
  versionHistoryRetentionDays: number | null;
}

export const TIER_LIMITS: Record<PlanKey, TierLimits> = {
  CORE: {
    maxActiveTargets: 5,
    maxSeats: 1,
    maxStorageGb: 1,
    maxDealModelVersions: 1,
    versionHistoryRetentionDays: 0,
  },
  PROFESSIONAL: {
    maxActiveTargets: 15,
    maxSeats: 1,
    maxStorageGb: 10,
    maxDealModelVersions: 5,
    versionHistoryRetentionDays: 90,
  },
  EXPERT: {
    maxActiveTargets: 50,
    maxSeats: 1,
    maxStorageGb: 25,
    maxDealModelVersions: 20,
    versionHistoryRetentionDays: 180,
  },
  ENTERPRISE: {
    maxActiveTargets: null,
    maxSeats: null,
    maxStorageGb: null,
    maxDealModelVersions: null,
    versionHistoryRetentionDays: null,
  },
};

export interface TierFeatures {
  pipelineKanban: boolean;
  targetArchiving: boolean;
  companiesHouseImport: boolean;
  pipelineCustomisation: boolean;
  dealComparisonDashboard: boolean;
  activityAuditTrail: boolean;

  documentUpload: boolean;
  aiDocumentExtraction: boolean;
  documentExtraction: boolean;
  expertAnalysisSummary: boolean;
  expertAnalysisFullDetail: boolean;

  simplifiedDealModeller: boolean;
  fullDealModeller: boolean;
  dscrFiveZoneIndicator: boolean;
  dscrLenderContextPanel: boolean;
  modelVersioning: boolean;
  dealStructureAiAgent: boolean;
  savedFeeFundingTemplates: boolean;

  valueCreationModule: boolean;
  linkedCustomScenarios: boolean;
  debtAmortisationSchedule: boolean;
  returnsWaterfallAnalysis: boolean;
  sensitivityHeatMaps: boolean;

  aiOfferLetter: boolean;
  hotStandardTemplate: boolean;
  hotBuilder: boolean;

  sellerPortal: boolean;
  portalWhiteLabelling: false | 'logo' | 'full';
  ddDataRoom: boolean;
  multiDocumentUploads: boolean;
  documentReviewWorkflow: boolean;
  requestMoreInformation: boolean;
  thirdPartyDdAccess: boolean;
  ddZipExport: boolean;

  additionalSeatPurchasing: boolean;
  roleBasedAccessControl: boolean;
  teamActivityDashboard: boolean;
  ssoSaml: boolean;

  exportToPdfExcel: boolean;
  apiAccess: boolean;

  emailSupport: boolean;
  prioritySupport: boolean;
  dedicatedPrioritySupport: boolean;
  onboardingCall: boolean;
  guidedDealChecklist: boolean;
}

const CORE_FEATURES: TierFeatures = {
  pipelineKanban: true,
  targetArchiving: true,
  companiesHouseImport: true,
  pipelineCustomisation: false,
  dealComparisonDashboard: false,
  activityAuditTrail: false,

  documentUpload: true,
  aiDocumentExtraction: true,
  documentExtraction: true,
  expertAnalysisSummary: true,
  expertAnalysisFullDetail: false,

  simplifiedDealModeller: true,
  fullDealModeller: false,
  dscrFiveZoneIndicator: true,
  dscrLenderContextPanel: false,
  modelVersioning: false,
  dealStructureAiAgent: false,
  savedFeeFundingTemplates: false,

  valueCreationModule: false,
  linkedCustomScenarios: false,
  debtAmortisationSchedule: false,
  returnsWaterfallAnalysis: false,
  sensitivityHeatMaps: false,

  aiOfferLetter: true,
  hotStandardTemplate: true,
  hotBuilder: false,

  sellerPortal: true,
  portalWhiteLabelling: false,
  ddDataRoom: false,
  multiDocumentUploads: false,
  documentReviewWorkflow: false,
  requestMoreInformation: false,
  thirdPartyDdAccess: false,
  ddZipExport: false,

  additionalSeatPurchasing: false,
  roleBasedAccessControl: false,
  teamActivityDashboard: false,
  ssoSaml: false,

  exportToPdfExcel: true,
  apiAccess: false,

  emailSupport: true,
  prioritySupport: false,
  dedicatedPrioritySupport: false,
  onboardingCall: false,
  guidedDealChecklist: true,
};

const PROFESSIONAL_FEATURES: TierFeatures = {
  ...CORE_FEATURES,
  pipelineCustomisation: true,
  expertAnalysisFullDetail: true,
  fullDealModeller: true,
  dscrLenderContextPanel: true,
  modelVersioning: true,
  dealStructureAiAgent: true,
  ddDataRoom: true,
  multiDocumentUploads: true,
  documentReviewWorkflow: true,
  requestMoreInformation: true,
  ddZipExport: true,
  additionalSeatPurchasing: true,
  portalWhiteLabelling: 'logo',
  onboardingCall: true,
  guidedDealChecklist: false,
};

const EXPERT_FEATURES: TierFeatures = {
  ...PROFESSIONAL_FEATURES,
  dealComparisonDashboard: true,
  valueCreationModule: true,
  linkedCustomScenarios: true,
  debtAmortisationSchedule: true,
  returnsWaterfallAnalysis: true,
  sensitivityHeatMaps: true,
  hotBuilder: true,
  portalWhiteLabelling: 'full',
  thirdPartyDdAccess: true,
  roleBasedAccessControl: true,
  apiAccess: true,
  prioritySupport: true,
};

const ENTERPRISE_FEATURES: TierFeatures = {
  ...EXPERT_FEATURES,
  activityAuditTrail: true,
  savedFeeFundingTemplates: true,
  teamActivityDashboard: true,
  ssoSaml: true,
  dedicatedPrioritySupport: true,
};

export const TIER_FEATURES: Record<PlanKey, TierFeatures> = {
  CORE: CORE_FEATURES,
  PROFESSIONAL: PROFESSIONAL_FEATURES,
  EXPERT: EXPERT_FEATURES,
  ENTERPRISE: ENTERPRISE_FEATURES,
};

export function getEffectiveLimits(
  planKey: PlanKey,
  enterpriseOverrides?: Record<string, unknown> | null
): TierLimits {
  const base = { ...TIER_LIMITS[planKey] };

  if (planKey !== 'ENTERPRISE' || !enterpriseOverrides) {
    return base;
  }

  const overrideMap: Record<string, keyof TierLimits> = {
    maxTargets: 'maxActiveTargets',
    maxSeats: 'maxSeats',
    maxStorageGb: 'maxStorageGb',
  };

  for (const [overrideKey, limitKey] of Object.entries(overrideMap)) {
    const val = enterpriseOverrides[overrideKey];
    if (typeof val === 'number') {
      base[limitKey] = val;
    }
  }

  return base;
}

export function hasFeature(
  planKey: PlanKey,
  feature: keyof TierFeatures
): boolean {
  const val = TIER_FEATURES[planKey][feature];
  return val !== false;
}

export function getMaxActiveTargets(
  planKey: PlanKey,
  addOnCompanySlots: number,
  enterpriseOverrides?: Record<string, unknown> | null
): number | null {
  const limits = getEffectiveLimits(planKey, enterpriseOverrides);
  if (limits.maxActiveTargets === null) {
    return null;
  }
  return limits.maxActiveTargets + addOnCompanySlots;
}

export function getMaxSeats(
  planKey: PlanKey,
  additionalSeats: number,
  enterpriseOverrides?: Record<string, unknown> | null
): number | null {
  const limits = getEffectiveLimits(planKey, enterpriseOverrides);
  if (limits.maxSeats === null) {
    return null;
  }
  return limits.maxSeats + additionalSeats;
}
