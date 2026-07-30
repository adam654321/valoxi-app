# Pipeline Fidelity: TC 220 (Canoports UK Limited)

**Dev TC ID**: 1883  
**Prod TC ID**: 220  
**Industry**: Manufacturing  
**Sub-sector**: Metal Fabrication & Welding  
**Audit date**: 2026-07-30  

---

## Phase 1 — Document Cloning

**Dev DB host**: helium  
**Prod DB host**: ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech  

| Prod ID | Dev ID | Filename | Category | Type | Size | R2 Key | HEAD OK |
|---|---|---|---|---|---|---|---|
| 1521 | 5892 | Canoports_Company_Accounts_FY26.pdf | Company Accounts | pdf | 6828 | `companies/220/doc-1783111602195-571600881.pdf` | ✓ |
| 1522 | 5893 | Canoports_YTD_Balance_Sheet.pdf | YTD Balance Sheet | pdf | 4853 | `companies/220/doc-1783111615066-242378147.pdf` | ✓ |
| 1535 | 5894 | Canoports_Company_Accounts_FY24.pdf | Company Accounts | pdf | 4510 | `companies/220/doc-1783153881605-945901845.pdf` | ✓ |
| 1536 | 5895 | Canoports_Company_Accounts_FY23.pdf | Company Accounts | pdf | 4760 | `companies/220/doc-1783153894157-473886272.pdf` | ✓ |
| 1537 | 5896 | Canoports_Company_Accounts_FY22.pdf | Company Accounts | pdf | 3044 | `companies/220/doc-1783153906598-767648853.pdf` | ✓ |
| 1540 | 5897 | Canoports_Sales_Ledger.pdf | Sales Ledger | pdf | 4901 | `companies/220/doc-1783154018711-492050023.pdf` | ✓ |
| 1541 | 5898 | Canoports_Asset_Register (1).pdf | Asset Register | pdf | 5002 | `companies/220/doc-1783154900390-668752262.pdf` | ✓ |
| 1542 | 5899 | Canoports_Staff_Matrix (1).pdf | Staff Matrix | pdf | 6307 | `companies/220/doc-1783154907393-627077613.pdf` | ✓ |
| 1543 | 5900 | Canoports_YTD_Profit_and_Loss.pdf | YTD Profit & Loss | pdf | 6460 | `companies/220/doc-1783154915000-431657599.pdf` | ✓ |

---

## Phase 2 — Classification & Extraction


**Before state**: 0 periods, 0 IS rows, 0 BS rows


### Doc 1521 → dev 5892: `Canoports_Company_Accounts_FY26.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1254 | company_accounts | Thu Jul 30 2026 01:44:54 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1255 | profit_and_loss | Thu Jul 30 2026 01:44:54 GMT+0000 (Coordinated Universal Time) | 2025, 2026 | ✓ | ✓ | ✓ | ✗ |
| 1256 | balance_sheet | Thu Jul 30 2026 01:44:54 GMT+0000 (Coordinated Universal Time) | 2025, 2026 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 2

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8011 | management | 2025 | 2025-05-31 | true | 12 | information_memorandum | 5892 |
| 8012 | management | 2026 | 2026-05-31 | true | 12 | information_memorandum | 5892 |


### Doc 1522 → dev 5893: `Canoports_YTD_Balance_Sheet.pdf`

**Category**: YTD Balance Sheet  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 1 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1257 | balance_sheet | Thu Jul 30 2026 01:45:03 GMT+0000 (Coordinated Universal Time) | 2025, 2026 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 2

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8013 | management | 2025 | 2025-05-31 | true | 12 | information_memorandum | 5892 |
| 8014 | management | 2026 | 2026-05-31 | true | 12 | information_memorandum | 5892 |


**Changed periods**: 2 — see raw/phase2-doc-5893-before-after.json


### Doc 1535 → dev 5894: `Canoports_Company_Accounts_FY24.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1258 | company_accounts | Thu Jul 30 2026 01:45:18 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1259 | profit_and_loss | Thu Jul 30 2026 01:45:18 GMT+0000 (Coordinated Universal Time) | 2024 | ✓ | ✓ | ✓ | ✗ |
| 1260 | balance_sheet | Thu Jul 30 2026 01:45:18 GMT+0000 (Coordinated Universal Time) | 2024 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8015 | statutory | 2024 | 2024-05-31 | true | 12 | statutory | 5894 |


**Changed periods**: 4 — see raw/phase2-doc-5894-before-after.json


