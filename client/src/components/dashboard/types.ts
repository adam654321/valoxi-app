export interface PipelineOverviewData {
  stages: Array<{
    stage: string;
    count: number;
    avg_days: number;
  }>;
  totalActive: number;
  lastUpdated: Date;
}

export interface RecentActivitiesData {
  activities: Array<{
    id: number;
    title: string;
    activityType: string;
    companyName: string;
    userName: string;
    contactName?: string;
    createdAt: string;
  }>;
  lastUpdated: Date;
}

export interface HotDealsData {
  deals: Array<{
    id: number;
    companyName: string;
    stage: string;
    daysInStage: number;
    recentActivityCount: number;
  }>;
  lastUpdated: Date;
}

export interface QuickStatsData {
  newDeals: number;
  completedDeals: number;
  totalActivities: number;
  avgDealTime: number;
  lastUpdated: Date;
}
