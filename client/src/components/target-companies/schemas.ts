import { z } from "zod";

export const targetCompanySchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  sector: z.string().min(1, "Sector is required"),
  subSector: z.string(),
  website: z.string().optional().or(z.literal("")).refine((val) => {
    if (!val || val === "") return true;
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    return urlPattern.test(val);
  }, "Please enter a valid website URL (example.com or https://example.com)"),
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

export type TargetCompanyForm = z.infer<typeof targetCompanySchema>;
