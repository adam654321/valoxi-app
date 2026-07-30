# Pipeline Fidelity: TC 218 (Canoports UK Limited)

**Dev TC ID**: 1884  
**Prod TC ID**: 218  
**Industry**: Manufacturing  
**Sub-sector**: Metal Fabrication & Welding  
**Audit date**: 2026-07-30  

---

## Phase 1 — Document Cloning

**Dev DB host**: helium  
**Prod DB host**: ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech  

| Prod ID | Dev ID | Filename | Category | Type | Size | R2 Key | HEAD OK |
|---|---|---|---|---|---|---|---|
| 1484 | 5901 | Doc4_Asset_Register.pdf | Asset Register | pdf | 3939 | `companies/218/doc-1782905055173-270625069.pdf` | ✓ |
| 1486 | 5902 | Doc6_Staff_Matrix.pdf | Staff Matrix | pdf | 4638 | `companies/218/doc-1782905171025-509966349.pdf` | ✓ |
| 1487 | 5903 | Doc7_Deal_Documents.pdf | Deal Documents | pdf | 5254 | `companies/218/doc-1782905193639-297224374.pdf` | ✓ |
| 1488 | 5904 | Doc1_Company_Accounts.pdf | Company Accounts | pdf | 5326 | `companies/218/doc-1782905245818-224651570.pdf` | ✓ |
| 1489 | 5905 | Doc2_YTD_Profit_and_Loss.pdf | YTD Profit & Loss | pdf | 4918 | `companies/218/doc-1782905265628-448187592.pdf` | ✓ |
| 1490 | 5906 | Doc3_YTD_Balance_Sheet (1).pdf | YTD Balance Sheet | pdf | 4684 | `companies/218/doc-1782905296744-796886983.pdf` | ✓ |
| 1505 | 5907 | Doc8_Company_Accounts_FY26.pdf | Company Accounts | pdf | 6434 | `companies/218/doc-1782991317146-437307000.pdf` | ✓ |
| 1506 | 5908 | Sales Ledger 2.pdf | Sales Ledger | pdf | 400246 | `companies/218/doc-1782995714308-283716183.pdf` | ✓ |

---

## Phase 2 — Classification & Extraction


**Before state**: 0 periods, 0 IS rows, 0 BS rows


### Doc 1484 → dev 5901: `Doc4_Asset_Register.pdf`

**Category**: Asset Register  **Type**: application/pdf  **Status**: `produced_structure_all_nulls`  

**Reason**: 1 result row(s) but no year data  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1287 | asset_register | Thu Jul 30 2026 01:51:23 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


### Doc 1486 → dev 5902: `Doc6_Staff_Matrix.pdf`

**Category**: Staff Matrix  **Type**: application/pdf  **Status**: `produced_structure_all_nulls`  

**Reason**: 1 result row(s) but no year data  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1288 | staff_matrix | Thu Jul 30 2026 01:51:32 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8044 | management | 2026 | 2026-07-30 | false | null | null | 5902 |


### Doc 1487 → dev 5903: `Doc7_Deal_Documents.pdf`

**Category**: Deal Documents  **Type**: application/pdf  **Status**: `produced_nothing`  

**Reason**: webhook_status=classification_complete  **Webhook**: `classification_complete`  


### Doc 1488 → dev 5904: `Doc1_Company_Accounts.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1289 | company_accounts | Thu Jul 30 2026 01:51:58 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1290 | profit_and_loss | Thu Jul 30 2026 01:51:58 GMT+0000 (Coordinated Universal Time) | 2023, 2024, 2025 | ✓ | ✓ | ✓ | ✗ |
| 1291 | balance_sheet | Thu Jul 30 2026 01:51:59 GMT+0000 (Coordinated Universal Time) | 2023, 2024, 2025 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 3

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8045 | management | 2023 | 2023-05-31 | true | 12 | information_memorandum | 5904 |
| 8046 | management | 2024 | 2024-05-31 | true | 12 | information_memorandum | 5904 |
| 8047 | management | 2025 | 2025-05-31 | true | 12 | information_memorandum | 5904 |


### Doc 1489 → dev 5905: `Doc2_YTD_Profit_and_Loss.pdf`

