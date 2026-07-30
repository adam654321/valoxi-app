# Pipeline Fidelity: TC 138 (Cooper Gibson)

**Dev TC ID**: 1881  
**Prod TC ID**: 138  
**Industry**: Professional Services  
**Sub-sector**: Business Consulting & Advisory  
**Audit date**: 2026-07-30  

---

## Phase 1 — Document Cloning

**Dev DB host**: helium  
**Prod DB host**: ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech  

| Prod ID | Dev ID | Filename | Category | Type | Size | R2 Key | HEAD OK |
|---|---|---|---|---|---|---|---|
| 848 | 5873 | IM - 163009.pdf | Deal Documents | pdf | 2082278 | `companies/138/doc-1778838673399-328152625.pdf` | ✓ |
| 849 | 5874 | Cooper-Gibson Limited AC and CT ye 29.02.2024.pdf | Company Accounts | pdf | 118101 | `companies/138/doc-1778838689011-823319302.pdf` | ✓ |
| 851 | 5875 | CGRProfitandLoss1Mar24.pdf | Company Accounts | pdf | 40179 | `companies/138/doc-1778838746863-404999227.pdf` | ✓ |
| 852 | 5876 | CompanyOverview-end28.2.25.pdf | Deal Documents | pdf | 35253 | `companies/138/doc-1778838776011-725630720.pdf` | ✓ |
| 853 | 5877 | FS_Cooper-GibsonLimited_28022025.pdf | Company Accounts | pdf | 73405 | `companies/138/doc-1778838798393-104382606.pdf` | ✓ |
| 854 | 5878 | YE23 Accounts.pdf | Company Accounts | pdf | 182192 | `companies/138/doc-1778838811755-535012742.pdf` | ✓ |
| 1335 | 5879 | Cooper-Gibson Ltd AC and CT ye 29.02.26._final.pdf | Company Accounts | pdf | 109852 | `companies/138/doc-1782036715100-291703953.pdf` | ✓ |
| 1432 | 5880 | FYTDBalanceSheet_25.6.26.pdf | YTD Balance Sheet | pdf | 37383 | `companies/138/doc-1782760216464-656399555.pdf` | ✓ |
| 1433 | 5881 | FYTD_ProfitandLoss_25.6.26.pdf | Deal Documents | pdf | 35681 | `companies/138/doc-1782760240362-645911187.pdf` | ✓ |
| 1434 | 5882 | Cooper-Gibson Ltd_Sales by Customer Summary_LastFYto28.2.26.xlsx | Sales Ledger | vnd.openxmlformats-officedocument.spreadsheetml.sheet | 10347 | `companies/138/doc-1782760262433-615318484.xlsx` | ✓ |
| 1435 | 5883 | Cooper-Gibson Ltd_Sales by Customer Summary_1.3.26-25.6.26.xlsx | Deal Documents | vnd.openxmlformats-officedocument.spreadsheetml.sheet | 10099 | `companies/138/doc-1782760273763-234847667.xlsx` | ✓ |

---

## Phase 2 — Classification & Extraction


**Before state**: 0 periods, 0 IS rows, 0 BS rows


### Doc 848 → dev 5873: `IM - 163009.pdf`

**Category**: Deal Documents  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1213 | company_accounts | Thu Jul 30 2026 01:33:07 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1214 | profit_and_loss | Thu Jul 30 2026 01:33:07 GMT+0000 (Coordinated Universal Time) | 2022, 2023, 2024, 2025 | ✓ | ✓ | ✓ | ✗ |
| 1215 | balance_sheet | Thu Jul 30 2026 01:33:07 GMT+0000 (Coordinated Universal Time) | 2022, 2023, 2024, 2025 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 4

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7983 | management | 2025 | 2025-02-28 | true | 12 | information_memorandum | 5873 |
| 7980 | management | 2022 | 2022-02-28 | true | 12 | information_memorandum | 5873 |
| 7981 | management | 2023 | 2023-02-28 | true | 12 | information_memorandum | 5873 |
| 7982 | management | 2024 | 2024-02-29 | true | 12 | information_memorandum | 5873 |


