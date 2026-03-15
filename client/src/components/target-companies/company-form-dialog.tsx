import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sectorsData, sectors } from "./constants";
import { targetCompanySchema, type TargetCompanyForm } from "./schemas";
import type { TargetCompanyWithStats } from "./types";

interface CompanyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCompany: TargetCompanyWithStats | null;
  onSubmit: (data: TargetCompanyForm) => void;
  isPending: boolean;
}

const CompanyFormDialog: React.FC<CompanyFormDialogProps> = ({
  open,
  onOpenChange,
  editingCompany,
  onSubmit,
  isPending,
}) => {
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

  useEffect(() => {
    if (open && editingCompany) {
      form.reset({
        companyName: editingCompany.companyName,
        sector: editingCompany.industry || "",
        subSector: editingCompany.subSector || "",
        website: editingCompany.website || "",
        phone: editingCompany.phone || "",
        email: editingCompany.email || "",
        address: editingCompany.address || "",
        annualRevenue: editingCompany.annualRevenue?.toString() || "",
        employeeCount: editingCompany.employeeCount?.toString() || "",
        yearEstablished: editingCompany.yearEstablished?.toString() || "",
        description: editingCompany.description || "",
      });
    } else if (open && !editingCompany) {
      form.reset({
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
      });
    }
  }, [open, editingCompany]);

  const selectedSector = form.watch("sector");
  const availableSubSectors = selectedSector ? sectorsData[selectedSector] || [] : [];

  const handleSubmit = (data: TargetCompanyForm) => {
    const processedData = {
      ...data,
      website: data.website && !data.website.startsWith('http://') && !data.website.startsWith('https://')
        ? `https://${data.website}`
        : data.website
    };
    onSubmit(processedData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingCompany ? "Edit Target Company" : "Add Target Company"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
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
                        <Input placeholder="Acme Corporation" {...field} data-testid="input-company-name" />
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
                          <SelectTrigger data-testid="select-sector">
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
                      key={`subsector-${editingCompany?.id ?? 'new'}-${selectedSector}`}
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!selectedSector || selectedSector === "Other"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-sub-sector">
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
                        <Input placeholder="example.com" {...field} data-testid="input-website" />
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
                        <Input placeholder="contact@example.com" {...field} data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-textPrimary">Financial & Operational Details</h3>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="annualRevenue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Annual Revenue (£)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="1000000" {...field} data-testid="input-annual-revenue" />
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
                        <Input type="number" placeholder="50" {...field} data-testid="input-employee-count" />
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
                        <Input type="number" placeholder="2010" {...field} data-testid="input-year-established" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-textPrimary">Contact & Location</h3>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 (555) 123-4567" {...field} data-testid="input-phone" />
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
                      <Textarea
                        placeholder="123 Business St, City, State, ZIP"
                        {...field}
                        data-testid="textarea-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description of the company's business model, key strengths, and acquisition potential..."
                        {...field}
                        data-testid="textarea-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-submit-form"
              >
                {isPending
                  ? "Saving..."
                  : editingCompany
                    ? "Update Company"
                    : "Add Company"
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CompanyFormDialog;
