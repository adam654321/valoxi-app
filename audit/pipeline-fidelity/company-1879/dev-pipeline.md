# Pipeline Fidelity: TC 172 (Ideal scaffolding)

**Dev TC ID**: 1879  
**Prod TC ID**: 172  
**Industry**: Construction & Building  
**Sub-sector**: Scaffolding & Access  
**Audit date**: 2026-07-30  

---

## Phase 1 — Document Cloning

**Dev DB host**: helium  
**Prod DB host**: ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech  

| Prod ID | Dev ID | Filename | Category | Type | Size | R2 Key | HEAD OK |
|---|---|---|---|---|---|---|---|
| 1418 | 5845 | staff matrix.pdf | Staff Matrix | pdf | 202179 | `companies/172/doc-1782745506616-343766368.pdf` | ✓ |
| 1419 | 5846 | Aged Creditors.pdf | Deal Documents | pdf | 46389 | `companies/172/doc-1782745536494-290817100.pdf` | ✓ |
| 1420 | 5847 | Balance sheet.pdf | YTD Balance Sheet | pdf | 35258 | `companies/172/doc-1782745553429-98334794.pdf` | ✓ |
| 1421 | 5848 | PNL.pdf | YTD Profit & Loss | pdf | 37601 | `companies/172/doc-1782745572400-43519776.pdf` | ✓ |
| 1422 | 5849 | draft year end 25.pdf | Company Accounts | pdf | 167993 | `companies/172/doc-1782745600050-281519454.pdf` | ✓ |
| 1423 | 5850 | year end 23.pdf | Company Accounts | pdf | 177855 | `companies/172/doc-1782745615640-147464204.pdf` | ✓ |
| 1424 | 5851 | year end 24.pdf | Company Accounts | pdf | 362236 | `companies/172/doc-1782745628074-406531217.pdf` | ✓ |
| 1427 | 5852 | Aged Debtors.pdf | Deal Documents | pdf | 40949 | `companies/172/doc-1782745745753-152767478.pdf` | ✓ |
| 1428 | 5853 | Top 10 Customers 21.05.26.xlsx | Deal Documents | vnd.openxmlformats-officedocument.spreadsheetml.sheet | 10362 | `companies/172/doc-1782745776593-732346438.xlsx` | ✓ |
| 1429 | 5854 | april management accs.pdf | Company Accounts | pdf | 35017 | `companies/172/doc-1782745795060-407329196.pdf` | ✓ |
| 1430 | 5855 | Business Overview.pdf | Company Accounts | pdf | 5147128 | `companies/172/doc-1782745955640-799391522.pdf` | ✓ |
| 1431 | 5856 | Asset register.xlsx | Asset Register | vnd.openxmlformats-officedocument.spreadsheetml.sheet | 88328 | `companies/172/doc-1782746843001-523269281.xlsx` | ✓ |

---

## Phase 2 — Classification & Extraction


**Before state**: 0 periods, 0 IS rows, 0 BS rows


### Doc 1418 → dev 5845: `staff matrix.pdf`

**Category**: Staff Matrix  **Type**: application/pdf  **Status**: `produced_structure_all_nulls`  

**Reason**: 1 result row(s) but no year data  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1165 | staff_matrix | Thu Jul 30 2026 01:17:04 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7964 | management | 2026 | 2026-07-30 | false | null | null | 5845 |


### Doc 1419 → dev 5846: `Aged Creditors.pdf`

**Category**: Deal Documents  **Type**: application/pdf  **Status**: `produced_nothing`  

**Reason**: webhook_status=classification_complete  **Webhook**: `classification_complete`  


### Doc 1420 → dev 5847: `Balance sheet.pdf`

**Category**: YTD Balance Sheet  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 1 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1166 | balance_sheet | Thu Jul 30 2026 01:17:14 GMT+0000 (Coordinated Universal Time) | 2026 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7965 | management | 2026 | 2026-03-12 | true | 12 | management | 5847 |