### Doc 849 → dev 5874: `Cooper-Gibson Limited AC and CT ye 29.02.2024.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1216 | company_accounts | Thu Jul 30 2026 01:33:30 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1217 | profit_and_loss | Thu Jul 30 2026 01:33:30 GMT+0000 (Coordinated Universal Time) | 2023, 2024 | ✓ | ✓ | ✓ | ✗ |
| 1218 | balance_sheet | Thu Jul 30 2026 01:33:30 GMT+0000 (Coordinated Universal Time) | 2023, 2024 | ✗ | ✗ | ✗ | ✗ |


**Changed periods**: 4 — see raw/phase2-doc-5874-before-after.json


### Doc 851 → dev 5875: `CGRProfitandLoss1Mar24.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1219 | company_accounts | Thu Jul 30 2026 01:33:43 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1220 | profit_and_loss | Thu Jul 30 2026 01:33:43 GMT+0000 (Coordinated Universal Time) | 2024 | ✓ | ✓ | ✗ | ✗ |
| 1221 | balance_sheet | Thu Jul 30 2026 01:33:43 GMT+0000 (Coordinated Universal Time) | 2024 | ✗ | ✗ | ✗ | ✗ |


**Changed periods**: 4 — see raw/phase2-doc-5875-before-after.json


### Doc 852 → dev 5876: `CompanyOverview-end28.2.25.pdf`

**Category**: Deal Documents  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1222 | company_accounts | Thu Jul 30 2026 01:33:57 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1223 | profit_and_loss | Thu Jul 30 2026 01:33:57 GMT+0000 (Coordinated Universal Time) | 2025 | ✓ | ✓ | ✗ | ✗ |
| 1224 | balance_sheet | Thu Jul 30 2026 01:33:57 GMT+0000 (Coordinated Universal Time) | 2025 | ✗ | ✗ | ✗ | ✗ |


**Changed periods**: 4 — see raw/phase2-doc-5876-before-after.json


### Doc 853 → dev 5877: `FS_Cooper-GibsonLimited_28022025.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1225 | company_accounts | Thu Jul 30 2026 01:34:17 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1226 | profit_and_loss | Thu Jul 30 2026 01:34:17 GMT+0000 (Coordinated Universal Time) | 2024, 2025 | ✓ | ✓ | ✓ | ✗ |
| 1227 | balance_sheet | Thu Jul 30 2026 01:34:17 GMT+0000 (Coordinated Universal Time) | 2024, 2025 | ✗ | ✗ | ✗ | ✗ |


**Changed periods**: 4 — see raw/phase2-doc-5877-before-after.json


### Doc 854 → dev 5878: `YE23 Accounts.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1228 | company_accounts | Thu Jul 30 2026 01:34:39 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1229 | profit_and_loss | Thu Jul 30 2026 01:34:39 GMT+0000 (Coordinated Universal Time) | 2022, 2023 | ✓ | ✓ | ✓ | ✗ |
| 1230 | balance_sheet | Thu Jul 30 2026 01:34:39 GMT+0000 (Coordinated Universal Time) | 2022, 2023 | ✗ | ✗ | ✗ | ✗ |


**Changed periods**: 4 — see raw/phase2-doc-5878-before-after.json


### Doc 1335 → dev 5879: `Cooper-Gibson Ltd AC and CT ye 29.02.26._final.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1231 | company_accounts | Thu Jul 30 2026 01:35:01 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1232 | profit_and_loss | Thu Jul 30 2026 01:35:01 GMT+0000 (Coordinated Universal Time) | 2025, 2026 | ✓ | ✓ | ✓ | ✗ |
| 1233 | balance_sheet | Thu Jul 30 2026 01:35:01 GMT+0000 (Coordinated Universal Time) | 2025, 2026 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7997 | statutory | 2026 | 2026-02-28 | true | 12 | statutory | 5879 |


**Changed periods**: 4 — see raw/phase2-doc-5879-before-after.json


### Doc 1432 → dev 5880: `FYTDBalanceSheet_25.6.26.pdf`

**Category**: YTD Balance Sheet  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 1 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1234 | balance_sheet | Thu Jul 30 2026 01:35:09 GMT+0000 (Coordinated Universal Time) | 2026 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7998 | management | 2026 | 2026-06-25 | false | 3 | management | 5880 |


