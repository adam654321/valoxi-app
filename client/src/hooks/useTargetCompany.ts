import { useQuery } from "@tanstack/react-query";
import type { TargetCompany, TargetContact, Stage1AnalysisEvent } from "@shared/schema";

export interface CompanyProfile extends TargetCompany {
  createdByName: string;
  userCompanyName: string;
  totalContacts: number;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  primaryContactTitle: string | null;
  yearsInBusiness: number | null;
  revenuePerEmployee: number | null;
  contacts: TargetContact[];
}

interface UseTargetCompanyOptions {
  companyId: string | undefined;
}

export function useTargetCompany({ companyId }: UseTargetCompanyOptions) {
  const {
    data: profile,
    isLoading: profileLoading,
    isFetching: profileFetching,
    refetch: refetchProfile,
  } = useQuery<CompanyProfile>({
    queryKey: ["/api/target-companies", companyId, "profile"],
    enabled: !!companyId,
    refetchInterval: (query) => {
      const data = query.state.data as CompanyProfile | undefined;
      if (data && !data.websiteAnalysis && data.website) {
        return 5000;
      }
      return false;
    },
    refetchIntervalInBackground: false,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: stage1Events = [], isLoading: analysisLoading } = useQuery<Stage1AnalysisEvent[]>({
    queryKey: ["/api/target-companies", companyId, "stage1-analysis"],
    enabled: !!companyId,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    staleTime: 10000,
  });

  const company = profile;
  const contacts = profile?.contacts || [];
  const primaryContact = contacts.find(c => c.isPrimary);
  const otherContacts = contacts.filter(c => !c.isPrimary);

  return {
    profile,
    company,
    contacts,
    primaryContact,
    otherContacts,
    stage1Events,
    profileLoading,
    profileFetching,
    analysisLoading,
    refetchProfile,
  };
}
