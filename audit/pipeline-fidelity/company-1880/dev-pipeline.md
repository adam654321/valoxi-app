# Pipeline Fidelity: TC 89 (Innova Design Group Limited)

**Dev TC ID**: 1880  
**Prod TC ID**: 89  
**Industry**: Manufacturing  
**Sub-sector**: Metal Fabrication & Welding  
**Audit date**: 2026-07-30  

---

## Phase 1 — Document Cloning

**Dev DB host**: helium  
**Prod DB host**: ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech  

| Prod ID | Dev ID | Filename | Category | Type | Size | R2 Key | HEAD OK |
|---|---|---|---|---|---|---|---|
| 1668 | 5857 | doc-1777320748873-193749054.pdf | Restored | octet-stream | 90888 | `companies/89/doc-1777320748873-193749054.pdf` | ✓ |
| 1669 | 5858 | doc-1777320831981-40650166.xlsx | Restored | octet-stream | 130708 | `companies/89/doc-1777320831981-40650166.xlsx` | ✓ |
| 1670 | 5859 | doc-1777320863799-891328168.pdf | Restored | octet-stream | 130756 | `companies/89/doc-1777320863799-891328168.pdf` | ✓ |
| 1671 | 5860 | doc-1777320908889-481369088.pdf | Restored | octet-stream | 264075 | `companies/89/doc-1777320908889-481369088.pdf` | ✓ |
| 1672 | 5861 | doc-1777320937794-82781259.pdf | Restored | octet-stream | 97831 | `companies/89/doc-1777320937794-82781259.pdf` | ✓ |
| 1673 | 5862 | doc-1777320972331-861910426.pdf | Restored | octet-stream | 89064 | `companies/89/doc-1777320972331-861910426.pdf` | ✓ |
| 1674 | 5863 | doc-1777321003082-792026998.pdf | Restored | octet-stream | 88966 | `companies/89/doc-1777321003082-792026998.pdf` | ✓ |
| 1675 | 5864 | doc-1777321108865-628961648.pdf | Restored | octet-stream | 167867 | `companies/89/doc-1777321108865-628961648.pdf` | ✓ |
| 1676 | 5865 | doc-1783152904384-594607571.pdf | Restored | pdf | 357718 | `companies/89/doc-1783152904384-594607571.pdf` | ✓ |
| 1677 | 5866 | doc-1783152919710-270636692.pdf | Restored | pdf | 304416 | `companies/89/doc-1783152919710-270636692.pdf` | ✓ |
| 1678 | 5867 | doc-1783152961971-950185558.pdf | Restored | pdf | 81641 | `companies/89/doc-1783152961971-950185558.pdf` | ✓ |
| 1679 | 5868 | doc-1783152989923-333352671.pdf | Restored | pdf | 97831 | `companies/89/doc-1783152989923-333352671.pdf` | ✓ |
| 1680 | 5869 | doc-1783153004056-936850820.pdf | Restored | pdf | 80398 | `companies/89/doc-1783153004056-936850820.pdf` | ✓ |
| 1681 | 5870 | doc-1783153025122-485578271.pdf | Restored | pdf | 119478 | `companies/89/doc-1783153025122-485578271.pdf` | ✓ |
| 1682 | 5871 | doc-1783153036464-32715274.xlsx | Restored | vnd.openxmlformats-officedocument.spreadsheetml.sheet | 130376 | `companies/89/doc-1783153036464-32715274.xlsx` | ✓ |
| 1683 | 5872 | doc-1783153142469-611908424.xlsx | Restored | vnd.openxmlformats-officedocument.spreadsheetml.sheet | 18502 | `companies/89/doc-1783153142469-611908424.xlsx` | ✓ |

---

## Phase 2 — Classification & Extraction


**Before state**: 0 periods, 0 IS rows, 0 BS rows


### Doc 1668 → dev 5857: `doc-1777320748873-193749054.pdf`

