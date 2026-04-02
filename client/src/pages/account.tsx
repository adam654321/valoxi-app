import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, Lock, User, Building2 } from "lucide-react";

const INDUSTRIES = [
  "Accounting & Finance", "Agriculture & Farming", "Architecture & Design", "Automotive",
  "Business Services", "Childcare & Education", "Cleaning & Facilities Management",
  "Construction & Trades", "Dental & Optometry", "Distribution & Logistics", "Engineering",
  "Environmental Services", "Events & Entertainment", "Financial Services", "Food & Beverage",
  "Healthcare & Medical", "Hospitality & Leisure", "HR & Recruitment", "Insurance",
  "IT & Technology", "Legal Services", "Manufacturing", "Marketing & Media",
  "Medical Aesthetics & Wellness", "Pest Control & Security", "Printing & Publishing",
  "Property & Real Estate", "Recruitment & Staffing", "Retail & Consumer", "Social Care",
  "Transport & Haulage", "Veterinary & Pet Services", "Waste Management", "Other",
];

const COMPANY_SIZES = [
  "Just me", "2–5 employees", "5–10 employees", "10–20 employees", "20–50 employees", "50+ employees",
];

interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
  isCompanyAdmin: boolean;
}

export default function AccountPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canEditCompany = user?.permissions?.canManageCompany ?? false;
  const company = user?.company;

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/v2/account/profile"],
    queryFn: async () => {
      const res = await fetch("/api/v2/account/profile", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load profile");
      const data = await res.json();
      return data.data ?? data;
    },
  });

  // Profile form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName);
      setLastName(profile.lastName);
      setJobTitle(profile.jobTitle ?? "");
    }
  }, [profile]);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Company form
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [country, setCountry] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (company) {
      setCompanyName(company.companyName ?? "");
      setIndustry(company.industry ?? "");
      setCompanySize(company.companySize ?? "");
      setCountry(company.country ?? "");
      setCompanyEmail(company.email ?? "");
      setPhone(company.phone ?? "");
      setAddress(company.address ?? "");
    }
  }, [company]);

  const profileMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", "/api/v2/account/profile", { firstName, lastName, jobTitle: jobTitle || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/account/profile"] });
      toast({ title: "Profile updated", description: "Your details have been saved." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update profile.", variant: "destructive" });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", "/api/v2/account/password", { currentPassword, newPassword, confirmPassword });
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password changed", description: "Your password has been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to change password.", variant: "destructive" });
    },
  });

  const companyMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", "/api/v2/account/company", {
        companyName, industry: industry || null, companySize: companySize || null,
        country: country || null, email: companyEmail || null, phone: phone || null, address: address || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/auth/me"] });
      toast({ title: "Company settings saved", description: "Your company details have been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update company settings.", variant: "destructive" });
    },
  });

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-textPrimary">Account</h1>
        <p className="mt-1 text-textSecondary">Manage your personal details and company settings</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="mb-6">
          <TabsTrigger value="profile" className="gap-2"><User className="h-4 w-4" />Profile</TabsTrigger>
          <TabsTrigger value="company" className="gap-2"><Building2 className="h-4 w-4" />Company</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal Details</CardTitle>
              <CardDescription>Update your name and job title.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profileLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>First Name</Label>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Last Name</Label>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Job Title</Label>
                    <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Managing Director" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email Address</Label>
                    <Input value={profile?.email ?? ""} disabled className="bg-muted" />
                    <p className="text-xs text-muted-foreground">Email cannot be changed here. Contact support if you need to update it.</p>
                  </div>
                  <Button onClick={() => profileMutation.mutate()} disabled={profileMutation.isPending}>
                    {profileMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" />Change Password</CardTitle>
              <CardDescription>Enter your current password to set a new one.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Current Password</Label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" />
              </div>
              <div className="space-y-1.5">
                <Label>New Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm New Password</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat new password" />
              </div>
              <Button
                onClick={() => passwordMutation.mutate()}
                disabled={passwordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
              >
                {passwordMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Change Password
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Company Settings</CardTitle>
                  <CardDescription className="mt-1">
                    {canEditCompany ? "Update your organisation's details." : "Your company details — contact your admin to make changes."}
                  </CardDescription>
                </div>
                <Link href="/team">
                  <Button variant="outline" size="sm" className="gap-2 flex-shrink-0">
                    <Users className="h-4 w-4" />
                    Manage Team
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Company Name</Label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your company name"
                  disabled={!canEditCompany}
                  className={!canEditCompany ? "bg-muted" : ""}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Industry</Label>
                  {canEditCompany ? (
                    <Select value={industry} onValueChange={setIndustry}>
                      <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                      <SelectContent>
                        {INDUSTRIES.map((ind) => <SelectItem key={ind} value={ind}>{ind}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={industry} disabled className="bg-muted" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Company Size</Label>
                  {canEditCompany ? (
                    <Select value={companySize} onValueChange={setCompanySize}>
                      <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                      <SelectContent>
                        {COMPANY_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={companySize} disabled className="bg-muted" />
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Country of Operation</Label>
                {canEditCompany ? (
                  <div className="grid grid-cols-2 gap-3">
                    {[{ code: "UK", label: "United Kingdom", flag: "🇬🇧" }, { code: "US", label: "United States", flag: "🇺🇸" }].map(({ code, label, flag }) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setCountry(code)}
                        className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                          country === code
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-foreground hover:bg-muted"
                        }`}
                      >
                        <span className="text-lg">{flag}</span> {label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <Input value={country === "UK" ? "🇬🇧 United Kingdom" : country === "US" ? "🇺🇸 United States" : country || "Not set"} disabled className="bg-muted" />
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <p className="text-sm font-medium text-foreground">Contact Details</p>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder="company@example.com" disabled={!canEditCompany} className={!canEditCompany ? "bg-muted" : ""} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +44 7700 900000" disabled={!canEditCompany} className={!canEditCompany ? "bg-muted" : ""} />
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Business address" disabled={!canEditCompany} className={!canEditCompany ? "bg-muted" : ""} />
                </div>
              </div>

              {canEditCompany && (
                <Button onClick={() => companyMutation.mutate()} disabled={companyMutation.isPending || !companyName}>
                  {companyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Company Settings
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
