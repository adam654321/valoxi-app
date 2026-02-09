import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const sectorsData: Record<string, string[]> = {
  "Agriculture & Farming": [
    "Agri-tech & Precision Farming",
    "Arable & Crop Production",
    "Farm Supplies & Equipment",
    "Forestry & Timber",
    "Horticulture & Nurseries",
    "Livestock & Dairy",
    "Organic & Sustainable Farming",
    "Veterinary & Animal Health"
  ],
  "Automotive & Motor Trade": [
    "Body Shops & Accident Repair",
    "Car Dealerships & Sales",
    "Commercial Vehicle Services",
    "MOT & Vehicle Testing",
    "Motor Parts & Accessories",
    "Tyre & Exhaust Services",
    "Vehicle Hire & Leasing",
    "Vehicle Servicing & Repair"
  ],
  "Care & Social Services": [
    "Care Homes & Nursing Homes",
    "Children's Services & Fostering",
    "Disability & Supported Living",
    "Domiciliary & Home Care",
    "Mental Health Services",
    "Rehabilitation & Therapy",
    "Specialist Care & Complex Needs",
    "Staffing & Recruitment (Care)"
  ],
  "Cleaning & Facilities Management": [
    "Commercial Cleaning",
    "Facilities Management",
    "Industrial Cleaning & Specialist",
    "Janitorial & Office Services",
    "Laundry & Textile Services",
    "Pest Control",
    "Washroom & Hygiene Services",
    "Window & External Cleaning"
  ],
  "Construction & Building": [
    "Civil Engineering & Infrastructure",
    "Commercial Construction",
    "Demolition & Site Clearance",
    "Groundworks & Foundations",
    "House Building & Residential",
    "Interior Fit-Out & Refurbishment",
    "Scaffolding & Access",
    "Specialist Trades (Roofing, Cladding, etc.)"
  ],
  "Education & Training": [
    "Apprenticeship & Vocational Training",
    "Corporate Training & Development",
    "Early Years & Nurseries",
    "EdTech & Online Learning",
    "Language Schools",
    "Private Schools & Tutoring",
    "Special Educational Needs",
    "Training Providers & Assessment"
  ],
  "Energy & Utilities": [
    "Battery Storage & Smart Grid",
    "Electrical Contracting",
    "Energy Efficiency & Insulation",
    "Gas & Heating Services",
    "Oil & Fuel Distribution",
    "Renewable Energy (Solar, Wind)",
    "Smart Energy & IoT",
    "Utilities Brokerage & Consulting"
  ],
  "Engineering & Technical Services": [
    "Aerospace & Defence Engineering",
    "Electrical & Electronic Engineering",
    "Environmental Engineering",
    "Fire Protection & Safety Engineering",
    "Marine Engineering",
    "Mechanical & Industrial Engineering",
    "Precision Engineering & CNC",
    "Structural & Civil Engineering",
    "Testing, Inspection & Certification"
  ],
  "Environmental & Waste": [
    "Asbestos & Hazardous Waste",
    "Environmental Consultancy",
    "Land Remediation & Brownfield",
    "Recycling & Resource Recovery",
    "Skip Hire & Waste Collection",
    "Waste Management & Disposal",
    "Water Treatment & Drainage"
  ],
  "Financial Services": [
    "Accountancy & Bookkeeping",
    "Commercial Finance & Lending",
    "Financial Planning & Advice",
    "Fintech & Payment Services",
    "Insurance Broking",
    "Mortgage Broking",
    "Payroll Services",
    "Wealth Management"
  ],
  "Food & Beverage": [
    "Bakeries & Confectionery",
    "Brewing, Distilling & Wine",
    "Catering & Contract Catering",
    "Food Manufacturing & Processing",
    "Food Wholesale & Distribution",
    "Health Food & Supplements",
    "Pubs, Bars & Restaurants",
    "Takeaway & Quick Service"
  ],
  "Healthcare & Medical": [
    "Dental Practices & Orthodontics",
    "Diagnostics & Laboratory",
    "GP Practices & Primary Care",
    "Medical Devices & Equipment",
    "Occupational Health",
    "Optical & Audiology",
    "Pharmaceuticals & Pharmacy",
    "Physiotherapy & Allied Health"
  ],
  "Home Services & Property Maintenance": [
    "Bathroom & Kitchen Fitting",
    "Drainage & Plumbing",
    "Electrical Installation & Testing",
    "Fencing & Landscaping",
    "General Property Maintenance",
    "Heating, Ventilation & Air Conditioning (HVAC)",
    "Painting & Decorating",
    "Smart Home & Home Automation",
    "Windows, Doors & Conservatories"
  ],
  "Hospitality & Leisure": [
    "Activity Centres & Adventures",
    "Caravan Parks & Holiday Lets",
    "Events & Conference Venues",
    "Fitness & Gyms",
    "Hotels & Guest Houses",
    "Leisure Centres & Soft Play",
    "Sports Coaching & Facilities",
    "Travel Agencies & Tour Operators"
  ],
  "IT Services & Telecoms": [
    "Audio Visual & Unified Comms",
    "Business Telecoms & VoIP",
    "Cloud Services & Hosting",
    "Cyber Security Services",
    "Data Cabling & Infrastructure",
    "IT Support & Managed Services (MSP)",
    "Software Development & Consulting",
    "Web Design & Digital Services"
  ],
  "Logistics, Transport & Distribution": [
    "Cold Chain & Temperature Control",
    "Courier & Same-Day Delivery",
    "Fleet Management & Telematics",
    "Freight Forwarding & Customs",
    "Haulage & Road Transport",
    "Removal & Relocation Services",
    "Storage & Warehousing",
    "Wholesale Distribution"
  ],
  "Manufacturing": [
    "Aerospace & Defence Manufacturing",
    "Chemicals & Coatings",
    "Electronics & PCB Assembly",
    "Food & Drink Manufacturing",
    "Furniture & Joinery",
    "Metal Fabrication & Welding",
    "Packaging Manufacturing",
    "Plastics & Composites",
    "Textiles & Clothing"
  ],
  "Media, Marketing & Creative": [
    "Advertising & Media Buying",
    "Branding & Design Agencies",
    "Content Production & Video",
    "Digital Marketing & SEO/PPC",
    "Events & Experiential",
    "Film & TV Production",
    "PR & Communications",
    "Print & Publishing",
    "Social Media Management"
  ],
  "Personal Services & Beauty": [
    "Barbers & Men's Grooming",
    "Beauty Salons & Spas",
    "Cosmetic & Aesthetic Clinics",
    "Funeral & Memorial Services",
    "Hair Salons & Hairdressing",
    "Health & Wellness Retreats",
    "Nail & Beauty Treatments",
    "Tattoo & Body Art Studios"
  ],
  "Professional Services": [
    "Architecture & Design",
    "Business Consulting & Advisory",
    "Company Secretarial & Compliance",
    "HR Consulting & Outsourcing",
    "Legal Services & Law Firms",
    "Management Consulting",
    "Quantity Surveying & Project Management",
    "Recruitment & Staffing"
  ],
  "Property & Real Estate": [
    "Build-to-Rent & BTL Management",
    "Commercial Property Management",
    "Estate Agents & Lettings",
    "Housing Associations & Social Housing",
    "Property Development",
    "PropTech & Property Technology",
    "Residential Block Management",
    "Surveying & Valuation"
  ],
  "Retail & E-Commerce": [
    "Automotive Parts & Accessories Retail",
    "DIY & Home Improvement",
    "E-Commerce & Online Retail",
    "Fashion & Clothing Retail",
    "Garden Centres & Outdoor",
    "Health & Beauty Retail",
    "Pet Supplies & Services",
    "Specialist & Niche Retail"
  ],
  "Security & Fire Protection": [
    "Access Control & Entry Systems",
    "Alarm Installation & Monitoring",
    "CCTV & Surveillance",
    "Cyber Security (Operational)",
    "Door Supervision & Close Protection",
    "Fire Alarm & Detection",
    "Manned Guarding & Patrols",
    "Security Systems Integration"
  ],
  "Signage, Print & Graphics": [
    "Commercial Printing",
    "Digital & Large Format Print",
    "Exhibition & Display",
    "Promotional Merchandise",
    "Signage Manufacturing & Installation",
    "Vehicle Graphics & Wrapping"
  ],
  "Other": []
};

