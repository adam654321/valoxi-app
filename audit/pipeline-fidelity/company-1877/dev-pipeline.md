# Pipeline Fidelity: TC 228 (Thor-CON)

**Dev TC ID**: 1877  
**Prod TC ID**: 228  
**Industry**: Home Services & Property Maintenance  
**Sub-sector**: Heating, Ventilation & Air Conditioning (HVAC)  
**Audit date**: 2026-07-30  

---

## Phase 1 — Document Cloning

**Dev DB host**: helium  
**Prod DB host**: ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech  

| Prod ID | Dev ID | Filename | Category | Type | Size | R2 Key | HEAD OK |
|---|---|---|---|---|---|---|---|
| 1624 | 5830 | Signed - Full Accounts - 31032024_230330.pdf | Company Accounts | pdf | 397088 | `companies/228/doc-1784214789681-342348647.pdf` | ✓ |
| 1759 | 5831 | Year Ending 31.03.2023.pdf | Company Accounts | pdf | 91859 | `companies/228/doc-1784216448649-638236711.pdf` | ✓ |
| 1762 | 5832 | Midland_Air_Conditioning___Facility_Management_Ltd_-_Profit_and_Loss (31) DRAFT.pdf | Company Accounts | pdf | 28001 | `companies/228/doc-1784216927322-99318749.pdf` | ✓ |
| 1763 | 5833 | P&L YE 31.03.2026.pdf | YTD Profit & Loss | pdf | 25634 | `companies/228/doc-1784216942561-584515673.pdf` | ✓ |
| 1764 | 5834 | MI Presentation 06-25.pptx | Deal Documents | vnd.openxmlformats-officedocument.presentationml.presentation | 796328 | `companies/228/doc-1784217011240-707079318.pptx` | ✓ |
| 1765 | 5835 | 154764 - Midland Air Conditioning & Facility Management Ltd.pdf | Deal Documents | pdf | 5607240 | `companies/228/doc-1784217025842-596919980.pdf` | ✓ |
| 1775 | 5836 | Balance Sheet.pdf | Company Accounts | pdf | 26424 | `companies/228/doc-1784222385163-591978777.pdf` | ✓ |
| 1777 | 5837 | MAC Sales Ledger 01.04.25 to 08.09.25.csv | Sales Ledger | csv | 53351 | `companies/228/doc-1784226449803-712664815.csv` | ✓ |
| 1778 | 5838 | MAC Staff Matrix - Sept 2025.csv | Staff Matrix | csv | 3821 | `companies/228/doc-1784226459457-262851834.csv` | ✓ |
| 1779 | 5839 | MAC Fixed Asset Register 08.09.25.csv | Asset Register | csv | 6329 | `companies/228/doc-1784226472422-618799378.csv` | ✓ |
| 1780 | 5840 | signed_nda_228_2026-07-16T18-58-57-118Z.pdf | Deal Documents | pdf | 70090 | `signed-ndas/doc-1784228337118-311080624.pdf` | ✓ |

---

## Phase 2 — Classification & Extraction


**Before state**: 0 periods, 0 IS rows, 0 BS rows


### Doc 1624 → dev 5830: `Signed - Full Accounts - 31032024_230330.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1136 | company_accounts | Thu Jul 30 2026 01:03:59 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1137 | profit_and_loss | Thu Jul 30 2026 01:03:59 GMT+0000 (Coordinated Universal Time) | 2023, 2024 | ✓ | ✓ | ✓ | ✗ |
| 1138 | balance_sheet | Thu Jul 30 2026 01:03:59 GMT+0000 (Coordinated Universal Time) | 2023, 2024 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 2

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7948 | statutory | 2023 | 2023-03-31 | true | 12 | statutory | 5830 |
| 7949 | statutory | 2024 | 2024-03-31 | true | 12 | statutory | 5830 |


