# Pipeline Fidelity: TC 190 (Spruce Pools)

**Dev TC ID**: 1917  
**Prod TC ID**: 190  
**Industry**: Construction & Building  
**Sub-sector**: Specialist Trades (Roofing, Cladding, etc.)  
**Audit date**: 2026-07-30  

---

## Phase 1 — Document Cloning

**Dev DB host**: helium  
**Prod DB host**: ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech  

| Prod ID | Dev ID | Filename | Category | Type | Size | R2 Key | HEAD OK |
|---|---|---|---|---|---|---|---|
| 1728 | 5934 | doc-1780951102372-305980669.pdf | Restored | pdf | 483553 | `companies/190/doc-1780951102372-305980669.pdf` | ✓ |
| 1729 | 5935 | doc-1780951121766-626520292.pdf | Restored | pdf | 485224 | `companies/190/doc-1780951121766-626520292.pdf` | ✓ |
| 1730 | 5936 | doc-1780951138693-955328715.pdf | Restored | pdf | 485812 | `companies/190/doc-1780951138693-955328715.pdf` | ✓ |
| 1731 | 5937 | doc-1780951192444-255571185.pdf | Restored | pdf | 49960 | `companies/190/doc-1780951192444-255571185.pdf` | ✓ |
| 1732 | 5938 | doc-1781036006204-332566439.docx | Restored | vnd.openxmlformats-officedocument.wordprocessingml.document | 19554 | `companies/190/doc-1781036006204-332566439.docx` | ✓ |
| 1733 | 5939 | doc-1781036027379-2936647.pdf | Restored | pdf | 28068 | `companies/190/doc-1781036027379-2936647.pdf` | ✓ |
| 1734 | 5940 | doc-1781036039445-618029331.pdf | Restored | pdf | 28654 | `companies/190/doc-1781036039445-618029331.pdf` | ✓ |
| 1735 | 5941 | doc-1781036052408-171685303.pdf | Restored | pdf | 27597 | `companies/190/doc-1781036052408-171685303.pdf` | ✓ |

---

## Phase 2 — Classification & Extraction


**Before state**: 0 periods, 0 IS rows, 0 BS rows


### Doc 1728 → dev 5934: `doc-1780951102372-305980669.pdf`

**Category**: Restored  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1298 | company_accounts | Thu Jul 30 2026 01:58:51 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1299 | profit_and_loss | Thu Jul 30 2026 01:58:51 GMT+0000 (Coordinated Universal Time) | 2024, 2025 | ✓ | ✓ | ✓ | ✗ |
| 1300 | balance_sheet | Thu Jul 30 2026 01:58:51 GMT+0000 (Coordinated Universal Time) | 2024, 2025 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 2

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8059 | statutory | 2024 | 2024-12-31 | true | 12 | statutory | 5934 |
| 8060 | statutory | 2025 | 2025-12-31 | true | 12 | statutory | 5934 |


### Doc 1729 → dev 5935: `doc-1780951121766-626520292.pdf`

**Category**: Restored  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1301 | company_accounts | Thu Jul 30 2026 01:59:14 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1302 | profit_and_loss | Thu Jul 30 2026 01:59:14 GMT+0000 (Coordinated Universal Time) | 2023, 2024 | ✓ | ✓ | ✓ | ✗ |
| 1303 | balance_sheet | Thu Jul 30 2026 01:59:14 GMT+0000 (Coordinated Universal Time) | 2023, 2024 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8061 | statutory | 2023 | 2023-12-31 | true | 12 | statutory | 5935 |


**Changed periods**: 2 — see raw/phase2-doc-5935-before-after.json


### Doc 1730 → dev 5936: `doc-1780951138693-955328715.pdf`

**Category**: Restored  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1304 | company_accounts | Thu Jul 30 2026 01:59:38 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1305 | profit_and_loss | Thu Jul 30 2026 01:59:38 GMT+0000 (Coordinated Universal Time) | 2022, 2023 | ✓ | ✓ | ✓ | ✗ |
| 1306 | balance_sheet | Thu Jul 30 2026 01:59:38 GMT+0000 (Coordinated Universal Time) | 2022, 2023 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8062 | statutory | 2022 | 2022-12-31 | true | 12 | statutory | 5936 |


**Changed periods**: 3 — see raw/phase2-doc-5936-before-after.json


### Doc 1731 → dev 5937: `doc-1780951192444-255571185.pdf`

