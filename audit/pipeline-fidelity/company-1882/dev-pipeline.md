# Pipeline Fidelity: TC 137 (MANOR BUILDING SOLUTIONS (UK) LTD)

**Dev TC ID**: 1882  
**Prod TC ID**: 137  
**Industry**: Construction & Building  
**Sub-sector**: Commercial Construction  
**Audit date**: 2026-07-30  

---

## Phase 1 — Document Cloning

**Dev DB host**: helium  
**Prod DB host**: ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech  

| Prod ID | Dev ID | Filename | Category | Type | Size | R2 Key | HEAD OK |
|---|---|---|---|---|---|---|---|
| 844 | 5884 | Manor Building Solutions 2023-2024 accounts.pdf | Company Accounts | pdf | 25848 | `companies/137/doc-1778762835534-224681364.pdf` | ✓ |
| 845 | 5885 | Manor Building Solutions 2024-2025 accounts.pdf | Company Accounts | pdf | 25935 | `companies/137/doc-1778762871273-49146718.pdf` | ✓ |
| 846 | 5886 | HPM304_Information_Memorandum_Manor_Building_Solutions_(UK)_Ltd_1.pdf | Deal Documents | pdf | 1393998 | `companies/137/doc-1778762918053-236828570.pdf` | ✓ |
| 1299 | 5887 | Manor 2025-26 draft accounts.pdf | Company Accounts | pdf | 32888 | `companies/137/doc-1781535664647-511389281.pdf` | ✓ |
| 1310 | 5888 | Staff Organisation 2026-06-16 172912.png | Staff Matrix | png | 70911 | `companies/137/doc-1781629035894-757641589.png` | ✓ |
| 1312 | 5889 | Fixed Assets.xlsm | Asset Register | vnd.ms-excel.sheet.macroEnabled.12 | 9625 | `companies/137/doc-1781629257930-589578561.xlsm` | ✓ |
| 1596 | 5890 | Manor Building Solutions YTD P&L.pdf | Deal Documents | pdf | 211271 | `companies/137/doc-1783613615639-259551387.pdf` | ✓ |
| 1597 | 5891 | Manor Building Solutions YTD Balance Sheet.pdf | YTD Balance Sheet | pdf | 204124 | `companies/137/doc-1783613637890-211287282.pdf` | ✓ |

---

## Phase 2 — Classification & Extraction


**Before state**: 0 periods, 0 IS rows, 0 BS rows


### Doc 844 → dev 5884: `Manor Building Solutions 2023-2024 accounts.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1238 | company_accounts | Thu Jul 30 2026 01:38:53 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1239 | profit_and_loss | Thu Jul 30 2026 01:38:53 GMT+0000 (Coordinated Universal Time) | 2023, 2024 | ✓ | ✓ | ✓ | ✗ |
| 1240 | balance_sheet | Thu Jul 30 2026 01:38:53 GMT+0000 (Coordinated Universal Time) | 2023, 2024 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 2

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8000 | statutory | 2024 | 2024-03-31 | true | 12 | statutory | 5884 |
| 7999 | statutory | 2023 | 2023-03-31 | true | 12 | statutory | 5884 |


### Doc 845 → dev 5885: `Manor Building Solutions 2024-2025 accounts.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1241 | company_accounts | Thu Jul 30 2026 01:39:14 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1242 | profit_and_loss | Thu Jul 30 2026 01:39:14 GMT+0000 (Coordinated Universal Time) | 2024, 2025 | ✓ | ✓ | ✓ | ✗ |
| 1243 | balance_sheet | Thu Jul 30 2026 01:39:14 GMT+0000 (Coordinated Universal Time) | 2024, 2025 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8001 | statutory | 2025 | 2025-03-31 | true | 12 | statutory | 5885 |


**Changed periods**: 2 — see raw/phase2-doc-5885-before-after.json


### Doc 846 → dev 5886: `HPM304_Information_Memorandum_Manor_Building_Solutions_(UK)_Ltd_1.pdf`

**Category**: Deal Documents  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1244 | company_accounts | Thu Jul 30 2026 01:39:52 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1245 | profit_and_loss | Thu Jul 30 2026 01:39:52 GMT+0000 (Coordinated Universal Time) | 2023, 2024, 2025, 2026 | ✓ | ✓ | ✓ | ✗ |
| 1246 | balance_sheet | Thu Jul 30 2026 01:39:53 GMT+0000 (Coordinated Universal Time) | 2023, 2024, 2025, 2026 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8005 | management | 2026 | 2026-03-31 | true | 12 | information_memorandum | 5886 |


