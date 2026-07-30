# Pipeline Fidelity: TC 130 (Keen As Mustard)

**Dev TC ID**: 1918  
**Prod TC ID**: 130  
**Industry**: Media, Marketing & Creative  
**Sub-sector**: Branding & Design Agencies  
**Audit date**: 2026-07-30  

---

## Phase 1 — Document Cloning

**Dev DB host**: helium  
**Prod DB host**: ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech  

| Prod ID | Dev ID | Filename | Category | Type | Size | R2 Key | HEAD OK |
|---|---|---|---|---|---|---|---|
| 747 | 5942 | ProjectRiver.pdf | Deal Documents | pdf | 7140311 | `companies/130/doc-1778252106325-550318593.pdf` | ✓ |
| 748 | 5943 | RiverUpdate.pdf | Deal Documents | pdf | 37879 | `companies/130/doc-1778252373543-960763146.pdf` | ✓ |
| 749 | 5944 | Keen As Mustard Marketing Ltd - Limited Company Accounts 30.11.24[87].pdf | Company Accounts | pdf | 240944 | `companies/130/doc-1778252389462-276579290.pdf` | ✓ |
| 750 | 5945 | Copy of Client income 24-25.xlsx | Company Accounts | vnd.openxmlformats-officedocument.spreadsheetml.sheet | 18526 | `companies/130/doc-1778252407825-352867235.xlsx` | ✓ |
| 751 | 5946 | Copy of Client income 23-24.xlsx | Company Accounts | vnd.openxmlformats-officedocument.spreadsheetml.sheet | 16788 | `companies/130/doc-1778252420654-508662059.xlsx` | ✓ |
| 862 | 5947 | Keen as Mustard Marketing Ltd - MA 31.8.25.pdf | Deal Documents | pdf | 313052 | `companies/130/doc-1778855718053-449324318.pdf` | ✓ |
| 863 | 5948 | Keen as Mustard Marketing Ltd - MA 31.5.25.pdf | Deal Documents | pdf | 283259 | `companies/130/doc-1778855730274-88747200.pdf` | ✓ |
| 864 | 5949 | Keen as Mustard Marketing Ltd - MA 30.11.25.pdf | Deal Documents | pdf | 314246 | `companies/130/doc-1778855744378-985876393.pdf` | ✓ |
| 865 | 5950 | KEENASMUST-Limited company accounts 20.1-LTD- YE 30.11.21.PDF | Deal Documents | pdf | 20583 | `companies/130/doc-1778855764041-747022787.pdf` | ✓ |
| 866 | 5951 | Full Company Accounts YE 30.11.2023 - KAM Ltd.PDF | Deal Documents | pdf | 22239 | `companies/130/doc-1778855784404-478903916.pdf` | ✓ |
| 867 | 5952 | Full Company Accounts YE 30.11.2022 - KAM Ltd.PDF | Deal Documents | pdf | 22150 | `companies/130/doc-1778855808030-260968986.pdf` | ✓ |
| 868 | 5953 | KEENASMUST-Limited company accounts 20.1-LTD- YE 30.11.21.PDF | Deal Documents | pdf | 20583 | `companies/130/doc-1778855825125-207172519.pdf` | ✓ |

---

## Phase 2 — Classification & Extraction


**Before state**: 0 periods, 0 IS rows, 0 BS rows


### Doc 747 → dev 5942: `ProjectRiver.pdf`

**Category**: Deal Documents  **Type**: application/pdf  **Status**: `produced_nothing`  

**Reason**: webhook_status=classification_complete  **Webhook**: `classification_complete`  


### Doc 748 → dev 5943: `RiverUpdate.pdf`

**Category**: Deal Documents  **Type**: application/pdf  **Status**: `produced_nothing`  

**Reason**: webhook_status=classification_complete  **Webhook**: `classification_complete`  


### Doc 749 → dev 5944: `Keen As Mustard Marketing Ltd - Limited Company Accounts 30.11.24[87].pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1310 | company_accounts | Thu Jul 30 2026 02:04:47 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1311 | profit_and_loss | Thu Jul 30 2026 02:04:47 GMT+0000 (Coordinated Universal Time) | 2023, 2024 | ✓ | ✓ | ✓ | ✗ |
| 1312 | balance_sheet | Thu Jul 30 2026 02:04:48 GMT+0000 (Coordinated Universal Time) | 2023, 2024 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 2

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8072 | statutory | 2024 | 2024-11-30 | true | 12 | statutory | 5944 |
| 8071 | statutory | 2023 | 2023-11-30 | true | 12 | statutory | 5944 |