### Doc 1536 → dev 5895: `Canoports_Company_Accounts_FY23.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1261 | company_accounts | Thu Jul 30 2026 01:45:31 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1262 | profit_and_loss | Thu Jul 30 2026 01:45:31 GMT+0000 (Coordinated Universal Time) | 2023 | ✓ | ✓ | ✓ | ✗ |
| 1263 | balance_sheet | Thu Jul 30 2026 01:45:31 GMT+0000 (Coordinated Universal Time) | 2023 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8016 | management | 2023 | 2023-05-31 | true | 12 | information_memorandum | 5895 |


**Changed periods**: 5 — see raw/phase2-doc-5895-before-after.json


### Doc 1537 → dev 5896: `Canoports_Company_Accounts_FY22.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1264 | company_accounts | Thu Jul 30 2026 01:45:45 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1265 | profit_and_loss | Thu Jul 30 2026 01:45:45 GMT+0000 (Coordinated Universal Time) | 2022 | ✓ | ✓ | ✓ | ✗ |
| 1266 | balance_sheet | Thu Jul 30 2026 01:45:45 GMT+0000 (Coordinated Universal Time) | 2022 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8018 | management | 2022 | 2022-05-31 | true | 12 | information_memorandum | 5896 |


**Changed periods**: 6 — see raw/phase2-doc-5896-before-after.json


### Doc 1540 → dev 5897: `Canoports_Sales_Ledger.pdf`

**Category**: Sales Ledger  **Type**: application/pdf  **Status**: `produced_structure_all_nulls`  

**Reason**: 1 result row(s) but no year data  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1267 | sales_ledger | Thu Jul 30 2026 01:45:50 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


### Doc 1541 → dev 5898: `Canoports_Asset_Register (1).pdf`

**Category**: Asset Register  **Type**: application/pdf  **Status**: `produced_structure_all_nulls`  

**Reason**: 1 result row(s) but no year data  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1268 | asset_register | Thu Jul 30 2026 01:45:58 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


### Doc 1542 → dev 5899: `Canoports_Staff_Matrix (1).pdf`

**Category**: Staff Matrix  **Type**: application/pdf  **Status**: `produced_structure_all_nulls`  

**Reason**: 1 result row(s) but no year data  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1269 | staff_matrix | Thu Jul 30 2026 01:46:04 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


**Changed periods**: 1 — see raw/phase2-doc-5899-before-after.json


### Doc 1543 → dev 5900: `Canoports_YTD_Profit_and_Loss.pdf`

**Category**: YTD Profit & Loss  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 1 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1270 | profit_and_loss | Thu Jul 30 2026 01:46:17 GMT+0000 (Coordinated Universal Time) | 2025, 2026, 2027, 2028 | ✓ | ✓ | ✓ | ✗ |


**New periods created**: 2

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8019 | management | 2027 | 2027-05-31 | false | null | null | 5900 |
| 8020 | management | 2028 | 2028-05-31 | false | null | null | 5900 |


**Changed periods**: 7 — see raw/phase2-doc-5900-before-after.json


---

### Phase 2 Final State


**Final**: 9 periods, 9 IS rows, 6 BS rows


| Period id | period_type | fiscal_year | period_end | is_full_year | months | source_tier | IS rows | BS rows |
|---|---|---|---|---|---|---|---|---|
| 8011 | management | 2025 | 2025-05-31 | false | 12 | information_memorandum | 1 | 1 |
| 8012 | management | 2026 | 2026-05-31 | false | 12 | information_memorandum | 1 | 1 |
| 8013 | management | 2025 | 2025-05-31 | true | 12 | information_memorandum | 1 | 1 |
| 8014 | management | 2026 | 2026-05-31 | true | 12 | information_memorandum | 1 | 1 |
| 8015 | statutory | 2024 | 2024-05-31 | true | 12 | statutory | 1 | 1 |
| 8016 | management | 2023 | 2023-05-31 | true | 12 | information_memorandum | 1 | 1 |
| 8019 | management | 2027 | 2027-05-31 | false | — | null | 1 | 0 |
| 8020 | management | 2028 | 2028-05-31 | false | — | null | 1 | 0 |
| 8018 | management | 2022 | 2022-05-31 | true | 12 | information_memorandum | 1 | 0 |


**Usable EBITDA years** (full-year, non-IM): 2024  


---

## Phase 3 — Expert Analysis


**Expert results**: 8 records



### Expert: synthesis (id=881)

**Status**: success  **Score**: —  **Confidence**: —  **Time**: 24327ms  


### Expert: risk (id=876)

**Status**: success  **Score**: 78  **Confidence**: medium  **Time**: 7059ms  


### Expert: operational (id=875)

**Status**: success  **Score**: 72  **Confidence**: medium  **Time**: 8987ms  


### Expert: financial (id=874)

