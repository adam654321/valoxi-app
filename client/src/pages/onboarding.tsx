import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const INDUSTRIES = [
  "Accounting & Finance",
  "Agriculture & Farming",
  "Architecture & Design",
  "Automotive",
  "Business Services",
  "Childcare & Education",
  "Cleaning & Facilities Management",
  "Construction & Trades",
  "Dental & Optometry",
  "Distribution & Logistics",
  "Engineering",
  "Environmental Services",
  "Events & Entertainment",
  "Financial Services",
  "Food & Beverage",
  "Healthcare & Medical",
  "Hospitality & Leisure",
  "HR & Recruitment",
  "Insurance",
  "IT & Technology",
  "Legal Services",
  "Manufacturing",
  "Marketing & Media",
  "Medical Aesthetics & Wellness",
  "Pest Control & Security",
  "Printing & Publishing",
  "Property & Real Estate",
  "Recruitment & Staffing",
  "Retail & Consumer",
  "Social Care",
  "Transport & Haulage",
  "Veterinary & Pet Services",
  "Waste Management",
  "Other",
];

const COMPANY_SIZES = [
  "Just me",
  "2–5 employees",
  "5–10 employees",
  "10–20 employees",
  "20–50 employees",
  "50+ employees",
];

const HEAR_ABOUT_OPTIONS = [
  "5D Community",
  "LinkedIn",
  "Google / Search",
  "YouTube",
  "Podcast",
  "Twitter / X",
  "Facebook / Instagram",
  "Newsletter / Email",
  "Referred by a colleague",
  "Referred by a friend",
  "Online forum or community",
  "Press / News article",
  "Webinar or event",
  "Other",
];

interface AuthUser {
  id: number;
  onboardingCompleted: boolean;
}