**Category**: Restored  **Type**: application/octet-stream  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1186 | company_accounts | Thu Jul 30 2026 01:24:54 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1187 | profit_and_loss | Thu Jul 30 2026 01:24:54 GMT+0000 (Coordinated Universal Time) | 2024, 2025 | ✓ | ✓ | ✓ | ✗ |
| 1188 | balance_sheet | Thu Jul 30 2026 01:24:54 GMT+0000 (Coordinated Universal Time) | 2024, 2025 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 2

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7973 | statutory | 2024 | 2024-10-31 | true | 12 | statutory | 5857 |
| 7974 | statutory | 2025 | 2025-10-31 | true | 12 | statutory | 5857 |


### Doc 1669 → dev 5858: `doc-1777320831981-40650166.xlsx`

**Category**: Restored  **Type**: application/octet-stream  **Status**: `produced_structure_all_nulls`  

**Reason**: 1 result row(s) but no year data  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1189 | asset_register | Thu Jul 30 2026 01:25:09 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


### Doc 1670 → dev 5859: `doc-1777320863799-891328168.pdf`

**Category**: Restored  **Type**: application/octet-stream  **Status**: `produced_nothing`  

**Reason**: webhook_status=classification_complete  **Webhook**: `classification_complete`  


### Doc 1671 → dev 5860: `doc-1777320908889-481369088.pdf`

**Category**: Restored  **Type**: application/octet-stream  **Status**: `produced_usable_figures`  

**Reason**: 1 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1190 | profit_and_loss | Thu Jul 30 2026 01:25:22 GMT+0000 (Coordinated Universal Time) | 2025 | ✓ | ✓ | ✓ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7975 | management | 2025 | 2025-10-31 | false | null | management | 5860 |


**Changed periods**: 2 — see raw/phase2-doc-5860-before-after.json


### Doc 1672 → dev 5861: `doc-1777320937794-82781259.pdf`

**Category**: Restored  **Type**: application/octet-stream  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1191 | company_accounts | Thu Jul 30 2026 01:25:43 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1192 | profit_and_loss | Thu Jul 30 2026 01:25:43 GMT+0000 (Coordinated Universal Time) | 2023, 2024 | ✓ | ✓ | ✓ | ✗ |
| 1193 | balance_sheet | Thu Jul 30 2026 01:25:43 GMT+0000 (Coordinated Universal Time) | 2023, 2024 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7976 | statutory | 2023 | 2023-10-31 | true | 12 | statutory | 5861 |


**Changed periods**: 3 — see raw/phase2-doc-5861-before-after.json


### Doc 1673 → dev 5862: `doc-1777320972331-861910426.pdf`

**Category**: Restored  **Type**: application/octet-stream  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1194 | company_accounts | Thu Jul 30 2026 01:26:07 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1195 | profit_and_loss | Thu Jul 30 2026 01:26:07 GMT+0000 (Coordinated Universal Time) | 2022, 2023 | ✓ | ✓ | ✓ | ✗ |
| 1196 | balance_sheet | Thu Jul 30 2026 01:26:07 GMT+0000 (Coordinated Universal Time) | 2022, 2023 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7977 | statutory | 2022 | 2022-10-31 | true | 12 | statutory | 5862 |


**Changed periods**: 4 — see raw/phase2-doc-5862-before-after.json


### Doc 1674 → dev 5863: `doc-1777321003082-792026998.pdf`

**Category**: Restored  **Type**: application/octet-stream  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1197 | company_accounts | Thu Jul 30 2026 01:26:30 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1198 | profit_and_loss | Thu Jul 30 2026 01:26:30 GMT+0000 (Coordinated Universal Time) | 2021, 2022 | ✓ | ✓ | ✓ | ✗ |
| 1199 | balance_sheet | Thu Jul 30 2026 01:26:31 GMT+0000 (Coordinated Universal Time) | 2021, 2022 | ✗ | ✗ | ✗ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7978 | statutory | 2021 | 2021-10-31 | true | 12 | statutory | 5863 |