### Doc 1421 → dev 5848: `PNL.pdf`

**Category**: YTD Profit & Loss  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 1 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1167 | profit_and_loss | Thu Jul 30 2026 01:17:23 GMT+0000 (Coordinated Universal Time) | 2026 | ✓ | ✓ | ✗ | ✗ |


**Changed periods**: 1 — see raw/phase2-doc-5848-before-after.json


### Doc 1422 → dev 5849: `draft year end 25.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1168 | company_accounts | Thu Jul 30 2026 01:17:48 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1169 | profit_and_loss | Thu Jul 30 2026 01:17:48 GMT+0000 (Coordinated Universal Time) | 2024, 2025 | ✓ | ✓ | ✓ | ✗ |
| 1170 | balance_sheet | Thu Jul 30 2026 01:17:48 GMT+0000 (Coordinated Universal Time) | 2024, 2025 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 2

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7966 | statutory | 2024 | 2024-03-31 | true | 12 | statutory | 5849 |
| 7967 | statutory | 2025 | 2025-03-31 | true | 12 | statutory | 5849 |


**Changed periods**: 1 — see raw/phase2-doc-5849-before-after.json


### Doc 1423 → dev 5850: `year end 23.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1171 | company_accounts | Thu Jul 30 2026 01:18:10 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1172 | profit_and_loss | Thu Jul 30 2026 01:18:10 GMT+0000 (Coordinated Universal Time) | 2022, 2023 | ✓ | ✓ | ✓ | ✗ |
| 1173 | balance_sheet | Thu Jul 30 2026 01:18:10 GMT+0000 (Coordinated Universal Time) | 2022, 2023 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 2

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7968 | statutory | 2022 | 2022-03-31 | true | 12 | statutory | 5850 |
| 7969 | statutory | 2023 | 2023-03-31 | true | 12 | statutory | 5850 |


**Changed periods**: 3 — see raw/phase2-doc-5850-before-after.json


### Doc 1424 → dev 5851: `year end 24.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1174 | company_accounts | Thu Jul 30 2026 01:18:33 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1175 | profit_and_loss | Thu Jul 30 2026 01:18:33 GMT+0000 (Coordinated Universal Time) | 2023, 2024 | ✓ | ✓ | ✓ | ✗ |
| 1176 | balance_sheet | Thu Jul 30 2026 01:18:33 GMT+0000 (Coordinated Universal Time) | 2023, 2024 | ✗ | ✗ | ✗ | ✗ |


**Changed periods**: 5 — see raw/phase2-doc-5851-before-after.json


### Doc 1427 → dev 5852: `Aged Debtors.pdf`

**Category**: Deal Documents  **Type**: application/pdf  **Status**: `produced_structure_all_nulls`  

**Reason**: 1 result row(s) but no year data  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1177 | sales_ledger | Thu Jul 30 2026 01:18:40 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


### Doc 1428 → dev 5853: `Top 10 Customers 21.05.26.xlsx`

**Category**: Deal Documents  **Type**: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet  **Status**: `produced_structure_all_nulls`  

**Reason**: 1 result row(s) but no year data  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1178 | sales_ledger | Thu Jul 30 2026 01:18:46 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


### Doc 1429 → dev 5854: `april management accs.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1179 | company_accounts | Thu Jul 30 2026 01:18:58 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1180 | profit_and_loss | Thu Jul 30 2026 01:18:58 GMT+0000 (Coordinated Universal Time) | 2026 | ✓ | ✓ | ✗ | ✗ |
| 1181 | balance_sheet | Thu Jul 30 2026 01:18:58 GMT+0000 (Coordinated Universal Time) | 2026 | ✗ | ✗ | ✗ | ✗ |


**Changed periods**: 6 — see raw/phase2-doc-5854-before-after.json