**Category**: Restored  **Type**: application/pdf  **Status**: `produced_nothing`  

**Reason**: webhook_status=classification_complete  **Webhook**: `classification_complete`  


### Doc 1732 → dev 5938: `doc-1781036006204-332566439.docx`

**Category**: Restored  **Type**: application/vnd.openxmlformats-officedocument.wordprocessingml.document  **Status**: `produced_nothing`  

**Reason**: webhook_status=classification_failed  **Webhook**: `classification_failed`  


### Doc 1733 → dev 5939: `doc-1781036027379-2936647.pdf`

**Category**: Restored  **Type**: application/pdf  **Status**: `produced_structure_all_nulls`  

**Reason**: 1 result row(s) but no year data  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1307 | asset_register | Thu Jul 30 2026 01:59:54 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


### Doc 1734 → dev 5940: `doc-1781036039445-618029331.pdf`

**Category**: Restored  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 1 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1308 | profit_and_loss | Thu Jul 30 2026 02:00:13 GMT+0000 (Coordinated Universal Time) | 2023, 2024, 2025, 2026 | ✓ | ✓ | ✗ | ✗ |


**New periods created**: 4

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8063 | management | 2023 | 2023-06-09 | false | 5 | information_memorandum | 5940 |
| 8064 | management | 2024 | 2024-06-09 | false | 5 | information_memorandum | 5940 |
| 8065 | management | 2025 | 2025-06-09 | false | 5 | information_memorandum | 5940 |
| 8066 | management | 2026 | 2026-06-09 | false | 5 | information_memorandum | 5940 |


**Changed periods**: 4 — see raw/phase2-doc-5940-before-after.json


### Doc 1735 → dev 5941: `doc-1781036052408-171685303.pdf`

**Category**: Restored  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 1 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1309 | balance_sheet | Thu Jul 30 2026 02:00:28 GMT+0000 (Coordinated Universal Time) | 2023, 2024, 2025, 2026 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8070 | management | 2026 | 2026-05-31 | true | 12 | information_memorandum | 5941 |


**Changed periods**: 8 — see raw/phase2-doc-5941-before-after.json


---

### Phase 2 Final State


**Final**: 9 periods, 8 IS rows, 5 BS rows


| Period id | period_type | fiscal_year | period_end | is_full_year | months | source_tier | IS rows | BS rows |
|---|---|---|---|---|---|---|---|---|
| 8064 | management | 2024 | 2024-06-09 | false | 5 | information_memorandum | 1 | 0 |
| 8065 | management | 2025 | 2025-06-09 | false | 5 | information_memorandum | 1 | 0 |
| 8066 | management | 2026 | 2026-06-09 | false | 5 | information_memorandum | 1 | 0 |
| 8059 | statutory | 2024 | 2024-12-31 | true | 12 | statutory | 1 | 1 |
| 8060 | statutory | 2025 | 2025-12-31 | true | 12 | statutory | 1 | 1 |
| 8070 | management | 2026 | 2026-05-31 | true | 12 | information_memorandum | 0 | 1 |
| 8061 | statutory | 2023 | 2023-12-31 | true | 12 | statutory | 1 | 1 |
| 8062 | statutory | 2022 | 2022-12-31 | true | 12 | statutory | 1 | 1 |
| 8063 | management | 2023 | 2023-06-09 | false | 5 | information_memorandum | 1 | 0 |


**Usable EBITDA years** (full-year, non-IM): 2024, 2025, 2023, 2022  


---

## Phase 3 — Expert Analysis


**Expert results**: 8 records



### Expert: deal_structure (id=904)

**Status**: success  **Score**: 65  **Confidence**: high  **Time**: 16386ms  


### Expert: synthesis (id=905)

**Status**: success  **Score**: —  **Confidence**: —  **Time**: 18296ms  


### Expert: risk (id=900)

**Status**: success  **Score**: 72  **Confidence**: medium  **Time**: 11289ms  


### Expert: financial (id=898)

**Status**: success  **Score**: 58  **Confidence**: high  **Time**: 11888ms  


**Yearly EBITDA from financial expert**:

- 2022: EBITDA=£520315  revenue=£2282351  op_profit=£463122  

- 2023: EBITDA=£308398  revenue=£1992926  op_profit=£221925  

- 2024: EBITDA=£183298  revenue=£1982111  op_profit=£118901  

- 2025: EBITDA=£298961  revenue=£2313955  op_profit=£227845  


### Expert: operational (id=899)