### Doc 1759 → dev 5831: `Year Ending 31.03.2023.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1139 | company_accounts | Thu Jul 30 2026 01:04:23 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1140 | profit_and_loss | Thu Jul 30 2026 01:04:23 GMT+0000 (Coordinated Universal Time) | 2022, 2023 | ✓ | ✓ | ✓ | ✗ |
| 1141 | balance_sheet | Thu Jul 30 2026 01:04:23 GMT+0000 (Coordinated Universal Time) | 2022, 2023 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7950 | statutory | 2022 | 2022-03-31 | true | 12 | statutory | 5831 |


**Changed periods**: 2 — see raw/phase2-doc-5831-before-after.json


### Doc 1762 → dev 5832: `Midland_Air_Conditioning___Facility_Management_Ltd_-_Profit_and_Loss (31) DRAFT.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1142 | company_accounts | Thu Jul 30 2026 01:04:36 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1143 | profit_and_loss | Thu Jul 30 2026 01:04:36 GMT+0000 (Coordinated Universal Time) | 2025 | ✓ | ✓ | ✗ | ✗ |
| 1144 | balance_sheet | Thu Jul 30 2026 01:04:36 GMT+0000 (Coordinated Universal Time) | 2025 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7951 | management | 2025 | 2025-03-31 | true | 12 | management | 5832 |


**Changed periods**: 3 — see raw/phase2-doc-5832-before-after.json


### Doc 1763 → dev 5833: `P&L YE 31.03.2026.pdf`

**Category**: YTD Profit & Loss  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 1 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1145 | profit_and_loss | Thu Jul 30 2026 01:04:44 GMT+0000 (Coordinated Universal Time) | 2026 | ✓ | ✓ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7952 | management | 2026 | 2026-03-31 | false | null | management | 5833 |


**Changed periods**: 4 — see raw/phase2-doc-5833-before-after.json


### Doc 1764 → dev 5834: `MI Presentation 06-25.pptx`

**Category**: Deal Documents  **Type**: application/vnd.openxmlformats-officedocument.presentationml.presentation  **Status**: `produced_nothing`  

**Reason**: webhook_status=classification_failed  **Webhook**: `classification_failed`  


### Doc 1765 → dev 5835: `154764 - Midland Air Conditioning & Facility Management Ltd.pdf`

**Category**: Deal Documents  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1146 | company_accounts | Thu Jul 30 2026 01:05:27 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1147 | profit_and_loss | Thu Jul 30 2026 01:05:27 GMT+0000 (Coordinated Universal Time) | 2021, 2022, 2023, 2024, 2025 | ✓ | ✓ | ✓ | ✗ |
| 1148 | balance_sheet | Thu Jul 30 2026 01:05:28 GMT+0000 (Coordinated Universal Time) | 2021, 2022, 2023, 2024 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7953 | management | 2021 | 2021-03-31 | true | 12 | information_memorandum | 5835 |


**Changed periods**: 5 — see raw/phase2-doc-5835-before-after.json


### Doc 1775 → dev 5836: `Balance Sheet.pdf`

**Category**: Company Accounts  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1149 | company_accounts | Thu Jul 30 2026 01:05:41 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1150 | profit_and_loss | Thu Jul 30 2026 01:05:41 GMT+0000 (Coordinated Universal Time) | 2025 | ✗ | ✗ | ✗ | ✗ |
| 1151 | balance_sheet | Thu Jul 30 2026 01:05:41 GMT+0000 (Coordinated Universal Time) | 2025 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7958 | management | 2025 | 2025-09-08 | false | null | management | 5836 |


**Changed periods**: 6 — see raw/phase2-doc-5836-before-after.json


### Doc 1777 → dev 5837: `MAC Sales Ledger 01.04.25 to 08.09.25.csv`

**Category**: Sales Ledger  **Type**: text/csv  **Status**: `produced_structure_all_nulls`  

**Reason**: 1 result row(s) but no year data  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1152 | sales_ledger | Thu Jul 30 2026 01:05:49 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