### Doc 750 → dev 5945: `Copy of Client income 24-25.xlsx`

**Category**: Company Accounts  **Type**: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1313 | company_accounts | Thu Jul 30 2026 02:05:00 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1314 | profit_and_loss | Thu Jul 30 2026 02:05:00 GMT+0000 (Coordinated Universal Time) | 2025 | ✓ | ✗ | ✗ | ✗ |
| 1315 | balance_sheet | Thu Jul 30 2026 02:05:00 GMT+0000 (Coordinated Universal Time) | 2025 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8073 | management | 2025 | 2025-11-30 | true | 12 | management | 5945 |


**Changed periods**: 2 — see raw/phase2-doc-5945-before-after.json


### Doc 751 → dev 5946: `Copy of Client income 23-24.xlsx`

**Category**: Company Accounts  **Type**: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1316 | company_accounts | Thu Jul 30 2026 02:05:14 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1317 | profit_and_loss | Thu Jul 30 2026 02:05:14 GMT+0000 (Coordinated Universal Time) | 2023, 2024 | ✓ | ✗ | ✗ | ✗ |
| 1318 | balance_sheet | Thu Jul 30 2026 02:05:14 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8074 | management | 2023 | 2023-12-31 | false | 1 | management | 5946 |


**Changed periods**: 3 — see raw/phase2-doc-5946-before-after.json


### Doc 862 → dev 5947: `Keen as Mustard Marketing Ltd - MA 31.8.25.pdf`

**Category**: Deal Documents  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1319 | company_accounts | Thu Jul 30 2026 02:05:37 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1320 | profit_and_loss | Thu Jul 30 2026 02:05:37 GMT+0000 (Coordinated Universal Time) | 2025 | ✓ | ✓ | ✓ | ✗ |
| 1321 | balance_sheet | Thu Jul 30 2026 02:05:37 GMT+0000 (Coordinated Universal Time) | 2025 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8076 | management | 2025 | 2025-08-31 | false | 9 | information_memorandum | 5947 |


**Changed periods**: 4 — see raw/phase2-doc-5947-before-after.json


### Doc 863 → dev 5948: `Keen as Mustard Marketing Ltd - MA 31.5.25.pdf`

**Category**: Deal Documents  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1322 | company_accounts | Thu Jul 30 2026 02:05:59 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1323 | profit_and_loss | Thu Jul 30 2026 02:05:59 GMT+0000 (Coordinated Universal Time) | 2025 | ✓ | ✓ | ✗ | ✗ |
| 1324 | balance_sheet | Thu Jul 30 2026 02:05:59 GMT+0000 (Coordinated Universal Time) | 2025 | ✗ | ✗ | ✗ | ✗ |


**Changed periods**: 5 — see raw/phase2-doc-5948-before-after.json


### Doc 864 → dev 5949: `Keen as Mustard Marketing Ltd - MA 30.11.25.pdf`

**Category**: Deal Documents  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1325 | company_accounts | Thu Jul 30 2026 02:06:29 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1326 | profit_and_loss | Thu Jul 30 2026 02:06:29 GMT+0000 (Coordinated Universal Time) | 2025 | ✓ | ✓ | ✓ | ✗ |
| 1327 | balance_sheet | Thu Jul 30 2026 02:06:30 GMT+0000 (Coordinated Universal Time) | 2025 | ✗ | ✗ | ✗ | ✗ |


**Changed periods**: 5 — see raw/phase2-doc-5949-before-after.json


### Doc 865 → dev 5950: `KEENASMUST-Limited company accounts 20.1-LTD- YE 30.11.21.PDF`

**Category**: Deal Documents  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1328 | company_accounts | Thu Jul 30 2026 02:06:50 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1329 | profit_and_loss | Thu Jul 30 2026 02:06:50 GMT+0000 (Coordinated Universal Time) | 2020, 2021 | ✓ | ✓ | ✓ | ✗ |
| 1330 | balance_sheet | Thu Jul 30 2026 02:06:51 GMT+0000 (Coordinated Universal Time) | 2020, 2021 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 2

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8078 | management | 2021 | 2021-11-30 | true | 12 | information_memorandum | 5950 |
| 8077 | management | 2020 | 2020-11-30 | true | 12 | information_memorandum | 5950 |