**Status**: success  **Score**: 68  **Confidence**: high  **Time**: 12015ms  


### Expert: sector (id=902)

**Status**: success  **Score**: 58  **Confidence**: medium  **Time**: 6745ms  


### Expert: qoe (id=901)

**Status**: success  **Score**: 62  **Confidence**: high  **Time**: 9613ms  


**QoE Summary**:

- Total add-backs: 2
- Total deductions: 1


| Item | Type | Category | Amount | Recurrence | Defensibility |
|---|---|---|---|---|---|

| undefined | add_back | owner_salary | £60000 | recurring | 9 |

| undefined | add_back | personal_expense | £1700 | recurring | 10 |

| undefined | deduction | replacement_salary | £48400 | recurring | 8 |


**Adjusted EBITDA scenarios**:

- Conservative: £312262
- Base: £312262
- Optimistic: £312262


*Base EBITDA: £—  + Add-backs: £—  – Deductions: £—  = £—*  


### Expert: valuation (id=903)

**Status**: success  **Score**: 65  **Confidence**: medium  **Time**: 10006ms  


**Valuation figures**: multiple=undefined range=[undefined–undefined]  

adjusted_ebitda_base: £—  

Bridge: EV=£— +cash=£— -LTD=£— -DL=£— -WC=£— → offer=£—  


### 3.4 Figure Traceability Check


**Reconciled EBITDA by year (input)**: {"2022":520315,"2023":308398,"2024":183298,"2025":298961}


All key figures traceable to input (or no mismatch detected).


### 3.5 Database Writes


Expert analysis writes to: **expert_analysis_results** table only.  

No writes to deal_model_adjustments, ebitda_adjustments, valuations, or financial tables during Phase 3.  

(deal_model_adjustments are created at deal model creation time in Phase 4.)


---

## Phase 4 — Deal Model


**Model id**: 494  **Name**: Audit Model — TC 190  

**Stored columns**:

- averagingYears: 3
- ebitdaMultiple: 2.5

- calculated_ebitda: null
- adjusted_ebitda: 312262

- enterprise_value: 780655
- offer_driver: ebitda

- target_offer_price: null
- total_purchase_price: null

- is_locked: false



### 4.2 EBITDA Years


**All available years**: 2025, 2024, 2023, 2022 (4 total)

**Averaging window** (N=3): years=2025, 2024, 2023


| Year | Reported EBITDA |
|---|---|

| 2025 | £298961 |

| 2024 | £183298 |

| 2023 | £308398 |


**Sum**: £790657.00  **÷3**  = **£263552.33** raw average  

**Calculator averageAdjustedEbitda**: £263552.3333333333  

**Reconciles to raw avg**: roughly (adjustments applied below)  


### 4.3 Adjustments (3 rows)


| id | type | category | description | amount | amounts_by_year | status | is_accepted |
|---|---|---|---|---|---|---|---|

| 2064 | add_back | owner_salary_excess | Excess Directors Pension Contributions | £60000 | — | suggested | false |

| 2065 | add_back | personal_expense | Personal Use of Home as Office | £1700 | — | suggested | false |

| 2066 | deduction | replacement_salary | Replacement Management Salary Adjustment | £48400 | — | suggested | false |


*Note: amounts above are the stored amounts. The calculator applies year-specific overrides from amounts_by_year if set.*  

**Calculator averageAdjustedEbitda**: £263552.3333333333  


### 4.4 Enterprise Value & Offer Price Bridge


| Line | Amount |
|---|---|

| Average Adjusted EBITDA | £263552.3333333333 |

| × Multiple (2.5) | £658880.8333333333 |

| + Excess Cash | £795164.52 |

| + Property Value | £0 |

| – Primary Debt | £0 |

| – Other Debt | £0 |

| – Corp Tax Due | £0 |

| – Working Capital Adj | £191658 |

| **Offer Price** | **£1262387.3533333333** |


**Bridge check**: 1262387.35 vs stored 1262387.3533333333 → ✓ RECONCILES  


### 4.5 Offer Document


**Doc id**: 117  **Status**: draft  

**Figures in offer document**:

- offerPrice: —
- enterpriseValue: —

- averageEbitda (raw): £—
- ebitdaMultiple: —

- Breakdown: `undefined`



### 4.6 Faithfulness Verdict


**YES** — the deal model uses verified financial periods extracted from submitted documents. 3 fiscal year(s) fed the average (2025, 2024, 2023).  