### Doc 1778 → dev 5838: `MAC Staff Matrix - Sept 2025.csv`

**Category**: Staff Matrix  **Type**: text/csv  **Status**: `produced_structure_all_nulls`  

**Reason**: 1 result row(s) but no year data  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1153 | staff_matrix | Thu Jul 30 2026 01:06:00 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


**Changed periods**: 1 — see raw/phase2-doc-5838-before-after.json


### Doc 1779 → dev 5839: `MAC Fixed Asset Register 08.09.25.csv`

**Category**: Asset Register  **Type**: text/csv  **Status**: `produced_structure_all_nulls`  

**Reason**: 1 result row(s) but no year data  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1154 | asset_register | Thu Jul 30 2026 01:06:15 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


### Doc 1780 → dev 5840: `signed_nda_228_2026-07-16T18-58-57-118Z.pdf`

**Category**: Deal Documents  **Type**: application/pdf  **Status**: `produced_nothing`  

**Reason**: webhook_status=classification_complete  **Webhook**: `classification_complete`  


---

### Phase 2 Final State


**Final**: 7 periods, 6 IS rows, 6 BS rows


| Period id | period_type | fiscal_year | period_end | is_full_year | months | source_tier | IS rows | BS rows |
|---|---|---|---|---|---|---|---|---|
| 7952 | management | 2026 | 2026-07-30 | false | — | management | 1 | 0 |
| 7951 | management | 2025 | 2025-03-31 | true | 12 | management | 1 | 1 |
| 7953 | management | 2021 | 2021-03-31 | true | 12 | information_memorandum | 1 | 1 |
| 7958 | management | 2025 | 2025-09-08 | false | — | management | 0 | 1 |
| 7948 | statutory | 2023 | 2023-03-31 | true | 12 | statutory | 1 | 1 |
| 7949 | statutory | 2024 | 2024-03-31 | true | 12 | statutory | 1 | 1 |
| 7950 | statutory | 2022 | 2022-03-31 | true | 12 | statutory | 1 | 1 |


**Usable EBITDA years** (full-year, non-IM): 2025, 2023, 2024, 2022  


---

## Phase 3 — Expert Analysis


**Expert results**: 8 records



### Expert: synthesis (id=800)

**Status**: success  **Score**: —  **Confidence**: —  **Time**: 18008ms  


### Expert: risk (id=795)

**Status**: success  **Score**: 68  **Confidence**: high  **Time**: 10353ms  


### Expert: financial (id=793)

**Status**: success  **Score**: 72  **Confidence**: high  **Time**: 11822ms  


**Yearly EBITDA from financial expert**:

- 2022: EBITDA=£137739  revenue=£1097307  op_profit=£126779  

- 2023: EBITDA=£183593  revenue=£1441671  op_profit=£172769  

- 2024: EBITDA=£129198  revenue=£1695203  op_profit=£77287  

- 2025: EBITDA=£278403.9  revenue=£1944079  op_profit=£278403.9  


### Expert: operational (id=794)

**Status**: success  **Score**: 72  **Confidence**: high  **Time**: 12412ms  


### Expert: sector (id=797)

**Status**: success  **Score**: 68  **Confidence**: high  **Time**: 6991ms  


### Expert: qoe (id=796)

**Status**: success  **Score**: 68  **Confidence**: medium  **Time**: 11003ms  


**QoE Summary**:

- Total add-backs: 1
- Total deductions: 3


| Item | Type | Category | Amount | Recurrence | Defensibility |
|---|---|---|---|---|---|

| undefined | add_back | personal_expense | £6000 | recurring | 9 |

| undefined | deduction | replacement_salary | £48904 | recurring | 9 |

| undefined | deduction | bad_debt_provision | £2269.82 | one_off | 10 |

| undefined | deduction | deferred_maintenance | £51911 | recurring | 7 |


**Adjusted EBITDA scenarios**:

- Conservative: £175319.08
- Base: £181319.08
- Optimistic: £181319.08