**Status**: success  **Score**: 72  **Confidence**: medium  **Time**: 9055ms  


**Yearly EBITDA from financial expert**:

- 2024: EBITDA=£1626170  revenue=£14010534  op_profit=£1322241  


### Expert: sector (id=878)

**Status**: success  **Score**: 68  **Confidence**: high  **Time**: 7105ms  


### Expert: qoe (id=877)

**Status**: success  **Score**: 75  **Confidence**: high  **Time**: 10112ms  


**QoE Summary**:

- Total add-backs: 2
- Total deductions: 1


| Item | Type | Category | Amount | Recurrence | Defensibility |
|---|---|---|---|---|---|

| undefined | add_back | one_off_cost | £284357 | one_off | 9 |

| undefined | add_back | one_off_cost | £17715 | one_off | 9 |

| undefined | deduction | replacement_salary | £64525 | recurring | 7 |


**Adjusted EBITDA scenarios**:

- Conservative: £1863717
- Base: £1863717
- Optimistic: £1928242


*Base EBITDA: £—  + Add-backs: £—  – Deductions: £—  = £—*  


### Expert: valuation (id=879)

**Status**: success  **Score**: 82  **Confidence**: high  **Time**: 10652ms  


**Valuation figures**: multiple=undefined range=[undefined–undefined]  

adjusted_ebitda_base: £—  

Bridge: EV=£— +cash=£— -LTD=£— -DL=£— -WC=£— → offer=£—  


### Expert: deal_structure (id=880)

**Status**: success  **Score**: 78  **Confidence**: high  **Time**: 13177ms  


### 3.4 Figure Traceability Check


**Reconciled EBITDA by year (input)**: {"2024":1626170}


All key figures traceable to input (or no mismatch detected).


### 3.5 Database Writes


Expert analysis writes to: **expert_analysis_results** table only.  

No writes to deal_model_adjustments, ebitda_adjustments, valuations, or financial tables during Phase 3.  

(deal_model_adjustments are created at deal model creation time in Phase 4.)


---

## Phase 4 — Deal Model


**Model id**: 492  **Name**: Audit Model — TC 220  

**Stored columns**:

- averagingYears: 3
- ebitdaMultiple: 5

- calculated_ebitda: null
- adjusted_ebitda: 1863717

- enterprise_value: 9318585
- offer_driver: ebitda

- target_offer_price: null
- total_purchase_price: null

- is_locked: false



### 4.2 EBITDA Years


**All available years**: 2024 (1 total)

**Averaging window** (N=3): years=2024


| Year | Reported EBITDA |
|---|---|

| 2024 | £1626170 |


**Sum**: £1626170.00  **÷1**  = **£1626170.00** raw average  

**Calculator averageAdjustedEbitda**: £1626170  

**Reconciles to raw avg**: roughly (adjustments applied below)  


### 4.3 Adjustments (3 rows)


| id | type | category | description | amount | amounts_by_year | status | is_accepted |
|---|---|---|---|---|---|---|---|

| 2056 | add_back | one_off_cost | Non-recurring items | £284357 | {"2022":0,"2023":0,"2024":284357,"2025":0,"2026":0,"2027":0,"2028":0} | suggested | false |

| 2057 | add_back | one_off_cost | Extraordinary Items | £17715 | {"2022":0,"2023":0,"2024":17715,"2025":0,"2026":0,"2027":0,"2028":0} | suggested | false |

| 2058 | deduction | replacement_salary | Director Salary Market Rate Adjustment | £64525 | — | suggested | false |


*Note: amounts above are the stored amounts. The calculator applies year-specific overrides from amounts_by_year if set.*  

**Calculator averageAdjustedEbitda**: £1626170  


### 4.4 Enterprise Value & Offer Price Bridge


| Line | Amount |
|---|---|

| Average Adjusted EBITDA | £1626170 |

| × Multiple (5) | £8130850 |

| + Excess Cash | £2951434 |

| + Property Value | £0 |

| – Primary Debt | £3867 |

| – Other Debt | £0 |

| – Corp Tax Due | £381336 |

| – Working Capital Adj | £0 |

| **Offer Price** | **£10697081** |


**Bridge check**: 10697081.00 vs stored 10697081 → ✓ RECONCILES  


### 4.5 Offer Document


**Doc id**: 115  **Status**: draft  

**Figures in offer document**:

- offerPrice: —
- enterpriseValue: —

- averageEbitda (raw): £—
- ebitdaMultiple: —

- Breakdown: `undefined`



### 4.6 Faithfulness Verdict


**YES** — the deal model uses verified financial periods extracted from submitted documents. 1 fiscal year(s) fed the average (2024).  