**Changed periods**: 5 — see raw/phase2-doc-5950-before-after.json


### Doc 866 → dev 5951: `Full Company Accounts YE 30.11.2023 - KAM Ltd.PDF`

**Category**: Deal Documents  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1331 | company_accounts | Thu Jul 30 2026 02:07:11 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1332 | profit_and_loss | Thu Jul 30 2026 02:07:11 GMT+0000 (Coordinated Universal Time) | 2022, 2023 | ✓ | ✓ | ✓ | ✗ |
| 1333 | balance_sheet | Thu Jul 30 2026 02:07:12 GMT+0000 (Coordinated Universal Time) | 2022, 2023 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8081 | management | 2022 | 2022-11-30 | true | 12 | information_memorandum | 5951 |


**Changed periods**: 7 — see raw/phase2-doc-5951-before-after.json


### Doc 867 → dev 5952: `Full Company Accounts YE 30.11.2022 - KAM Ltd.PDF`

**Category**: Deal Documents  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1334 | company_accounts | Thu Jul 30 2026 02:07:34 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1335 | profit_and_loss | Thu Jul 30 2026 02:07:34 GMT+0000 (Coordinated Universal Time) | 2021, 2022 | ✓ | ✓ | ✓ | ✗ |
| 1336 | balance_sheet | Thu Jul 30 2026 02:07:34 GMT+0000 (Coordinated Universal Time) | 2021, 2022 | ✗ | ✗ | ✗ | ✗ |


**Changed periods**: 8 — see raw/phase2-doc-5952-before-after.json


### Doc 868 → dev 5953: `KEENASMUST-Limited company accounts 20.1-LTD- YE 30.11.21.PDF`

**Category**: Deal Documents  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1337 | company_accounts | Thu Jul 30 2026 02:07:53 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1338 | profit_and_loss | Thu Jul 30 2026 02:07:53 GMT+0000 (Coordinated Universal Time) | 2020, 2021 | ✓ | ✓ | ✓ | ✗ |
| 1339 | balance_sheet | Thu Jul 30 2026 02:07:53 GMT+0000 (Coordinated Universal Time) | 2020, 2021 | ✗ | ✗ | ✗ | ✗ |


**Changed periods**: 8 — see raw/phase2-doc-5953-before-after.json


---

### Phase 2 Final State


**Final**: 8 periods, 8 IS rows, 7 BS rows


| Period id | period_type | fiscal_year | period_end | is_full_year | months | source_tier | IS rows | BS rows |
|---|---|---|---|---|---|---|---|---|
| 8071 | statutory | 2023 | 2023-11-30 | true | 12 | statutory | 1 | 1 |
| 8072 | statutory | 2024 | 2024-11-30 | true | 12 | statutory | 1 | 1 |
| 8076 | management | 2025 | 2025-05-31 | false | 6 | information_memorandum | 1 | 1 |
| 8073 | management | 2025 | 2025-11-30 | true | 12 | management | 1 | 1 |
| 8074 | management | 2023 | 2023-12-31 | false | 1 | management | 1 | 0 |
| 8077 | management | 2020 | 2020-11-30 | true | 12 | information_memorandum | 1 | 1 |
| 8078 | management | 2021 | 2021-11-30 | true | 12 | information_memorandum | 1 | 1 |
| 8081 | management | 2022 | 2022-11-30 | true | 12 | information_memorandum | 1 | 1 |


**Usable EBITDA years** (full-year, non-IM): 2023, 2024, 2025  


---

## Phase 3 — Expert Analysis


**Expert results**: 8 records



### Expert: qoe (id=909)

**Status**: success  **Score**: 68  **Confidence**: high  **Time**: 8461ms  


**QoE Summary**:

- Total add-backs: 0
- Total deductions: 2


| Item | Type | Category | Amount | Recurrence | Defensibility |
|---|---|---|---|---|---|

| undefined | deduction | replacement_salary | £39500 | recurring | 9 |

| undefined | deduction | deferred_maintenance | £1000 | recurring | 6 |


**Adjusted EBITDA scenarios**:

- Conservative: £157306
- Base: £157306
- Optimistic: £157306


*Base EBITDA: £—  + Add-backs: £—  – Deductions: £—  = £—*  