**Changed periods**: 3 — see raw/phase2-doc-5886-before-after.json


### Doc 1299 → dev 5887: `Manor 2025-26 draft accounts.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1247 | company_accounts | Thu Jul 30 2026 01:40:14 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1248 | profit_and_loss | Thu Jul 30 2026 01:40:14 GMT+0000 (Coordinated Universal Time) | 2025, 2026 | ✓ | ✓ | ✓ | ✗ |
| 1249 | balance_sheet | Thu Jul 30 2026 01:40:15 GMT+0000 (Coordinated Universal Time) | 2025, 2026 | ✗ | ✗ | ✗ | ✗ |


**Changed periods**: 4 — see raw/phase2-doc-5887-before-after.json


### Doc 1310 → dev 5888: `Staff Organisation 2026-06-16 172912.png`

**Category**: Staff Matrix  **Type**: image/png  **Status**: `produced_structure_all_nulls`  

**Reason**: 1 result row(s) but no year data  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1250 | staff_matrix | Thu Jul 30 2026 01:40:23 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8009 | management | 2026 | 2026-07-30 | false | null | null | 5888 |


### Doc 1312 → dev 5889: `Fixed Assets.xlsm`

**Category**: Asset Register  **Type**: application/vnd.ms-excel.sheet.macroEnabled.12  **Status**: `produced_structure_all_nulls`  

**Reason**: 1 result row(s) but no year data  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1251 | asset_register | Thu Jul 30 2026 01:40:30 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


### Doc 1596 → dev 5890: `Manor Building Solutions YTD P&L.pdf`

**Category**: Deal Documents  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 1 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1252 | profit_and_loss | Thu Jul 30 2026 01:40:42 GMT+0000 (Coordinated Universal Time) | 2026, 2027 | ✓ | ✓ | ✓ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8010 | management | 2027 | 2027-03-31 | false | 11 | null | 5890 |


**Changed periods**: 5 — see raw/phase2-doc-5890-before-after.json


### Doc 1597 → dev 5891: `Manor Building Solutions YTD Balance Sheet.pdf`

**Category**: YTD Balance Sheet  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 1 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1253 | balance_sheet | Thu Jul 30 2026 01:40:55 GMT+0000 (Coordinated Universal Time) | 2026, 2027 | ✗ | ✗ | ✗ | ✗ |


**Changed periods**: 5 — see raw/phase2-doc-5891-before-after.json


---

### Phase 2 Final State


**Final**: 6 periods, 6 IS rows, 5 BS rows


| Period id | period_type | fiscal_year | period_end | is_full_year | months | source_tier | IS rows | BS rows |
|---|---|---|---|---|---|---|---|---|
| 8010 | management | 2027 | 2027-03-31 | false | 11 | null | 1 | 0 |
| 8005 | statutory | 2026 | 2026-03-31 | true | 12 | statutory | 1 | 1 |
| 8009 | management | 2026 | 2026-04-30 | false | 1 | management | 1 | 1 |
| 7999 | statutory | 2023 | 2023-03-31 | true | 12 | statutory | 1 | 1 |
| 8000 | statutory | 2024 | 2024-03-31 | true | 12 | statutory | 1 | 1 |
| 8001 | statutory | 2025 | 2025-03-31 | true | 12 | statutory | 1 | 1 |


**Usable EBITDA years** (full-year, non-IM): 2026, 2023, 2024, 2025  


---

## Phase 3 — Expert Analysis


**Expert results**: 8 records



### Expert: operational (id=834)

**Status**: success  **Score**: 68  **Confidence**: high  **Time**: 11985ms  


### Expert: sector (id=837)

**Status**: success  **Score**: 52  **Confidence**: medium  **Time**: 7094ms  


### Expert: risk (id=835)

**Status**: success  **Score**: 72  **Confidence**: medium  **Time**: 9678ms  


### Expert: financial (id=833)

**Status**: success  **Score**: 82  **Confidence**: high  **Time**: 12290ms  


**Yearly EBITDA from financial expert**:

- 2023: EBITDA=£49760  revenue=£651586  op_profit=£33358  

- 2024: EBITDA=£174747  revenue=£1453661  op_profit=£157753  

- 2025: EBITDA=£489389  revenue=£2084318  op_profit=£464671  

- 2026: EBITDA=£471870  revenue=£2388764  op_profit=£453123  


### Expert: qoe (id=836)

**Status**: success  **Score**: 72  **Confidence**: high  **Time**: 10961ms  


**QoE Summary**:

- Total add-backs: 1
- Total deductions: 3


