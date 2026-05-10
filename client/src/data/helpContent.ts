export interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  categoryId: string;
  excerpt: string;
  content: HelpBlock[];
}

export interface HelpBlock {
  type: "heading" | "paragraph" | "bullet" | "numbered" | "table" | "tip" | "warning";
  text?: string;
  items?: string[];
  rows?: { cells: string[] }[];
  headers?: string[];
}

export interface HelpCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const categories: HelpCategory[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Sign in, onboarding, and platform navigation",
    icon: "Rocket",
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Metrics, widgets, and quick actions",
    icon: "LayoutDashboard",
  },
  {
    id: "pipeline",
    title: "Pipeline",
    description: "Kanban board, deal stages, and workflow",
    icon: "Kanban",
  },
  {
    id: "target-companies",
    title: "Target Companies",
    description: "Adding targets, documents, analysis, and modelling",
    icon: "Building2",
  },
  {
    id: "seller-portal",
    title: "Seller Portal",
    description: "Secure document collection and NDA signing",
    icon: "Shield",
  },
  {
    id: "portal-management",
    title: "Portal Management",
    description: "Manage and monitor all portal links",
    icon: "Link",
  },
  {
    id: "contacts-team",
    title: "Contacts & Team",
    description: "Directory, invites, and collaboration",
    icon: "Users",
  },
  {
    id: "account-billing",
    title: "Account & Billing",
    description: "Profile, settings, and subscription plans",
    icon: "CreditCard",
  },
];