interface SubscriptionData {
  subscription?: {
    userCompanyId: number;
  };
}

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: user, isLoading: userLoading } = useQuery<AuthUser>({
    queryKey: ["/api/v2/auth/me"],
    select: (response: any) => response?.data || response,
  });

  const { data: subData } = useQuery<SubscriptionData>({
    queryKey: ["/api/v2/billing/subscription"],
  });

  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [industryOther, setIndustryOther] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [country, setCountry] = useState("");
  const [role, setRole] = useState("");
  const [hearAboutUs, setHearAboutUs] = useState("");
  const [hearAboutUsOther, setHearAboutUsOther] = useState("");
  const [companyNamePreFilled, setCompanyNamePreFilled] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptDpa, setAcceptDpa] = useState(false);

  useEffect(() => {
    if (!companyNamePreFilled && subData) {
      const fetchCompany = async () => {
        try {
          const res = await fetch("/api/v2/auth/me", { credentials: "include" });
          const data = await res.json();
          if (data?.data?.company?.companyName) {
            setCompanyName(data.data.company.companyName);
          }
        } catch { /* ignore */ }
        setCompanyNamePreFilled(true);
      };
      fetchCompany();
    }
  }, [subData, companyNamePreFilled]);

  useEffect(() => {
    if (!userLoading && user?.onboardingCompleted) {
      navigate("/dashboard");
    }
  }, [user, userLoading, navigate]);

  const submitMutation = useMutation({
    mutationFn: async (data: {
      companyName: string;
      industry: string;
      companySize: string;
      country?: string;
      role: string;
      hearAboutUs: string;
      acceptTerms: boolean;
      acceptDpa: boolean;
    }) => {
      const res = await apiRequest("POST", "/api/v2/onboarding/complete", data);
      return res.json();
    },
    onSuccess: async () => {
      queryClient.setQueryData(["/api/v2/auth/me"], (old: any) => {
        if (!old) return old;
        const data = old?.data ?? old;
        const updated = { ...data, onboardingCompleted: true };
        return old?.data !== undefined ? { ...old, data: updated } : updated;
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/v2/auth/me"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/v2/onboarding/progress"] });
      toast({ title: "Welcome to Valoxi", description: "Your account is set up. Let's find you a deal." });
      navigate("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Something went wrong",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const [errors, setErrors] = useState<{ companyName?: string; industry?: string; acceptance?: string }>({});

  const handleSubmit = () => {
    const newErrors: { companyName?: string; industry?: string; acceptance?: string } = {};
    if (!companyName.trim()) newErrors.companyName = "Company name is required.";
    if (!industry) newErrors.industry = "Please select your industry.";
    if (industry === "Other" && !industryOther.trim()) newErrors.industry = "Please describe your industry.";
    if (!acceptTerms || !acceptDpa) newErrors.acceptance = "Please accept the Terms and Data Processing Agreement to continue.";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    submitMutation.mutate({
      companyName,
      industry: industry === "Other" ? `Other: ${industryOther.trim()}` : industry,
      companySize,
      country,
      role,
      hearAboutUs: hearAboutUs === "Other" ? `Other: ${hearAboutUsOther.trim()}` : hearAboutUs,
      acceptTerms,
      acceptDpa,
    });
  };

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-background">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary rounded-xl flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="mt-6 text-2xl font-bold text-foreground">Welcome to Valoxi</h1>
          <p className="mt-2 text-sm text-muted-foreground">Acquire Smarter, Faster</p>
        </div>

        <div className="flex items-center justify-center">
          <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
            Step 1 of 1 — Tell us about yourself
          </span>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Company Name <span className="text-red-500">*</span></Label>
              <Input
                value={companyName}
                onChange={(e) => { setCompanyName(e.target.value); setErrors((p) => ({ ...p, companyName: undefined })); }}
                placeholder="e.g. Acme Acquisitions Ltd"
              />
              {errors.companyName && <p className="text-sm text-red-600">{errors.companyName}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Your Industry <span className="text-red-500">*</span></Label>
              <Select value={industry} onValueChange={(v) => { setIndustry(v); setErrors((p) => ({ ...p, industry: undefined })); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.industry && <p className="text-sm text-red-600">{errors.industry}</p>}
              {industry === "Other" && (
                <div className="space-y-1.5 mt-2">
                  <Input
                    value={industryOther}
                    onChange={(e) => setIndustryOther(e.target.value)}
                    placeholder="Please describe your industry"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Company Size</Label>
              <Select value={companySize} onValueChange={setCompanySize}>
                <SelectTrigger>
                  <SelectValue placeholder="Select company size" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_SIZES.map((size) => (
                    <SelectItem key={size} value={size}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Country of Operation</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCountry("UK")}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                    country === "UK"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  <span className="text-lg">🇬🇧</span> United Kingdom
                </button>
                <button
                  type="button"
                  onClick={() => setCountry("US")}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                    country === "US"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  <span className="text-lg">🇺🇸</span> United States
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Where are the companies you're looking to acquire based?</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Your Role</Label>
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Managing Director, Investment Analyst"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">How did you hear about Valoxi?</Label>
              <Select value={hearAboutUs} onValueChange={setHearAboutUs}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  {HEAR_ABOUT_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hearAboutUs === "Other" && (
                <div className="space-y-1.5 mt-2">
                  <Input
                    value={hearAboutUsOther}
                    onChange={(e) => setHearAboutUsOther(e.target.value)}
                    placeholder="Please tell us how you found us"
                  />
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border space-y-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="acceptTerms"
                  checked={acceptTerms}
                  onChange={(e) => { setAcceptTerms(e.target.checked); setErrors((p) => ({ ...p, acceptance: undefined })); }}
                  className="mt-1 h-4 w-4 rounded border-border accent-primary cursor-pointer"
                />
                <label htmlFor="acceptTerms" className="text-sm text-foreground leading-relaxed cursor-pointer">
                  I accept the{" "}
                  <a href="https://valoxi.ai/terms/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                    Terms and Conditions
                  </a>
                  .
                </label>
              </div>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="acceptDpa"
                  checked={acceptDpa}
                  onChange={(e) => { setAcceptDpa(e.target.checked); setErrors((p) => ({ ...p, acceptance: undefined })); }}
                  className="mt-1 h-4 w-4 rounded border-border accent-primary cursor-pointer"
                />
                <label htmlFor="acceptDpa" className="text-sm text-foreground leading-relaxed cursor-pointer">
                  I accept the{" "}
                  <a href="https://valoxi.ai/dpa/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                    Data Processing Agreement
                  </a>
                  .
                </label>
              </div>
              <p className="text-xs text-muted-foreground pl-7">
                Our{" "}
                <a href="https://valoxi.ai/privacy/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                  Privacy Policy
                </a>{" "}
                explains how we handle your data.
              </p>
              {errors.acceptance && <p className="text-sm text-red-600 pl-7">{errors.acceptance}</p>}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="w-full py-3"
            >
              {submitMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Get Started →
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