const sectors = Object.keys(sectorsData).sort();

const targetCompanySchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  sector: z.string().min(1, "Sector is required"),
  subSector: z.string(),
  website: z.string().url("Please enter a valid website URL").optional().or(z.literal("")),
  phone: z.string().optional(),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  address: z.string().optional(),
  annualRevenue: z.union([z.string(), z.number()]).optional(),
  employeeCount: z.union([z.string(), z.number()]).optional(),
  yearEstablished: z.union([z.string(), z.number()]).optional(),
  description: z.string().optional(),
}).refine((data) => {
  if (data.sector === "Other") return true;
  return data.subSector && data.subSector.length > 0;
}, {
  message: "Sub-sector is required",
  path: ["subSector"],
});

type TargetCompanyForm = z.infer<typeof targetCompanySchema>;

export function AddTargetCompanyButton() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [showForm, setShowForm] = useState(false);

  const form = useForm<TargetCompanyForm>({
    resolver: zodResolver(targetCompanySchema),
    defaultValues: {
      companyName: "",
      sector: "",
      subSector: "",
      website: "",
      phone: "",
      email: "",
      address: "",
      annualRevenue: "",
      employeeCount: "",
      yearEstablished: "",
      description: "",
    },
  });

  const selectedSector = form.watch("sector");
  const availableSubSectors = selectedSector ? sectorsData[selectedSector] || [] : [];

  const createMutation = useMutation({
    mutationFn: async (data: TargetCompanyForm) => {
      const payload = {
        companyName: data.companyName,
        industry: data.sector,
        subSector: data.subSector || null,
        website: data.website || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        annualRevenue: data.annualRevenue ? Number(data.annualRevenue) : null,
        employeeCount: data.employeeCount ? Number(data.employeeCount) : null,
        yearEstablished: data.yearEstablished ? Number(data.yearEstablished) : null,
        description: data.description || null,
      };
      return await apiRequest("POST", "/api/v2/target-companies", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v2/target-companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/target-companies/search"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/target-companies/filters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/dashboard/stats"] });
      setShowForm(false);
      form.reset();
      toast({
        title: "Success",
        description: "Target company added successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add target company",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TargetCompanyForm) => {
    createMutation.mutate(data);
  };

  const handleAddNew = () => {
    form.reset();
    setShowForm(true);
  };

  return (
    <>
      <Button 
        onClick={handleAddNew}
        className="bg-primary text-white hover:bg-blue-700" 
        data-testid="button-add-target-company"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Target Company
      </Button>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Target Company</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-textPrimary">Basic Information</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Acme Corporation" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="sector"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sector *</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue("subSector", "");
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select sector" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {sectors.map((sector) => (
                              <SelectItem key={sector} value={sector}>
                                {sector}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="subSector"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sub-sector *</FormLabel>
                      <Select 
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!selectedSector || selectedSector === "Other"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={selectedSector === "Other" ? "No sub-sectors for Other" : "Select sub-sector"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableSubSectors.map((subSector) => (
                            <SelectItem key={subSector} value={subSector}>
                              {subSector}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input 
                            type="url" 
                            placeholder="example.com"
                            {...field}
                            onChange={(e) => {
                              let value = e.target.value;
                              if (value && !value.startsWith('http://') && !value.startsWith('https://')) {
                                value = 'https://' + value;
                              }
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="contact@company.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="+1 (555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Company headquarters address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Business Details Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-textPrimary">Business Details</h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="annualRevenue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Annual Revenue (£)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="1000000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="employeeCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee Count</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="50" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="yearEstablished"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year Established</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="2020" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Brief description of the company and why it's a potential acquisition target"
                          className="min-h-20"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowForm(false)}
                  disabled={createMutation.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending}
                  className="bg-primary hover:bg-blue-700"
                >
                  {createMutation.isPending ? "Adding..." : "Add Company"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}