*Base EBITDA: £—  + Add-backs: £—  – Deductions: £—  = £—*  


### Expert: valuation (id=798)

**Status**: success  **Score**: 75  **Confidence**: high  **Time**: 9507ms  


**Valuation figures**: multiple=undefined range=[undefined–undefined]  

adjusted_ebitda_base: £—  

Bridge: EV=£— +cash=£— -LTD=£— -DL=£— -WC=£— → offer=£—  


### Expert: deal_structure (id=799)

**Status**: success  **Score**: 65  **Confidence**: high  **Time**: 14269ms  


### 3.4 Figure Traceability Check


**Reconciled EBITDA by year (input)**: {"2022":137739,"2023":183593,"2024":129198,"2025":278403.9}


All key figures traceable to input (or no mismatch detected).


### 3.5 Database Writes


Expert analysis writes to: **expert_analysis_results** table only.  

No writes to deal_model_adjustments, ebitda_adjustments, valuations, or financial tables during Phase 3.  

(deal_model_adjustments are created at deal model creation time in Phase 4.)


---

## Phase 4 — Deal Model


**Model id**: 486  **Name**: Audit Model — TC 228  

**Stored columns**:

- averagingYears: 3
- ebitdaMultiple: 2.5

- calculated_ebitda: null
- adjusted_ebitda: 181319.08

- enterprise_value: 453297.7
- offer_driver: ebitda

- target_offer_price: null
- total_purchase_price: null

- is_locked: false



### 4.2 EBITDA Years


**All available years**: 2025, 2024, 2023, 2022 (4 total)

**Averaging window** (N=3): years=2025, 2024, 2023


| Year | Reported EBITDA |
|---|---|

| 2025 | £278403.9 |

| 2024 | £129198 |

| 2023 | £183593 |


**Sum**: £591194.90  **÷3**  = **£197064.97** raw average  

**Calculator averageAdjustedEbitda**: £197064.96666666667  

**Reconciles to raw avg**: roughly (adjustments applied below)  


### 4.3 Adjustments (5 rows)


| id | type | category | description | amount | amounts_by_year | status | is_accepted |
|---|---|---|---|---|---|---|---|

| 2029 | add_back | personal_expense | Director Pension Contribution | £6000 | — | suggested | false |

| 2030 | deduction | replacement_salary | Director Salary Market Rate Adjustment | £48904 | — | suggested | false |

| 2031 | deduction | bad_debt_provision | Specific Bad Debt Provision (INV-8412) | £2269.82 | {"2021":0,"2022":0,"2023":0,"2024":0,"2025":2269.82,"2026":0} | suggested | false |

| 2032 | deduction | deferred_maintenance | Pro-forma Depreciation Charge | £51911 | — | suggested | false |

| 2033 | deduction | replacement_salary | Director replacement cost: Director (current: 9096, market: 57500) | £48404 | — | suggested | false |


*Note: amounts above are the stored amounts. The calculator applies year-specific overrides from amounts_by_year if set.*  

**Calculator averageAdjustedEbitda**: £197064.96666666667  


### 4.4 Enterprise Value & Offer Price Bridge


| Line | Amount |
|---|---|

| Average Adjusted EBITDA | £197064.96666666667 |

| × Multiple (2.5) | £492662.4166666667 |

| + Excess Cash | £0 |

| + Property Value | £0 |

| – Primary Debt | £319252.04 |

| – Other Debt | £16056.67 |

| – Corp Tax Due | £1208.26 |

| – Working Capital Adj | £160557 |

| **Offer Price** | **£-4411.553333333286** |


**Bridge check**: -4411.55 vs stored -4411.553333333286 → ✓ RECONCILES  


### 4.5 Offer Document

**ERROR**: dealDocumentService.generateOfferDocument is not a function


### 4.6 Faithfulness Verdict


**YES** — the deal model uses verified financial periods extracted from submitted documents. 3 fiscal year(s) fed the average (2025, 2024, 2023).  