**Changed periods**: 5 — see raw/phase2-doc-5863-before-after.json


### Doc 1675 → dev 5864: `doc-1777321108865-628961648.pdf`

**Category**: Restored  **Type**: application/octet-stream  **Status**: `produced_structure_all_nulls`  

**Reason**: 1 result row(s) but no year data  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1200 | sales_ledger | Thu Jul 30 2026 01:26:39 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


### Doc 1676 → dev 5865: `doc-1783152904384-594607571.pdf`

**Category**: Restored  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 1 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1201 | profit_and_loss | Thu Jul 30 2026 01:26:51 GMT+0000 (Coordinated Universal Time) | 2025, 2026 | ✓ | ✓ | ✓ | ✗ |


**New periods created**: 1

| id | period_type | fiscal_year | period_end | is_full_year | months_covered | source_tier | source_doc_id |
|---|---|---|---|---|---|---|---|
| 7979 | management | 2026 | 2026-05-31 | false | 5 | management | 5865 |


**Changed periods**: 6 — see raw/phase2-doc-5865-before-after.json


### Doc 1677 → dev 5866: `doc-1783152919710-270636692.pdf`

**Category**: Restored  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 1 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1202 | balance_sheet | Thu Jul 30 2026 01:27:00 GMT+0000 (Coordinated Universal Time) | 2026 | ✗ | ✗ | ✗ | ✗ |


**Changed periods**: 7 — see raw/phase2-doc-5866-before-after.json


### Doc 1678 → dev 5867: `doc-1783152961971-950185558.pdf`

**Category**: Restored  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1203 | company_accounts | Thu Jul 30 2026 01:27:23 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1204 | profit_and_loss | Thu Jul 30 2026 01:27:23 GMT+0000 (Coordinated Universal Time) | 2024, 2025 | ✓ | ✓ | ✓ | ✗ |
| 1205 | balance_sheet | Thu Jul 30 2026 01:27:24 GMT+0000 (Coordinated Universal Time) | 2024, 2025 | ✗ | ✗ | ✗ | ✗ |


**Changed periods**: 7 — see raw/phase2-doc-5867-before-after.json


### Doc 1679 → dev 5868: `doc-1783152989923-333352671.pdf`

**Category**: Restored  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1206 | company_accounts | Thu Jul 30 2026 01:27:46 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1207 | profit_and_loss | Thu Jul 30 2026 01:27:46 GMT+0000 (Coordinated Universal Time) | 2023, 2024 | ✓ | ✓ | ✓ | ✗ |
| 1208 | balance_sheet | Thu Jul 30 2026 01:27:46 GMT+0000 (Coordinated Universal Time) | 2023, 2024 | ✗ | ✗ | ✗ | ✗ |


**Changed periods**: 7 — see raw/phase2-doc-5868-before-after.json


### Doc 1680 → dev 5869: `doc-1783153004056-936850820.pdf`

**Category**: Restored  **Type**: application/pdf  **Status**: `produced_usable_figures`  

**Reason**: 3 result row(s)  **Webhook**: `analysis_complete`  