export const articles: HelpArticle[] = [
  {
    id: "signing-in",
    title: "Signing In",
    slug: "signing-in",
    category: "Getting Started",
    categoryId: "getting-started",
    excerpt: "How to sign in to Valoxi using email/password or magic links.",
    content: [
      { type: "paragraph", text: "Navigate to your Valoxi URL and sign in with your email and password." },
      { type: "paragraph", text: "If you have forgotten your password, use the Forgot Password link on the login page to receive a reset email." },
      { type: "paragraph", text: "If your organisation uses a magic link login, check your inbox for the sign-in email and click the link to access the platform instantly." },
    ],
  },
  {
    id: "onboarding",
    title: "Onboarding",
    slug: "onboarding",
    category: "Getting Started",
    categoryId: "getting-started",
    excerpt: "Your first-time setup walkthrough.",
    content: [
      { type: "paragraph", text: "New users are guided through a short onboarding flow the first time they sign in. This sets up your company profile and confirms the key settings needed to personalise your workspace." },
      { type: "paragraph", text: "You will be asked to confirm your company name, industry, and country of operation. These settings affect financial formatting and regulatory references throughout the platform." },
    ],
  },
  {
    id: "navigation",
    title: "Navigation",
    slug: "navigation",
    category: "Getting Started",
    categoryId: "getting-started",
    excerpt: "Understanding the sidebar and main sections of Valoxi.",
    content: [
      { type: "paragraph", text: "The left-hand sidebar gives you access to every major section of the platform." },
      { type: "heading", text: "Sidebar Items" },
      {
        type: "table",
        headers: ["Item", "Description"],
        rows: [
          { cells: ["Dashboard", "High-level overview of your activity and key metrics"] },
          { cells: ["Pipeline", "Visual Kanban board of all your active deals"] },
          { cells: ["Target Companies", "Full list of all targets you are tracking"] },
          { cells: ["Portal Management", "Manage Seller Portal links and track document submissions"] },
          { cells: ["Contacts", "Directory of individuals linked to your deals"] },
          { cells: ["Team", "Invite and manage team members"] },
          { cells: ["Reports", "Activity alerts and reminders"] },
          { cells: ["Billing", "Manage your subscription and payment details"] },
          { cells: ["Account", "Update your profile and company settings"] },
        ],
      },
    ],
  },
  {
    id: "key-metrics",
    title: "Key Metrics",
    slug: "key-metrics",
    category: "Dashboard",
    categoryId: "dashboard",
    excerpt: "Understanding the four summary cards at the top of your Dashboard.",
    content: [
      { type: "paragraph", text: "At the top of the Dashboard, four summary cards show your deal activity at a glance:" },
      { type: "bullet", items: [
        "Target Companies — the number of active targets currently in your pipeline",
        "Total Deals — the total number of companies you have ever tracked, including archived ones",
        "Offers Sent — the number of targets that have reached the Offer Stage or beyond",
        "Total Pipeline Value — the combined estimated deal value of all active targets",
      ]},
    ],
  },
  {
    id: "dashboard-widgets",
    title: "Dashboard Widgets",
    slug: "dashboard-widgets",
    category: "Dashboard",
    categoryId: "dashboard",
    excerpt: "Pipeline overview, hot deals, reminders, stage alerts, and activity feed.",
    content: [
      { type: "paragraph", text: "Beneath the metrics, several widgets surface the information most relevant to your day-to-day work:" },
      { type: "bullet", items: [
        "Pipeline Overview — a visual breakdown of how many deals sit in each stage of your pipeline",
        "Hot Deals — targets flagged as high priority that need your attention soon",
        "Upcoming Reminders — tasks and deadlines you have set against specific targets",
        "Stage Alerts — deals that have been sitting in the same stage for an unusually long time, prompting you to take action",
        "Recent Activity / Team Activity — a running log of updates across your workspace, including actions taken by team members",
      ]},
    ],
  },
  {
    id: "quick-actions",
    title: "Quick Actions",
    slug: "quick-actions",
    category: "Dashboard",
    categoryId: "dashboard",
    excerpt: "Shortcut buttons for common tasks.",
    content: [
      { type: "paragraph", text: "Buttons on the Dashboard let you jump straight to adding a new target company, viewing the full pipeline, or managing your team without navigating the sidebar." },
    ],
  },
  {
    id: "deal-stages",
    title: "Deal Stages",
    slug: "deal-stages",
    category: "Pipeline",
    categoryId: "pipeline",
    excerpt: "The default Kanban columns and what each stage means.",
    content: [
      { type: "paragraph", text: "The default pipeline stages move a deal from initial identification through to completion:" },
      {
        type: "table",
        headers: ["Stage", "What it means"],
        rows: [
          { cells: ["New Target", "Newly identified company you are considering"] },
          { cells: ["Initial Contact", "You have made first contact with the owner or their representative"] },
          { cells: ["Documents Requested", "You have asked the target to share financial and operational documents"] },
          { cells: ["Under Review", "You are actively reviewing the documents and business"] },
          { cells: ["Offer Stage", "You are preparing or have submitted an offer"] },
          { cells: ["Heads of Terms", "You are negotiating and agreeing the headline deal terms"] },
          { cells: ["Due Diligence", "Formal legal and financial due diligence is underway"] },
          { cells: ["Legal & Accounting", "Legal and accounting workstreams are active"] },
          { cells: ["Completion", "The deal is completing or has completed"] },
          { cells: ["Not Qualified", "The target did not meet your criteria and has been closed out"] },
        ],
      },
    ],
  },
  {
    id: "moving-deals",
    title: "Moving Deals Through the Pipeline",
    slug: "moving-deals",
    category: "Pipeline",
    categoryId: "pipeline",
    excerpt: "How to update deal stages and automated triggers.",
    content: [
      { type: "paragraph", text: "Drag a deal card from one column to another to update its stage. The platform records the transition and can trigger automated actions — for example, when you create a Seller Portal link for a target, the deal may automatically advance to the Documents Requested stage." },
    ],
  },
  {
    id: "adding-target-pipeline",
    title: "Adding a New Target from the Pipeline",
    slug: "adding-target-pipeline",
    category: "Pipeline",
    categoryId: "pipeline",
    excerpt: "Create a new target directly from the Pipeline view.",
    content: [
      { type: "paragraph", text: "Use the Add Company button at the top of the Pipeline page to create a new target directly. You will be prompted to enter the company name and any initial details before the card appears in the pipeline." },
    ],
  },
  {
    id: "adding-a-target",
    title: "Adding a Target",
    slug: "adding-a-target",
    category: "Target Companies",
    categoryId: "target-companies",
    excerpt: "Create a new company profile to track in your pipeline.",
    content: [
      { type: "paragraph", text: "Click Add Company (available from the Pipeline, Dashboard, or Target Companies list) and fill in the company's basic details: name, sector, approximate revenue, and any notes. Once created, the target appears in your pipeline and you can begin building the deal file." },
    ],
  },
  {
    id: "uploading-documents",
    title: "Uploading Documents",
    slug: "uploading-documents",
    category: "Target Companies",
    categoryId: "target-companies",
    excerpt: "Upload financial and operational documents for AI analysis.",
    content: [
      { type: "paragraph", text: "The Documents section within a target profile is where you upload the financial and operational documents that power Valoxi's analysis." },
      { type: "heading", text: "Supported document types" },
      { type: "bullet", items: [
        "Profit & Loss statement",
        "Balance Sheet",
        "Management accounts",
        "Asset register",
        "Sales ledger",
        "And other standard due diligence materials",
      ]},
      { type: "heading", text: "How to upload" },
      { type: "paragraph", text: "Navigate to the target company, go to the Documents tab, and drag and drop files or click to browse. Valoxi accepts common file formats including PDF, Excel, and Word documents." },
      { type: "heading", text: "What happens next — the AI screening workflow" },
      { type: "numbered", items: [
        "Classification — Valoxi automatically identifies the type of each document (e.g. \"Profit & Loss Statement\") using AI",
        "Extraction — Structured financial data is extracted from the document and saved",
        "Normalisation — Revenue, cost, and balance sheet figures are standardised so they can feed directly into the Deal Modeller",
        "Phase 1 Screening — Once all required document types have been uploaded and processed, Valoxi automatically triggers the first stage of Expert Analysis",
      ]},
      { type: "tip", text: "You do not need to trigger these steps manually — they run automatically as soon as the required documents are in place." },
    ],
  },
  {
    id: "expert-analysis",
    title: "Expert Analysis",
    slug: "expert-analysis",
    category: "Target Companies",
    categoryId: "target-companies",
    excerpt: "AI-generated multi-dimensional assessment of each target.",
    content: [
      { type: "paragraph", text: "The Analysis tab provides a structured, AI-generated assessment of the target company across multiple dimensions. This is available on the Professional plan and above." },
      { type: "heading", text: "Analysis Layers" },
      {
        type: "table",
        headers: ["Layer", "Analysis"],
        rows: [
          { cells: ["Foundation", "Data Quality, Initial Screening"] },
          { cells: ["Layer 1", "Financial, Operational, Risk"] },
          { cells: ["Layer 2", "Quality of Earnings, Sector"] },
          { cells: ["Layer 3", "Valuation, Deal Structure"] },
          { cells: ["Layer 4", "Synthesis (overall recommendation)"] },
        ],
      },
      { type: "paragraph", text: "Each dimension produces a written assessment with supporting data points, ratings, and flags. The Explain button next to any finding lets you ask the AI a follow-up question to get deeper context on a specific point." },
      { type: "paragraph", text: "The Synthesis output at the end brings all dimensions together into a final deal verdict and overall recommendation." },
    ],
  },
  {
    id: "deal-modeller",
    title: "Deal Modeller",
    slug: "deal-modeller",
    category: "Target Companies",
    categoryId: "target-companies",
    excerpt: "Structure enterprise value, funding, and offer terms.",
    content: [
      { type: "paragraph", text: "The Deal Modeller tab is where you structure the financial terms of the deal. It is available in a simplified form on the Core plan, and in its full version on Professional and above." },
      { type: "heading", text: "Key sections" },
      { type: "bullet", items: [
        "Enterprise Value — set your target enterprise value and adjust the assumptions that drive it (e.g. EBITDA multiple, revenue multiple)",
        "Funding Structure — define how the deal will be funded, including cash at completion, bank debt, deferred payments, and earn-outs",
        "Offer Structuring — model the cash consideration payable to the seller at different funding scenarios",
        "P&L Summary — see the projected impact of the deal terms on the combined business's profitability in the years following completion",
        "Viability — an assessment of whether the business can service its post-acquisition debt obligations, including key coverage ratios",
      ]},
      { type: "heading", text: "Version History" },
      { type: "paragraph", text: "On the Professional plan, you can save multiple versions of your deal model (up to 5 versions, with 90 days of history) so you can compare different scenarios side by side. The Expert plan increases this to 20 versions with 180 days of history." },
    ],
  },
  {
    id: "value-creation",
    title: "Value Creation",
    slug: "value-creation",
    category: "Target Companies",
    categoryId: "target-companies",
    excerpt: "Model post-acquisition growth, scenarios, and returns.",
    content: [
      { type: "paragraph", text: "The Value Creation tab focuses on what the business could be worth after your ownership, rather than at the point of acquisition. This tab is available on the Expert plan." },
      { type: "heading", text: "Key features" },
      { type: "bullet", items: [
        "Growth Modelling — set assumptions for revenue growth, margin improvement, and cost synergies across a 5-year projection period",
        "Scenario Analysis — test how sensitive your projected returns are to changes in key inputs. Results are displayed as a heat map",
        "Exit Scenario — model the likely exit value of the business at the end of your hold period, based on prevailing market multiples",
        "Returns — view projected IRR (Internal Rate of Return) and MoM (Money-on-Money multiple, also referred to as MOIC) across different scenarios",
        "Waterfall — a visual breakdown of how exit proceeds would be distributed, reflecting the priority order of different financing instruments",
      ]},
    ],
  },
  {
    id: "setting-up-portal",
    title: "Setting Up a Portal Link",
    slug: "setting-up-portal",
    category: "Seller Portal",
    categoryId: "seller-portal",
    excerpt: "Create and send a secure document collection link.",
    content: [
      { type: "paragraph", text: "The Seller Portal is a secure, standalone web page that you send to a contact at the target company. It allows them to upload documents and (if required) sign an NDA — without needing to create a Valoxi account." },
      { type: "heading", text: "Steps to create a portal link" },
      { type: "numbered", items: [
        "Go to Portal Management in the left-hand sidebar",
        "Click Create Portal Link and select the target company and the primary contact you want to send it to",
        "Optionally add a personalised message that the contact will see when they open the portal",
        "Choose whether to require the contact to sign a Non-Disclosure Agreement before they can upload any documents",
        "Click Generate Link. Valoxi sends an email to the contact with their secure, unique access link",
      ]},
      { type: "tip", text: "Each link is time-limited and tied to a specific contact, so you maintain full control over who can access the portal and for how long." },
    ],
  },
  {
    id: "nda-signing",
    title: "NDA Signing",
    slug: "nda-signing",
    category: "Seller Portal",
    categoryId: "seller-portal",
    excerpt: "How sellers electronically sign NDAs before uploading documents.",
    content: [
      { type: "paragraph", text: "If you enabled NDA signing when creating the portal link, the contact must complete this step before they can upload any documents." },
      { type: "heading", text: "The process from the contact's perspective" },
      { type: "numbered", items: [
        "They open their portal link and are presented with the NDA document",
        "They must scroll through the full document before the acceptance option becomes available",
        "They check the agreement box and type their full name as their electronic signature",
        "The system records their name, the timestamp, and their IP address",
        "A signed PDF copy is generated automatically and made available to download immediately. A copy is also stored securely in the platform",
      ]},
      { type: "paragraph", text: "Once the NDA is signed, the contact proceeds to the document upload section." },
    ],
  },
  {
    id: "document-submission",
    title: "Document Submission (Seller View)",
    slug: "document-submission",
    category: "Seller Portal",
    categoryId: "seller-portal",
    excerpt: "What sellers see when they open the portal and upload files.",
    content: [
      { type: "paragraph", text: "Inside the portal, the contact sees a structured checklist of the documents you are requesting. Each category (e.g. \"Profit & Loss\", \"Balance Sheet\", \"Asset Register\") has a clearly labelled upload area." },
      { type: "paragraph", text: "The contact uploads files by dragging them into the relevant category or clicking to browse their computer. A progress bar at the top of the page shows how many of the required document types have been successfully submitted and processed, giving the seller a clear sense of completion." },
    ],
  },
  {
    id: "monitoring-progress",
    title: "Monitoring Progress",
    slug: "monitoring-progress",
    category: "Seller Portal",
    categoryId: "seller-portal",
    excerpt: "Track seller submissions and configure automated reminders.",
    content: [
      { type: "paragraph", text: "Once a contact has been given portal access, you can track their progress from inside the target company profile and from the Portal Management page. You will see which document types have been submitted, which are still outstanding, and whether the AI has successfully processed each file." },
      { type: "heading", text: "Automated chase-ups" },
      { type: "paragraph", text: "You can configure the portal to send automatic reminder emails to the contact if they have not completed their submissions within a set number of days. The system sends a gentle reminder first, escalating to a more urgent follow-up if documents remain outstanding after the second deadline." },
    ],
  },
  {
    id: "portal-management-overview",
    title: "Portal Management Overview",
    slug: "portal-management-overview",
    category: "Portal Management",
    categoryId: "portal-management",
    excerpt: "Central view of all Seller Portal links across your targets.",
    content: [
      { type: "paragraph", text: "The Portal Management page gives you a central view of all the Seller Portal links you have created across all your target companies." },
      { type: "heading", text: "From this page you can" },
      { type: "bullet", items: [
        "See the total number of portal links you have active",
        "Track how many contacts have submitted documents",
        "Review the status of each individual portal link (active, expired, or completed)",
        "Create new portal links directly from the page",
        "Delete or deactivate links that are no longer needed",
      ]},
      { type: "paragraph", text: "This page is especially useful when you have multiple live deal processes running simultaneously and need a consolidated view of where each target is in the document collection process." },
    ],
  },
  {
    id: "contacts",
    title: "Contacts",
    slug: "contacts",
    category: "Contacts & Team",
    categoryId: "contacts-team",
    excerpt: "Manage individuals linked to your deals.",
    content: [
      { type: "paragraph", text: "The Contacts page is a directory of all the individuals linked to your deals — founders, business owners, advisers, and any other contacts you have added. You can associate contacts with specific target companies and record their role in the process." },
    ],
  },
  {
    id: "team-management",
    title: "Team Management",
    slug: "team-management",
    category: "Contacts & Team",
    categoryId: "contacts-team",
    excerpt: "Invite colleagues and manage workspace access.",
    content: [
      { type: "paragraph", text: "The Team page allows company admins to invite colleagues and manage their access to the workspace." },
      { type: "heading", text: "To invite a new team member" },
      { type: "numbered", items: [
        "Go to Team in the sidebar",
        "Click Invite Member and enter their email address",
        "They will receive an invitation email with a link to set up their account",
      ]},
      { type: "paragraph", text: "Team members can collaborate on target company profiles, view the pipeline, and contribute to deal analysis. The number of seats available depends on your subscription plan." },
    ],
  },
  {
    id: "profile-settings",
    title: "Profile & Security",
    slug: "profile-settings",
    category: "Account & Billing",
    categoryId: "account-billing",
    excerpt: "Update your personal profile and manage security settings.",
    content: [
      { type: "paragraph", text: "Update your first name, last name, and job title from the Profile section." },
      { type: "paragraph", text: "To change your password, use the Security section on the same page. If your organisation uses Clerk for authentication, you can also manage your active sessions and connected accounts from here." },
    ],
  },
  {
    id: "company-settings",
    title: "Company Settings",
    slug: "company-settings",
    category: "Account & Billing",
    categoryId: "account-billing",
    excerpt: "Admin-only settings for your organisation.",
    content: [
      { type: "paragraph", text: "Company administrators can update the following settings. Changes are applied across the entire workspace for all team members." },
      { type: "bullet", items: [
        "Company Name",
        "Industry — select from a predefined list of sectors",
        "Company Size",
        "Country of Operation — UK or US (this affects certain financial formatting and regulatory references throughout the platform)",
        "Business contact details — email, phone, and address",
      ]},
    ],
  },
  {
    id: "subscription-plans",
    title: "Subscription Plans",
    slug: "subscription-plans",
    category: "Account & Billing",
    categoryId: "account-billing",
    excerpt: "Core, Professional, and Expert plans explained.",
    content: [
      { type: "paragraph", text: "Valoxi offers three plans, each designed for a different level of deal activity. Annual billing is available at a 20% discount across all plans." },
      {
        type: "table",
        headers: ["Plan", "Price", "Key Features"],
        rows: [
          { cells: ["Core", "$87/month", "Up to 5 active targets, 1 GB storage, simplified Deal Modeller, Seller Portal, email support"] },
          { cells: ["Professional", "$167/month", "Up to 15 active targets, 10 GB storage, full Deal Modeller with 5 versions, Expert Deep-Dive Analysis, DD Data Room, onboarding call"] },
          { cells: ["Expert", "$397/month", "Up to 50 active targets, 25 GB storage, Deal Modeller with 20 versions, Value Creation Modeller, Heads of Terms builder, white-label portal, API access"] },
        ],
      },
      { type: "heading", text: "Add-ons" },
      { type: "paragraph", text: "If you need more than your plan includes, you can purchase additional capacity:" },
      { type: "bullet", items: [
        "Extra Seats — add more team members beyond the plan default",
        "Extra Company Slots — add more active target slots if you exceed your plan's limit",
      ]},
    ],
  },
  {
    id: "managing-subscription",
    title: "Managing Your Subscription",
    slug: "managing-subscription",
    category: "Account & Billing",
    categoryId: "account-billing",
    excerpt: "Upgrades, downgrades, invoices, and payment methods.",
    content: [
      { type: "paragraph", text: "From the Billing page, you can:" },
      { type: "bullet", items: [
        "View your current plan and renewal date",
        "Upgrade or downgrade your plan",
        "Add or remove seats and company slots",
        "Update your payment method",
        "Download past invoices",
      ]},
      { type: "paragraph", text: "Clicking Manage Subscription opens the Stripe customer portal, where all payment-related actions are handled securely." },
      { type: "heading", text: "Promotional Benefits" },
      { type: "paragraph", text: "If you joined Valoxi during a promotional period (such as an Early Bird offer or community partnership), any active benefits and their expiry dates are displayed at the top of the Billing page." },
    ],
  },
];

export function getArticleBySlug(slug: string): HelpArticle | undefined {
  return articles.find((a) => a.slug === slug);
}

export function getArticlesByCategory(categoryId: string): HelpArticle[] {
  return articles.filter((a) => a.categoryId === categoryId);
}

export function searchArticles(query: string): HelpArticle[] {
  const q = query.toLowerCase();
  return articles.filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      a.excerpt.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q) ||
      a.content.some(
        (block) =>
          (block.text && block.text.toLowerCase().includes(q)) ||
          (block.items && block.items.some((item) => item.toLowerCase().includes(q)))
      )
  );
}