**Changed periods**: 5 — see raw/phase2-doc-5880-before-after.json


### Doc 1433 → dev 5881: `FYTD_ProfitandLoss_25.6.26.pdf`

**Category**: Deal Documents  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 1 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1235 | profit_and_loss | Thu Jul 30 2026 01:35:16 GMT+0000 (Coordinated Universal Time) | 2026 | ✓ | ✓ | ✗ | ✗ |


**Changed periods**: 6 — see raw/phase2-doc-5881-before-after.json


### Doc 1434 → dev 5882: `Cooper-Gibson Ltd_Sales by Customer Summary_LastFYto28.2.26.xlsx`

**Category**: Sales Ledger  **Type**: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet  **Status**: `produced_structure_all_nulls`  

**Reason**: 1 result row(s) but no year data  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1236 | sales_ledger | Thu Jul 30 2026 01:35:21 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


### Doc 1435 → dev 5883: `Cooper-Gibson Ltd_Sales by Customer Summary_1.3.26-25.6.26.xlsx`

**Category**: Deal Documents  **Type**: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet  **Status**: `produced_structure_all_nulls`  

**Reason**: 1 result row(s) but no year data  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1237 | sales_ledger | Thu Jul 30 2026 01:35:26 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


---

### Phase 2 Final State


**Final**: 6 periods, 6 IS rows, 6 BS rows


| Period id | period_type | fiscal_year | period_end | is_full_year | months | source_tier | IS rows | BS rows |
|---|---|---|---|---|---|---|---|---|
| 7982 | statutory | 2024 | 2024-02-29 | true | 12 | statutory | 1 | 1 |
| 7983 | statutory | 2025 | 2025-02-28 | true | 12 | statutory | 1 | 1 |
| 7980 | statutory | 2022 | 2022-03-31 | true | 12 | statutory | 1 | 1 |
| 7981 | statutory | 2023 | 2023-03-31 | true | 12 | statutory | 1 | 1 |
| 7997 | statutory | 2026 | 2026-02-28 | true | 12 | statutory | 1 | 1 |
| 7998 | management | 2026 | 2026-06-25 | false | 4 | information_memorandum | 1 | 1 |


**Usable EBITDA years** (full-year, non-IM): 2024, 2025, 2022, 2023, 2026  


---

## Phase 3 — Expert Analysis


**Expert results**: 8 records



### Expert: synthesis (id=832)

**Status**: success  **Score**: —  **Confidence**: —  **Time**: 17680ms  


### Expert: risk (id=827)

**Status**: success  **Score**: 45  **Confidence**: medium  **Time**: 10783ms  


### Expert: operational (id=826)

**Status**: success  **Score**: 58  **Confidence**: medium  **Time**: 10789ms  


### Expert: financial (id=825)

**Status**: success  **Score**: 62  **Confidence**: high  **Time**: 13499ms  


**Yearly EBITDA from financial expert**:

- 2022: EBITDA=£14679  revenue=£367925  op_profit=£14064  

- 2023: EBITDA=£18202  revenue=£314775  op_profit=£17739  

- 2024: EBITDA=£118171  revenue=£326227  op_profit=£117531  

- 2025: EBITDA=£221671  revenue=£441073  op_profit=£221372  

- 2026: EBITDA=£57012  revenue=£223404  op_profit=£49479  


### Expert: sector (id=829)

**Status**: success  **Score**: 68  **Confidence**: medium  **Time**: 6309ms  


### Expert: qoe (id=828)

**Status**: success  **Score**: 45  **Confidence**: medium  **Time**: 11161ms  


**QoE Summary**:

- Total add-backs: 3
- Total deductions: 2


| Item | Type | Category | Amount | Recurrence | Defensibility |
|---|---|---|---|---|---|

| undefined | add_back | disposal_loss | £2761 | one_off | 10 |

| undefined | add_back | owner_salary | £24000 | recurring | 9 |

| undefined | add_back | personal_expense | £312 | recurring | 8 |

| undefined | deduction | replacement_salary | £44930 | recurring | 8 |

| undefined | deduction | unsustainable_revenue | £44681 | recurring | 5 |


**Adjusted EBITDA scenarios**:

- Conservative: £-5529
- Base: £-5526
- Optimistic: £39154


*Base EBITDA: £—  + Add-backs: £—  – Deductions: £—  = £—*  


### Expert: valuation (id=830)

**Status**: success  **Score**: 42  **Confidence**: low  **Time**: 8695ms  


**Valuation figures**: multiple=undefined range=[undefined–undefined]  

adjusted_ebitda_base: £—  

Bridge: EV=£— +cash=£— -LTD=£— -DL=£— -WC=£— → offer=£—  


### Expert: deal_structure (id=831)

**Status**: success  **Score**: 35  **Confidence**: high  **Time**: 13074ms  


### 3.4 Figure Traceability Check


**Reconciled EBITDA by year (input)**: {"2022":14679,"2023":18202,"2024":118171,"2025":221671,"2026":57012}


All key figures traceable to input (or no mismatch detected).


### 3.5 Database Writes


Expert analysis writes to: **expert_analysis_results** table only.  

No writes to deal_model_adjustments, ebitda_adjustments, valuations, or financial tables during Phase 3.  

(deal_model_adjustments are created at deal model creation time in Phase 4.)


---

## Phase 4 — Deal Model


**Model id**: 490  **Name**: Audit Model — TC 138  

**Stored columns**:

- averagingYears: 3
- ebitdaMultiple: 2

- calculated_ebitda: null
- adjusted_ebitda: -5526

- enterprise_value: null
- offer_driver: ebitda

- target_offer_price: null
- total_purchase_price: null

- is_locked: false



### 4.2 EBITDA Years


**All available years**: 2026, 2025, 2024, 2023, 2022 (5 total)

**Averaging window** (N=3): years=2026, 2025, 2024


| Year | Reported EBITDA |
|---|---|

| 2026 | £57012 |

| 2025 | £221671 |

| 2024 | £118171 |


**Sum**: £396854.00  **÷3**  = **£132284.67** raw average  

**Calculator averageAdjustedEbitda**: £132284.66666666666  

**Reconciles to raw avg**: roughly (adjustments applied below)  


### 4.3 Adjustments (5 rows)


| id | type | category | description | amount | amounts_by_year | status | is_accepted |
|---|---|---|---|---|---|---|---|

| 2047 | add_back | one_off_cost | Loss on disposal of tangible fixed assets | £2761 | {"2022":0,"2023":0,"2024":0,"2025":0,"2026":2761} | suggested | false |

| 2048 | add_back | owner_salary_excess | Directors Pension Contributions | £24000 | — | suggested | false |

| 2049 | add_back | personal_expense | Use of Home as Office | £312 | — | suggested | false |

| 2050 | deduction | replacement_salary | Replacement Management Salary Adjustment | £44930 | — | suggested | false |

| 2051 | deduction | unsustainable_revenue | Revenue Concentration Risk Adjustment | £44681 | — | suggested | false |


*Note: amounts above are the stored amounts. The calculator applies year-specific overrides from amounts_by_year if set.*  

**Calculator averageAdjustedEbitda**: £132284.66666666666  


### 4.4 Enterprise Value & Offer Price Bridge


| Line | Amount |
|---|---|

| Average Adjusted EBITDA | £132284.66666666666 |

| × Multiple (2) | £264569.3333333333 |

| + Excess Cash | £195634 |

| + Property Value | £0 |

| – Primary Debt | £0 |

| – Other Debt | £149587.37 |

| – Corp Tax Due | £87.81 |

| – Working Capital Adj | £10107 |

| **Offer Price** | **£300421.1533333333** |


**Bridge check**: 300421.15 vs stored 300421.1533333333 → ✓ RECONCILES  


### 4.5 Offer Document


**Doc id**: 113  **Status**: draft  

**Figures in offer document**:

- offerPrice: —
- enterpriseValue: —

- averageEbitda (raw): £—
- ebitdaMultiple: —

- Breakdown: `undefined`



### 4.6 Faithfulness Verdict


**YES** — the deal model uses verified financial periods extracted from submitted documents. 3 fiscal year(s) fed the average (2026, 2025, 2024).  


---

## Phase 5 — Determinism Control

See determinism/138-run-diff.md. Noise floor: £55.00