### Expert: sector (id=910)

**Status**: success  **Score**: 62  **Confidence**: medium  **Time**: 7050ms  


### Expert: financial (id=906)

**Status**: success  **Score**: 72  **Confidence**: high  **Time**: 8880ms  


**Yearly EBITDA from financial expert**:

- 2023: EBITDA=£125862  revenue=£396623  op_profit=£125714  

- 2024: EBITDA=£197806  revenue=£436233  op_profit=£197695  

- 2025: EBITDA=£0  revenue=£358524.86  op_profit=£—  


### Expert: risk (id=908)

**Status**: success  **Score**: 72  **Confidence**: medium  **Time**: 10451ms  


### Expert: operational (id=907)

**Status**: success  **Score**: 62  **Confidence**: medium  **Time**: 13190ms  


### Expert: valuation (id=911)

**Status**: success  **Score**: 74  **Confidence**: medium  **Time**: 9601ms  


**Valuation figures**: multiple=undefined range=[undefined–undefined]  

adjusted_ebitda_base: £—  

Bridge: EV=£— +cash=£— -LTD=£— -DL=£— -WC=£— → offer=£—  


### Expert: deal_structure (id=912)

**Status**: success  **Score**: 65  **Confidence**: high  **Time**: 13003ms  


### Expert: synthesis (id=913)

**Status**: success  **Score**: —  **Confidence**: —  **Time**: 16350ms  


### 3.4 Figure Traceability Check


**Reconciled EBITDA by year (input)**: {"2023":125862,"2024":197806,"2025":0}


All key figures traceable to input (or no mismatch detected).


### 3.5 Database Writes


Expert analysis writes to: **expert_analysis_results** table only.  

No writes to deal_model_adjustments, ebitda_adjustments, valuations, or financial tables during Phase 3.  

(deal_model_adjustments are created at deal model creation time in Phase 4.)


---

## Phase 4 — Deal Model


**Model id**: 495  **Name**: Audit Model — TC 130  

**Stored columns**:

- averagingYears: 3
- ebitdaMultiple: 2.5

- calculated_ebitda: null
- adjusted_ebitda: 157306

- enterprise_value: 393265
- offer_driver: ebitda

- target_offer_price: null
- total_purchase_price: null

- is_locked: false



### 4.2 EBITDA Years


**All available years**: 2025, 2024, 2023 (3 total)

**Averaging window** (N=3): years=2025, 2024, 2023


| Year | Reported EBITDA |
|---|---|

| 2025 | £0 |

| 2024 | £197806 |

| 2023 | £125862 |


**Sum**: £323668.00  **÷3**  = **£107889.33** raw average  

**Calculator averageAdjustedEbitda**: £107889.33333333333  

**Reconciles to raw avg**: roughly (adjustments applied below)  


### 4.3 Adjustments (2 rows)


| id | type | category | description | amount | amounts_by_year | status | is_accepted |
|---|---|---|---|---|---|---|---|

| 2067 | deduction | replacement_salary | Director Replacement Salary Adjustment | £39500 | — | suggested | false |

| 2068 | deduction | deferred_maintenance | Provision for Maintenance Capex | £1000 | — | suggested | false |


*Note: amounts above are the stored amounts. The calculator applies year-specific overrides from amounts_by_year if set.*  

**Calculator averageAdjustedEbitda**: £107889.33333333333  


### 4.4 Enterprise Value & Offer Price Bridge


| Line | Amount |
|---|---|

| Average Adjusted EBITDA | £107889.33333333333 |

| × Multiple (2.5) | £269723.3333333333 |

| + Excess Cash | £0 |

| + Property Value | £0 |

| – Primary Debt | £6519 |

| – Other Debt | £0 |

| – Corp Tax Due | £0 |

| – Working Capital Adj | £0 |

| **Offer Price** | **£263204.3333333333** |


**Bridge check**: 263204.33 vs stored 263204.3333333333 → ✓ RECONCILES  


### 4.5 Offer Document


**Doc id**: 118  **Status**: draft  

**Figures in offer document**:

- offerPrice: —
- enterpriseValue: —

- averageEbitda (raw): £—
- ebitdaMultiple: —

- Breakdown: `undefined`



### 4.6 Faithfulness Verdict


**YES** — the deal model uses verified financial periods extracted from submitted documents. 3 fiscal year(s) fed the average (2025, 2024, 2023).  