### Doc 1430 → dev 5855: `Business Overview.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1183 | company_accounts | Thu Jul 30 2026 01:19:28 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1184 | profit_and_loss | Thu Jul 30 2026 01:19:28 GMT+0000 (Coordinated Universal Time) | 2022, 2023, 2024 | ✓ | ✓ | ✓ | ✗ |
| 1185 | balance_sheet | Thu Jul 30 2026 01:19:28 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


**Changed periods**: 6 — see raw/phase2-doc-5855-before-after.json


### Doc 1431 → dev 5856: `Asset register.xlsx`

**Category**: Asset Register  **Type**: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet  **Status**: `produced_structure_all_nulls`  

**Reason**: 1 result row(s) but no year data  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1182 | asset_register | Thu Jul 30 2026 01:19:17 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


---

### Phase 2 Final State


**Final**: 6 periods, 6 IS rows, 6 BS rows


| Period id | period_type | fiscal_year | period_end | is_full_year | months | source_tier | IS rows | BS rows |
|---|---|---|---|---|---|---|---|---|
| 7969 | statutory | 2023 | 2023-03-31 | true | 12 | statutory | 1 | 1 |
| 7966 | statutory | 2024 | 2024-03-31 | true | 12 | statutory | 1 | 1 |
| 7967 | statutory | 2025 | 2025-03-31 | true | 12 | statutory | 1 | 1 |
| 7968 | statutory | 2022 | 2022-03-31 | true | 12 | statutory | 1 | 1 |
| 7965 | management | 2026 | 2026-03-12 | true | 12 | management | 1 | 1 |
| 7964 | management | 2026 | 2026-04-30 | false | 1 | management | 1 | 1 |


**Usable EBITDA years** (full-year, non-IM): 2023, 2024, 2025, 2022, 2026  


---

## Phase 3 — Expert Analysis


**Expert results**: 8 records



### Expert: risk (id=811)

**Status**: success  **Score**: 52  **Confidence**: medium  **Time**: 11316ms  


### Expert: operational (id=810)

**Status**: success  **Score**: 58  **Confidence**: medium  **Time**: 13472ms  


### Expert: financial (id=809)

**Status**: success  **Score**: 52  **Confidence**: high  **Time**: 13691ms  


**Yearly EBITDA from financial expert**:

- 2022: EBITDA=£823615  revenue=£2141738  op_profit=£706162  

- 2023: EBITDA=£594797  revenue=£2038844  op_profit=£446250  

- 2024: EBITDA=£258731  revenue=£1636215  op_profit=£113046  

- 2025: EBITDA=£346712  revenue=£1777001  op_profit=£253858  

- 2026: EBITDA=£183908.52  revenue=£1869199.89  op_profit=£183908.52  


### Expert: sector (id=813)

**Status**: success  **Score**: 52  **Confidence**: medium  **Time**: 7211ms  


### Expert: qoe (id=812)

**Status**: success  **Score**: 48  **Confidence**: medium  **Time**: 11221ms  


**QoE Summary**:

- Total add-backs: 1
- Total deductions: 3


| Item | Type | Category | Amount | Recurrence | Defensibility |
|---|---|---|---|---|---|

| undefined | add_back | one_off_cost | £75000 | one_off | 6 |

| undefined | deduction | missing_management | £57500 | recurring | 9 |

| undefined | deduction | deferred_maintenance | £92854 | recurring | 7 |

| undefined | deduction | bad_debt_provision | £91726.7 | one_off | 8 |


**Adjusted EBITDA scenarios**:

- Conservative: £16827.82
- Base: £16827.82
- Optimistic: £91827.82


*Base EBITDA: £—  + Add-backs: £—  – Deductions: £—  = £—*  


### Expert: valuation (id=814)

**Status**: success  **Score**: 45  **Confidence**: medium  **Time**: 10562ms  


**Valuation figures**: multiple=undefined range=[undefined–undefined]  

adjusted_ebitda_base: £—  

Bridge: EV=£— +cash=£— -LTD=£— -DL=£— -WC=£— → offer=£—  