**Analysis results** (3 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1209 | company_accounts | Thu Jul 30 2026 01:28:09 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |
| 1210 | profit_and_loss | Thu Jul 30 2026 01:28:09 GMT+0000 (Coordinated Universal Time) | 2022, 2023 | ✓ | ✓ | ✓ | ✗ |
| 1211 | balance_sheet | Thu Jul 30 2026 01:28:10 GMT+0000 (Coordinated Universal Time) | 2022, 2023 | ✗ | ✗ | ✗ | ✗ |


**Changed periods**: 7 — see raw/phase2-doc-5869-before-after.json


### Doc 1681 → dev 5870: `doc-1783153025122-485578271.pdf`

**Category**: Restored  **Type**: application/pdf  **Status**: `produced_nothing`  

**Reason**: webhook_status=classification_complete  **Webhook**: `classification_complete`  


### Doc 1682 → dev 5871: `doc-1783153036464-32715274.xlsx`

**Category**: Restored  **Type**: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet  **Status**: `produced_structure_all_nulls`  

**Reason**: 1 result row(s) but no year data  **Webhook**: `analysis_complete`  


**Analysis results** (1 row(s)):

| AR id | document_type | created_at | years | revenue present | op_profit present | D&A present | cash present |
|---|---|---|---|---|---|---|---|
| 1212 | asset_register | Thu Jul 30 2026 01:28:27 GMT+0000 (Coordinated Universal Time) | — | ✗ | ✗ | ✗ | ✗ |


### Doc 1683 → dev 5872: `doc-1783153142469-611908424.xlsx`

**Category**: Restored  **Type**: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet  **Status**: `produced_nothing`  

**Reason**: webhook_status=classification_complete  **Webhook**: `classification_complete`  


---

### Phase 2 Final State


**Final**: 7 periods, 7 IS rows, 6 BS rows


| Period id | period_type | fiscal_year | period_end | is_full_year | months | source_tier | IS rows | BS rows |
|---|---|---|---|---|---|---|---|---|
| 7978 | statutory | 2021 | 2021-10-31 | true | 12 | statutory | 1 | 1 |
| 7973 | statutory | 2024 | 2024-10-31 | true | 12 | statutory | 1 | 1 |
| 7974 | statutory | 2025 | 2025-10-31 | true | 12 | statutory | 1 | 1 |
| 7975 | management | 2025 | 2025-10-31 | false | 2 | management | 1 | 0 |
| 7976 | statutory | 2023 | 2023-10-31 | true | 12 | statutory | 1 | 1 |
| 7977 | statutory | 2022 | 2022-10-31 | true | 12 | statutory | 1 | 1 |
| 7979 | management | 2026 | 2026-05-31 | false | 7 | management | 1 | 1 |


**Usable EBITDA years** (full-year, non-IM): 2021, 2024, 2025, 2023, 2022  


---

## Phase 3 — Expert Analysis


**Expert results**: 8 records



### Expert: synthesis (id=824)

**Status**: success  **Score**: —  **Confidence**: —  **Time**: 17606ms  


### Expert: risk (id=819)

**Status**: success  **Score**: 58  **Confidence**: high  **Time**: 11424ms  


### Expert: operational (id=818)

**Status**: success  **Score**: 68  **Confidence**: medium  **Time**: 12722ms  


### Expert: financial (id=817)

**Status**: success  **Score**: 68  **Confidence**: high  **Time**: 13725ms  


**Yearly EBITDA from financial expert**:

- 2021: EBITDA=£213105  revenue=£4656312  op_profit=£136930  

- 2022: EBITDA=£300235  revenue=£5754293  op_profit=£239201  

- 2023: EBITDA=£180040  revenue=£4450279  op_profit=£125513  

- 2024: EBITDA=£444290  revenue=£4956153  op_profit=£391684  

- 2025: EBITDA=£218038  revenue=£4509086  op_profit=£169033  


### Expert: sector (id=821)

**Status**: success  **Score**: 58  **Confidence**: medium  **Time**: 7430ms  


### Expert: qoe (id=820)

**Status**: success  **Score**: 62  **Confidence**: high  **Time**: 9666ms  


**QoE Summary**:

- Total add-backs: 1
- Total deductions: 3


| Item | Type | Category | Amount | Recurrence | Defensibility |
|---|---|---|---|---|---|

| undefined | add_back | personal_expense | £1800 | recurring | 9 |

| undefined | deduction | replacement_salary | £32360 | recurring | 8 |

| undefined | deduction | bad_debt_provision | £52988 | one_off | 7 |

| undefined | deduction | deferred_maintenance | £25000 | recurring | 6 |


**Adjusted EBITDA scenarios**:

- Conservative: £107530
- Base: £109490
- Optimistic: £134490


*Base EBITDA: £—  + Add-backs: £—  – Deductions: £—  = £—*  


### Expert: valuation (id=822)

**Status**: success  **Score**: 65  **Confidence**: medium  **Time**: 10212ms  


**Valuation figures**: multiple=undefined range=[undefined–undefined]  

adjusted_ebitda_base: £—  

Bridge: EV=£— +cash=£— -LTD=£— -DL=£— -WC=£— → offer=£—  


### Expert: deal_structure (id=823)

**Status**: success  **Score**: 45  **Confidence**: high  **Time**: 14310ms  


### 3.4 Figure Traceability Check


**Reconciled EBITDA by year (input)**: {"2021":213105,"2022":300235,"2023":180040,"2024":444290,"2025":218038}


All key figures traceable to input (or no mismatch detected).


### 3.5 Database Writes


Expert analysis writes to: **expert_analysis_results** table only.  

No writes to deal_model_adjustments, ebitda_adjustments, valuations, or financial tables during Phase 3.  

(deal_model_adjustments are created at deal model creation time in Phase 4.)


---

## Phase 4 — Deal Model


**Model id**: 489  **Name**: Audit Model — TC 89  

**Stored columns**:

- averagingYears: 3
- ebitdaMultiple: 2.5

- calculated_ebitda: null
- adjusted_ebitda: 109490

- enterprise_value: 273725
- offer_driver: ebitda

- target_offer_price: null
- total_purchase_price: null

- is_locked: false



### 4.2 EBITDA Years


**All available years**: 2025, 2024, 2023, 2022, 2021 (5 total)

**Averaging window** (N=3): years=2025, 2024, 2023


| Year | Reported EBITDA |
|---|---|

| 2025 | £218038 |

| 2024 | £444290 |

| 2023 | £180040 |


**Sum**: £842368.00  **÷3**  = **£280789.33** raw average  

**Calculator averageAdjustedEbitda**: £280789.3333333333  

**Reconciles to raw avg**: roughly (adjustments applied below)  


### 4.3 Adjustments (4 rows)


| id | type | category | description | amount | amounts_by_year | status | is_accepted |
|---|---|---|---|---|---|---|---|

| 2043 | add_back | personal_expense | Use of Home as Office | £1800 | — | suggested | false |

| 2044 | deduction | replacement_salary | Director Replacement Salary Adjustment | £32360 | — | suggested | false |

| 2045 | deduction | bad_debt_provision | Bad Debt Provision - Aged Debtors | £52988 | {"2021":0,"2022":0,"2023":0,"2024":0,"2025":52988,"2026":0} | suggested | false |

| 2046 | deduction | deferred_maintenance | Deferred Maintenance / Capex Catch-up | £25000 | — | suggested | false |


*Note: amounts above are the stored amounts. The calculator applies year-specific overrides from amounts_by_year if set.*  

**Calculator averageAdjustedEbitda**: £280789.3333333333  


### 4.4 Enterprise Value & Offer Price Bridge


| Line | Amount |
|---|---|

| Average Adjusted EBITDA | £280789.3333333333 |

| × Multiple (2.5) | £701973.3333333333 |

| + Excess Cash | £210202 |

| + Property Value | £0 |

| – Primary Debt | £182975 |

| – Other Debt | £0 |

| – Corp Tax Due | £39122 |

| – Working Capital Adj | £349824 |

| **Offer Price** | **£340254.33333333326** |


**Bridge check**: 340254.33 vs stored 340254.33333333326 → ✓ RECONCILES  


### 4.5 Offer Document


**Doc id**: 112  **Status**: draft  

**Figures in offer document**:

- offerPrice: —
- enterpriseValue: —

- averageEbitda (raw): £—
- ebitdaMultiple: —

- Breakdown: `undefined`



### 4.6 Faithfulness Verdict


**YES** — the deal model uses verified financial periods extracted from submitted documents. 3 fiscal year(s) fed the average (2025, 2024, 2023).  

