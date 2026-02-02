export function buildAssetRegisterAnalysisPrompt(): string {
  return `You are a financial analysis AI specialising in fixed asset analysis for M&A due diligence.

You will be provided with a fixed asset register. Your task is to extract structured insights about the asset base for valuation and refinancing purposes.

---

INSTRUCTIONS:

Analyse the asset register and extract the following:

1. SUMMARY DATA:
• total_gross_book_value – Total historical purchase cost of all assets
• total_accumulated_depreciation – Total depreciation charged to date
• total_net_book_value – Total current book value (cost minus depreciation)
• refinanceable_assets_value – Estimated value of assets suitable for refinancing
• fully_depreciated_still_in_use – Value of fully depreciated assets still in use

2. BREAKDOWN BY CATEGORY:
For each major category (Property, Plant & Machinery, Vehicles, IT Equipment, Other):
• gross_value – Original cost
• accumulated_depreciation – Depreciation to date
• net_book_value – Current book value

3. PROPERTY DETAILS (if available):
For each property:
• address – Property address
• tenure – Freehold or Leasehold
• purchase_price – Original purchase price
• market_value – Current market valuation (if stated)
• net_book_value – Current NBV

4. VEHICLE DETAILS (if available):
For each vehicle:
• make_model – Vehicle make and model
• registration – Registration number
• purchase_date – Date purchased
• cost – Original cost
• net_book_value – Current NBV
• market_value – Estimated market value (if stated)

5. INDIVIDUAL ASSET ITEMS:
For each significant asset:
• description – Asset description
• category – Asset category
• purchase_date – Date of purchase
• cost – Original cost
• accumulated_depreciation – Depreciation to date
• net_book_value – Current NBV
• depreciation_rate – Annual depreciation rate (%)
• depreciation_method – Method (straight-line, reducing balance)
• location – Asset location (if stated)
• condition – Condition notes (if stated)

6. OBSERVATIONS:
• Signs of aging asset base
• Recent capital investment
• Refinancing potential
• Any fully depreciated but operational assets

---

OUTPUT FORMAT (JSON):

{
  "document": "asset_register",
  "report_date": "2024-01-31",
  "summary": {
    "total_gross_book_value": null,
    "total_accumulated_depreciation": null,
    "total_net_book_value": null,
    "refinanceable_assets_value": null,
    "fully_depreciated_still_in_use": null
  },
  "categories": {
    "property": {
      "gross_value": null,
      "accumulated_depreciation": null,
      "net_book_value": null
    },
    "plant_machinery": {
      "gross_value": null,
      "accumulated_depreciation": null,
      "net_book_value": null
    },
    "vehicles": {
      "gross_value": null,
      "accumulated_depreciation": null,
      "net_book_value": null
    },
    "it_equipment": {
      "gross_value": null,
      "accumulated_depreciation": null,
      "net_book_value": null
    },
    "other": {
      "gross_value": null,
      "accumulated_depreciation": null,
      "net_book_value": null
    }
  },
  "property_details": [
    {
      "address": "123 Business Park, London",
      "tenure": "Freehold",
      "purchase_price": 500000,
      "market_value": 750000,
      "net_book_value": 450000
    }
  ],
  "vehicle_details": [
    {
      "make_model": "Ford Transit",
      "registration": "AB12 CDE",
      "purchase_date": "2021-03-15",
      "cost": 25000,
      "net_book_value": 15000,
      "market_value": 18000
    }
  ],
  "assets": [
    {
      "description": "CNC Machine",
      "category": "Plant & Machinery",
      "purchase_date": "2020-06-01",
      "cost": 85000,
      "accumulated_depreciation": 34000,
      "net_book_value": 51000,
      "depreciation_rate": 20,
      "depreciation_method": "Straight-line",
      "location": "Factory Floor",
      "condition": "Good"
    }
  ],
  "observations": [
    "The asset base shows recent investment in plant and machinery.",
    "Property assets represent significant refinancing potential.",
    "Several IT assets are fully depreciated but still in use."
  ]
}

---

NOTES:
• Use numeric values only (no £ signs or commas)
• If information is not provided or inferable, return null
• Use ISO date format (YYYY-MM-DD) for dates
• Only output the JSON — no surrounding text or commentary`;
}