### Expert: deal_structure (id=815)

**Status**: success  **Score**: 35  **Confidence**: medium  **Time**: 12811ms  


### Expert: synthesis (id=816)

**Status**: success  **Score**: —  **Confidence**: —  **Time**: 18212ms  


### 3.4 Figure Traceability Check


**Reconciled EBITDA by year (input)**: {"2022":823615,"2023":594797,"2024":258731,"2025":346712,"2026":183908.52}


All key figures traceable to input (or no mismatch detected).


### 3.5 Database Writes


Expert analysis writes to: **expert_analysis_results** table only.  

No writes to deal_model_adjustments, ebitda_adjustments, valuations, or financial tables during Phase 3.  

(deal_model_adjustments are created at deal model creation time in Phase 4.)


---

## Phase 4 — Deal Model


**Model id**: 488  **Name**: Audit Model — TC 172  

**Stored columns**:

- averagingYears: 3
- ebitdaMultiple: 2

- calculated_ebitda: null
- adjusted_ebitda: 16827.82

- enterprise_value: 33655.64
- offer_driver: ebitda

- target_offer_price: null
- total_purchase_price: null

- is_locked: false



### 4.2 EBITDA Years


**All available years**: 2026, 2025, 2024, 2023, 2022 (5 total)

**Averaging window** (N=3): years=2026, 2025, 2024


| Year | Reported EBITDA |
|---|---|

| 2026 | £183908.52 |

| 2025 | £346712 |

| 2024 | £258731 |


**Sum**: £789351.52  **÷3**  = **£263117.17** raw average  

**Calculator averageAdjustedEbitda**: £263117.17333333334  

**Reconciles to raw avg**: roughly (adjustments applied below)  


### 4.3 Adjustments (5 rows)


| id | type | category | description | amount | amounts_by_year | status | is_accepted |
|---|---|---|---|---|---|---|---|

| 2038 | add_back | one_off_cost | Professional Fees Normalisation | £75000 | {"2022":0,"2023":0,"2024":0,"2025":0,"2026":75000} | suggested | false |

| 2039 | deduction | missing_management | Replacement Management Cost (MD/FD) | £57500 | — | suggested | false |

| 2040 | deduction | deferred_maintenance | Deferred Maintenance / Scaffolding Replacement | £92854 | — | suggested | false |

| 2041 | deduction | bad_debt_provision | Bad Debt Provision - Worldwide Scaffold | £91726.7 | {"2022":0,"2023":0,"2024":0,"2025":0,"2026":91726.7} | suggested | false |

| 2042 | deduction | replacement_salary | Director replacement cost: Mark Jones (current: 0, market: 57500) | £57500 | — | suggested | false |


*Note: amounts above are the stored amounts. The calculator applies year-specific overrides from amounts_by_year if set.*  

**Calculator averageAdjustedEbitda**: £263117.17333333334  


### 4.4 Enterprise Value & Offer Price Bridge


| Line | Amount |
|---|---|

| Average Adjusted EBITDA | £263117.17333333334 |

| × Multiple (2) | £526234.3466666667 |

| + Excess Cash | £0 |

| + Property Value | £0 |

| – Primary Debt | £0 |

| – Other Debt | £27852 |

| – Corp Tax Due | £0 |

| – Working Capital Adj | £25809 |

| **Offer Price** | **£472573.3466666667** |


**Bridge check**: 472573.35 vs stored 472573.3466666667 → ✓ RECONCILES  


### 4.5 Offer Document


**Doc id**: 111  **Status**: draft  

**Figures in offer document**:

- offerPrice: —
- enterpriseValue: —

- averageEbitda (raw): £—
- ebitdaMultiple: —

- Breakdown: `undefined`



### 4.6 Faithfulness Verdict


**YES** — the deal model uses verified financial periods extracted from submitted documents. 3 fiscal year(s) fed the average (2026, 2025, 2024).  

