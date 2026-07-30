# Pipeline Fidelity: TC 196 (Compassion Home Care Limited)

**Dev TC ID**: 1878  
**Prod TC ID**: 196  
**Industry**: Care & Social Services  
**Sub-sector**: Domiciliary & Home Care  
**Audit date**: 2026-07-30  

---

## Phase 1 — Document Cloning

**Dev DB host**: helium  
**Prod DB host**: ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech  

| Prod ID | Dev ID | Filename | Category | Type | Size | R2 Key | HEAD OK |
|---|---|---|---|---|---|---|---|
| 1615 | 5841 | 2026-D~1.PDF | Company Accounts | pdf | 1279714 | `companies/196/doc-1784054591431-728881096.pdf` | ✓ |
| 1616 | 5842 | 51973A~1.PDF | Company Accounts | pdf | 308777 | `companies/196/doc-1784054631356-508928467.pdf` | ✓ |
| 1617 | 5843 | 51973A~1.PDF | Company Accounts | pdf | 6883271 | `companies/196/doc-1784054658646-772722481.pdf` | ✓ |
| 1618 | 5844 | 519763~1.XLS | Staff Matrix | vnd.ms-excel | 81184 | `companies/196/doc-1784054704563-861027790.xls` | ✓ |

---

## Phase 2 — Classification & Extraction


**Before state**: 0 periods, 0 IS rows, 0 BS rows


### Doc 1615 → dev 5841: `2026-D~1.PDF`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1155 | company_accounts | Thu Jul 30 2026 01:11:01 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1156 | profit_and_loss | Thu Jul 30 2026 01:11:01 GMT+0000 (Coordinated Universal Time) | 2025, 2026 | ✓ | ✓ | ✓ | ✗ |
| 1157 | balance_sheet | Thu Jul 30 2026 01:11:02 GMT+0000 (Coordinated Universal Time) | 2025, 2026 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 2

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7959 | statutory | 2025 | 2025-02-28 | true | 12 | statutory | 5841 |
| 7960 | statutory | 2026 | 2026-02-28 | true | 12 | statutory | 5841 |


### Doc 1616 → dev 5842: `51973A~1.PDF`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1158 | company_accounts | Thu Jul 30 2026 01:11:41 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1159 | profit_and_loss | Thu Jul 30 2026 01:11:41 GMT+0000 (Coordinated Universal Time) | 2024, 2025 | ✓ | ✓ | ✓ | ✗ |
| 1160 | balance_sheet | Thu Jul 30 2026 01:11:41 GMT+0000 (Coordinated Universal Time) | 2024, 2025 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7961 | statutory | 2024 | 2024-02-29 | true | 12 | statutory | 5842 |


**Changed periods**: 2 — see raw/phase2-doc-5842-before-after.json


### Doc 1617 → dev 5843: `51973A~1.PDF`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1161 | company_accounts | Thu Jul 30 2026 01:12:13 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1162 | profit_and_loss | Thu Jul 30 2026 01:12:13 GMT+0000 (Coordinated Universal Time) | 2023, 2024 | ✓ | ✓ | ✓ | ✗ |
| 1163 | balance_sheet | Thu Jul 30 2026 01:12:13 GMT+0000 (Coordinated Universal Time) | 2023, 2024 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7962 | statutory | 2023 | 2023-02-28 | true | 12 | statutory | 5843 |


**Changed periods**: 3 — see raw/phase2-doc-5843-before-after.json


### Doc 1618 → dev 5844: `519763~1.XLS`

**Category**: Staff Matrix  **Type**: application/vnd.ms-excel  **Status**: `produced_structure_all_nulls`  

**Reason**: 1 result row(s) but no year data  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1164 | staff_matrix | Thu Jul 30 2026 01:12:25 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7963 | management | 2026 | 2026-07-30 | false | null | null | 5844 |


---

### Phase 2 Final State


**Final**: 5 periods, 4 IS rows, 4 BS rows


| Period id | period_type | fiscal_year | period_end | is_full_year | months | source_tier | IS rows | BS rows |
|---|---|---|---|---|---|---|---|---|
| 7959 | statutory | 2025 | 2025-02-28 | true | 12 | statutory | 1 | 1 |
| 7960 | statutory | 2026 | 2026-02-28 | true | 12 | statutory | 1 | 1 |
| 7961 | statutory | 2024 | 2024-02-29 | true | 12 | statutory | 1 | 1 |
| 7962 | statutory | 2023 | 2023-02-28 | true | 12 | statutory | 1 | 1 |
| 7963 | management | 2026 | 2026-07-30 | false | — | null | 0 | 0 |


**Usable EBITDA years** (full-year, non-IM): 2025, 2026, 2024, 2023  


---

## Phase 3 — Expert Analysis


**Expert results**: 8 records



### Expert: risk (id=803)

**Status**: success  **Score**: 68  **Confidence**: medium  **Time**: 9617ms  


### Expert: operational (id=802)

**Status**: success  **Score**: 58  **Confidence**: medium  **Time**: 11105ms  


### Expert: financial (id=801)

**Status**: success  **Score**: 72  **Confidence**: high  **Time**: 11489ms  


**Yearly EBITDA from financial expert**:

- 2023: EBITDA=£99879  revenue=£769931  op_profit=£94104  

- 2024: EBITDA=£135131  revenue=£836440  op_profit=£130754  

- 2025: EBITDA=£121426  revenue=£778150  op_profit=£118379  

- 2026: EBITDA=£135076  revenue=£818060  op_profit=£132427  


### Expert: sector (id=805)

**Status**: success  **Score**: 68  **Confidence**: high  **Time**: 7032ms  


### Expert: qoe (id=804)

**Status**: success  **Score**: 68  **Confidence**: high  **Time**: 11188ms  


**QoE Summary**:

- Total add-backs: 1
- Total deductions: 3


| Item | Type | Category | Amount | Recurrence | Defensibility |
|---|---|---|---|---|---|

| undefined | add_back | owner_salary | £16202 | recurring | 8 |

| undefined | deduction | missing_management | £42500 | recurring | 9 |

| undefined | deduction | deferred_maintenance | £5000 | recurring | 6 |

| undefined | deduction | bad_debt_provision | £9802 | one_off | 7 |


**Adjusted EBITDA scenarios**:

- Conservative: £81176
- Base: £93976
- Optimistic: £108776


*Base EBITDA: £—  + Add-backs: £—  – Deductions: £—  = £—*  


### Expert: valuation (id=806)

**Status**: success  **Score**: 75  **Confidence**: high  **Time**: 9541ms  


**Valuation figures**: multiple=undefined range=[undefined–undefined]  

adjusted_ebitda_base: £—  

Bridge: EV=£— +cash=£— -LTD=£— -DL=£— -WC=£— → offer=£—  


### Expert: deal_structure (id=807)

**Status**: success  **Score**: 55  **Confidence**: high  **Time**: 13211ms  


### Expert: synthesis (id=808)

**Status**: success  **Score**: —  **Confidence**: —  **Time**: 17234ms  


### 3.4 Figure Traceability Check


**Reconciled EBITDA by year (input)**: {"2023":99879,"2024":135131,"2025":121426,"2026":135076}


All key figures traceable to input (or no mismatch detected).


### 3.5 Database Writes


Expert analysis writes to: **expert_analysis_results** table only.  

No writes to deal_model_adjustments, ebitda_adjustments, valuations, or financial tables during Phase 3.  

(deal_model_adjustments are created at deal model creation time in Phase 4.)


---

## Phase 4 — Deal Model


**Model id**: 487  **Name**: Audit Model — TC 196  

**Stored columns**:

- averagingYears: 3
- ebitdaMultiple: 2

- calculated_ebitda: null
- adjusted_ebitda: 93976

- enterprise_value: 187952
- offer_driver: ebitda

- target_offer_price: null
- total_purchase_price: null

- is_locked: false



### 4.2 EBITDA Years


**All available years**: 2026, 2025, 2024, 2023 (4 total)

**Averaging window** (N=3): years=2026, 2025, 2024


| Year | Reported EBITDA |
|---|---|

| 2026 | £135076 |

| 2025 | £121426 |

| 2024 | £135131 |


**Sum**: £391633.00  **÷3**  = **£130544.33** raw average  

**Calculator averageAdjustedEbitda**: £130544.33333333333  

**Reconciles to raw avg**: roughly (adjustments applied below)  


### 4.3 Adjustments (4 rows)


| id | type | category | description | amount | amounts_by_year | status | is_accepted |
|---|---|---|---|---|---|---|---|

| 2034 | add_back | owner_salary_excess | Excess Director Remuneration | £16202 | — | suggested | false |

| 2035 | deduction | missing_management | Replacement Registered Manager Cost | £42500 | — | suggested | false |

| 2036 | deduction | deferred_maintenance | Deferred IT and Vehicle Maintenance | £5000 | — | suggested | false |

| 2037 | deduction | bad_debt_provision | Bad Debt Provision (Debtor Spike) | £9802 | {"2023":0,"2024":0,"2025":0,"2026":9802} | suggested | false |


*Note: amounts above are the stored amounts. The calculator applies year-specific overrides from amounts_by_year if set.*  

**Calculator averageAdjustedEbitda**: £130544.33333333333  


### 4.4 Enterprise Value & Offer Price Bridge


| Line | Amount |
|---|---|

| Average Adjusted EBITDA | £130544.33333333333 |

| × Multiple (2) | £261088.66666666666 |

| + Excess Cash | £103302 |

| + Property Value | £0 |

| – Primary Debt | £0 |

| – Other Debt | £0 |

| – Corp Tax Due | £0 |

| – Working Capital Adj | £171408 |

| **Offer Price** | **£192982.66666666666** |


**Bridge check**: 192982.67 vs stored 192982.66666666666 → ✓ RECONCILES  


### 4.5 Offer Document


**Doc id**: 109  **Status**: draft  

**Figures in offer document**:

- offerPrice: —
- enterpriseValue: —

- averageEbitda (raw): £—
- ebitdaMultiple: —

- Breakdown: `undefined`



### 4.6 Faithfulness Verdict


**YES** — the deal model uses verified financial periods extracted from submitted documents. 3 fiscal year(s) fed the average (2026, 2025, 2024).  