| Item | Type | Category | Amount | Recurrence | Defensibility |
|---|---|---|---|---|---|

| undefined | add_back | one_off_cost | £-5500 | one_off | 9 |

| undefined | deduction | replacement_salary | £44930 | recurring | 8 |

| undefined | deduction | replacement_salary | £29930 | recurring | 8 |

| undefined | deduction | deferred_maintenance | £15000 | recurring | 6 |


**Adjusted EBITDA scenarios**:

- Conservative: £376510
- Base: £376510
- Optimistic: £391510


*Base EBITDA: £—  + Add-backs: £—  – Deductions: £—  = £—*  


### Expert: valuation (id=838)

**Status**: success  **Score**: 78  **Confidence**: high  **Time**: 10209ms  


**Valuation figures**: multiple=undefined range=[undefined–undefined]  

adjusted_ebitda_base: £—  

Bridge: EV=£— +cash=£— -LTD=£— -DL=£— -WC=£— → offer=£—  


### Expert: deal_structure (id=839)

**Status**: success  **Score**: 74  **Confidence**: high  **Time**: 15558ms  


### Expert: synthesis (id=840)

**Status**: success  **Score**: —  **Confidence**: —  **Time**: 17050ms  


### 3.4 Figure Traceability Check


**Reconciled EBITDA by year (input)**: {"2023":49760,"2024":174747,"2025":489389,"2026":471870}


All key figures traceable to input (or no mismatch detected).


### 3.5 Database Writes


Expert analysis writes to: **expert_analysis_results** table only.  

No writes to deal_model_adjustments, ebitda_adjustments, valuations, or financial tables during Phase 3.  

(deal_model_adjustments are created at deal model creation time in Phase 4.)


---

## Phase 4 — Deal Model


**Model id**: 491  **Name**: Audit Model — TC 137  

**Stored columns**:

- averagingYears: 3
- ebitdaMultiple: 2.75

- calculated_ebitda: null
- adjusted_ebitda: 376510

- enterprise_value: 1035402.5
- offer_driver: ebitda

- target_offer_price: null
- total_purchase_price: null

- is_locked: false



### 4.2 EBITDA Years


**All available years**: 2026, 2025, 2024, 2023 (4 total)

**Averaging window** (N=3): years=2026, 2025, 2024


| Year | Reported EBITDA |
|---|---|

| 2026 | £471870 |

| 2025 | £489389 |

| 2024 | £174747 |


**Sum**: £1136006.00  **÷3**  = **£378668.67** raw average  

**Calculator averageAdjustedEbitda**: £378668.6666666667  

**Reconciles to raw avg**: roughly (adjustments applied below)  


### 4.3 Adjustments (4 rows)


| id | type | category | description | amount | amounts_by_year | status | is_accepted |
|---|---|---|---|---|---|---|---|

| 2052 | add_back | one_off_cost | Other Operating Income (Non-Trading) | £-5500 | {"2023":0,"2024":0,"2025":0,"2026":-5500,"2027":0} | suggested | false |

| 2053 | deduction | replacement_salary | Director Salary Normalisation (MD) | £44930 | — | suggested | false |

| 2054 | deduction | replacement_salary | Director Salary Normalisation (Ops Director) | £29930 | — | suggested | false |

| 2055 | deduction | deferred_maintenance | Deferred Maintenance / Fleet Replacement Provision | £15000 | — | suggested | false |


*Note: amounts above are the stored amounts. The calculator applies year-specific overrides from amounts_by_year if set.*  

**Calculator averageAdjustedEbitda**: £378668.6666666667  


### 4.4 Enterprise Value & Offer Price Bridge


| Line | Amount |
|---|---|

| Average Adjusted EBITDA | £378668.6666666667 |

| × Multiple (2.75) | £1041338.8333333334 |

| + Excess Cash | £460444 |

| + Property Value | £0 |

| – Primary Debt | £0 |

| – Other Debt | £-159863 |

| – Corp Tax Due | £112405.43 |

| – Working Capital Adj | £84639 |

| **Offer Price** | **£1464601.4033333333** |


**Bridge check**: 1464601.40 vs stored 1464601.4033333333 → ✓ RECONCILES  


### 4.5 Offer Document


**Doc id**: 114  **Status**: draft  

**Figures in offer document**:

- offerPrice: —
- enterpriseValue: —

- averageEbitda (raw): £—
- ebitdaMultiple: —

- Breakdown: `undefined`



### 4.6 Faithfulness Verdict


**YES** — the deal model uses verified financial periods extracted from submitted documents. 3 fiscal year(s) fed the average (2026, 2025, 2024).  