**Category**: YTD Profit & Loss  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 1 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1292 | profit_and_loss | Thu Jul 30 2026 01:52:12 GMT+0000 (Coordinated Universal Time) | 2025, 2026, 2027, 2028 | ✓ | ✓ | ✓ | ✗ |


**New periods created**: 3

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8051 | management | 2027 | 2027-05-31 | false | null | null | 5905 |
| 8052 | management | 2028 | 2028-05-31 | false | null | null | 5905 |
| 8053 | management | 2025 | 2025-05-31 | true | 12 | information_memorandum | 5904 |


**Changed periods**: 4 — see raw/phase2-doc-5905-before-after.json


### Doc 1490 → dev 5906: `Doc3_YTD_Balance_Sheet (1).pdf`

**Category**: YTD Balance Sheet  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 1 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1293 | balance_sheet | Thu Jul 30 2026 01:52:22 GMT+0000 (Coordinated Universal Time) | 2025, 2026 | ✗ | ✗ | ✗ | ✗ |


**Changed periods**: 5 — see raw/phase2-doc-5906-before-after.json


### Doc 1505 → dev 5907: `Doc8_Company_Accounts_FY26.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1294 | company_accounts | Thu Jul 30 2026 01:52:39 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1295 | profit_and_loss | Thu Jul 30 2026 01:52:39 GMT+0000 (Coordinated Universal Time) | 2025, 2026 | ✓ | ✓ | ✓ | ✗ |
| 1296 | balance_sheet | Thu Jul 30 2026 01:52:39 GMT+0000 (Coordinated Universal Time) | 2025, 2026 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 8054 | management | 2026 | 2026-05-31 | false | 12 | information_memorandum | 5906 |


**Changed periods**: 5 — see raw/phase2-doc-5907-before-after.json


### Doc 1506 → dev 5908: `Sales Ledger 2.pdf`

**Category**: Sales Ledger  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 1 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1297 | profit_and_loss | Thu Jul 30 2026 01:52:56 GMT+0000 (Coordinated Universal Time) | 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030 | ✓ | ✓ | ✗ | ✗ |


**Changed periods**: 6 — see raw/phase2-doc-5908-before-after.json


---

### Phase 2 Final State


**Final**: 8 periods, 8 IS rows, 6 BS rows


| Period id | period_type | fiscal_year | period_end | is_full_year | months | source_tier | IS rows | BS rows |
|---|---|---|---|---|---|---|---|---|
| 8045 | management | 2023 | 2023-05-31 | true | 12 | information_memorandum | 1 | 1 |
| 8046 | management | 2024 | 2024-05-31 | true | 12 | information_memorandum | 1 | 1 |
| 8053 | management | 2025 | 2025-05-31 | true | 12 | information_memorandum | 1 | 1 |
| 8051 | management | 2027 | 2027-05-31 | false | — | null | 1 | 0 |
| 8052 | management | 2028 | 2028-05-31 | false | — | null | 1 | 0 |
| 8047 | management | 2025 | 2025-05-31 | false | 12 | information_memorandum | 1 | 1 |
| 8054 | management | 2026 | 2026-05-31 | false | 12 | information_memorandum | 1 | 1 |
| 8044 | management | 2026 | 2026-05-31 | true | 12 | information_memorandum | 1 | 1 |


**Usable EBITDA years** (full-year, non-IM): NONE  


---

## Phase 3 — Expert Analysis


**Expert results**: 8 records



### Expert: risk (id=892)

**Status**: success  **Score**: 78  **Confidence**: medium  **Time**: 8174ms  


### Expert: operational (id=891)

**Status**: success  **Score**: 68  **Confidence**: high  **Time**: 9846ms  


### Expert: financial (id=890)

**Status**: success  **Score**: 78  **Confidence**: medium  **Time**: 7140ms  


**Yearly EBITDA from financial expert**:

- 2023: EBITDA=£—  revenue=£—  op_profit=£—  

- 2024: EBITDA=£—  revenue=£—  op_profit=£—  

- 2025: EBITDA=£—  revenue=£18333750  op_profit=£—  


### Expert: sector (id=894)

**Status**: success  **Score**: 68  **Confidence**: medium  **Time**: 6789ms  


### Expert: qoe (id=893)

**Status**: success  **Score**: 65  **Confidence**: medium  **Time**: 10352ms  


**QoE Summary**:

- Total add-backs: 1
- Total deductions: 2


| Item | Type | Category | Amount | Recurrence | Defensibility |
|---|---|---|---|---|---|

| undefined | add_back | owner_salary | £0 | recurring | 0 |

| undefined | deduction | missing_management | £82500 | recurring | 8 |

| undefined | deduction | deferred_maintenance | £45000 | recurring | 6 |


**Adjusted EBITDA scenarios**:

- Conservative: £—
- Base: £—
- Optimistic: £—


*Base EBITDA: £—  + Add-backs: £—  – Deductions: £—  = £—*  


### Expert: deal_structure (id=896)

**Status**: success  **Score**: 62  **Confidence**: medium  **Time**: 14139ms  


### Expert: valuation (id=895)

**Status**: success  **Score**: 55  **Confidence**: low  **Time**: 9294ms  


**Valuation figures**: multiple=undefined range=[undefined–undefined]  

adjusted_ebitda_base: £—  

Bridge: EV=£— +cash=£— -LTD=£— -DL=£— -WC=£— → offer=£—  


### Expert: synthesis (id=897)

**Status**: success  **Score**: —  **Confidence**: —  **Time**: 18194ms  


### 3.4 Figure Traceability Check


**Reconciled EBITDA by year (input)**: {}


All key figures traceable to input (or no mismatch detected).


### 3.5 Database Writes


Expert analysis writes to: **expert_analysis_results** table only.  

No writes to deal_model_adjustments, ebitda_adjustments, valuations, or financial tables during Phase 3.  

(deal_model_adjustments are created at deal model creation time in Phase 4.)


---

## Phase 4 — Deal Model


**Model id**: 493  **Name**: Audit Model — TC 218  

**Stored columns**:

- averagingYears: 3
- ebitdaMultiple: 4.5

- calculated_ebitda: null
- adjusted_ebitda: 1705875

- enterprise_value: 7676437
- offer_driver: ebitda

- target_offer_price: null
- total_purchase_price: null

- is_locked: false



### 4.2 EBITDA Years


**All available years**:  (0 total)

**Averaging window** (N=3): years=


| Year | Reported EBITDA |
|---|---|


**Sum**: £0.00  **÷0**  = **£0.00** raw average  

**Calculator averageAdjustedEbitda**: £0  

**Reconciles to raw avg**: N/A — no eligible years  


### 4.3 Adjustments (5 rows)


| id | type | category | description | amount | amounts_by_year | status | is_accepted |
|---|---|---|---|---|---|---|---|

| 2059 | deduction | missing_management | Replacement Finance Director Cost | £82500 | — | suggested | false |

| 2060 | deduction | deferred_maintenance | Increased Maintenance Capex / IT Infrastructure | £45000 | — | suggested | false |

| 2061 | deduction | replacement_salary | Director replacement cost: CEO / MD, Div 1 (current: 0, market: 102500) | £102500 | — | suggested | false |

| 2062 | deduction | replacement_salary | Director replacement cost: MD, Division 2 (current: 0, market: 75000) | £75000 | — | suggested | false |

| 2063 | deduction | replacement_salary | Director replacement cost: MD, Division 3 (current: 0, market: 75000) | £75000 | — | suggested | false |


*Note: amounts above are the stored amounts. The calculator applies year-specific overrides from amounts_by_year if set.*  

**Calculator averageAdjustedEbitda**: £0  


### 4.4 Enterprise Value & Offer Price Bridge


| Line | Amount |
|---|---|

| Average Adjusted EBITDA | £0 |

| × Multiple (4.5) | £0 |

| + Excess Cash | £2949661 |

| + Property Value | £0 |

| – Primary Debt | £3867 |

| – Other Debt | £0 |

| – Corp Tax Due | £0 |

| – Working Capital Adj | £0 |

| **Offer Price** | **£2945794** |


**Bridge check**: 2945794.00 vs stored 2945794 → ✓ RECONCILES  


### 4.5 Offer Document


**Doc id**: 116  **Status**: draft  

**Figures in offer document**:

- offerPrice: —
- enterpriseValue: —

- averageEbitda (raw): £—
- ebitdaMultiple: —

- Breakdown: `undefined`



### 4.6 Faithfulness Verdict


**NO** — no full-year non-IM periods are available, so the deal model produces a £0 EBITDA. The submitted documents did not yield usable figures under the current filter rules.  

