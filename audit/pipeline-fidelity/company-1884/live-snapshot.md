# Live Snapshot — TC 218 (Prod)

**Prod host**: ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech  
**Snapshot date**: 2026-07-30  

---

## 6.1 Documents on Live Record

| Doc id | Filename | Category | Type | Size | Analysis results | Status |
|---|---|---|---|---|---|---|
| 1484 | Doc4_Asset_Register.pdf | Asset Register | pdf | 3939 | 1 | structure_only |
| 1486 | Doc6_Staff_Matrix.pdf | Staff Matrix | pdf | 4638 | 1 | structure_only |
| 1487 | Doc7_Deal_Documents.pdf | Deal Documents | pdf | 5254 | 0 | no_analysis |
| 1488 | Doc1_Company_Accounts.pdf | Company Accounts | pdf | 5326 | 3 | usable_figures |
| 1489 | Doc2_YTD_Profit_and_Loss.pdf | YTD Profit & Loss | pdf | 4918 | 1 | usable_figures |
| 1490 | Doc3_YTD_Balance_Sheet (1).pdf | YTD Balance Sheet | pdf | 4684 | 1 | usable_figures |
| 1505 | Doc8_Company_Accounts_FY26.pdf | Company Accounts | pdf | 6434 | 3 | usable_figures |
| 1506 | Doc6_Staff_Matrix.pdf | Sales Ledger | pdf | 400246 | 1 | usable_figures |

## 6.2 Live Financial Periods

| id | period_type | fiscal_year | period_end | is_full_year | months | source_tier | IS rows | BS rows |
|---|---|---|---|---|---|---|---|---|
| 1218 | statutory | 2023 | Wed May 31 2023 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |
| 1219 | statutory | 2024 | Fri May 31 2024 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |
| 1220 | management | 2025 | Sat May 31 2025 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | management | 1 | 1 |
| 1224 | management | 2026 | Sun May 31 2026 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | management | 0 | 1 |
| 1240 | management | 2026 | Thu Dec 31 2026 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | null | 1 | 0 |

**Usable EBITDA years** (full-year, non-IM, has IS): 2023, 2024, 2025, 2026  


## 6.3 Most Recent Expert Analysis



### data_quality (id=2435)
**Status**: success  **Score**: 67  **Confidence**: medium  **Created**: Thu Jul 02 2026 11:28:39 GMT+0000 (Coordinated Universal Time)  


### deal_structure (id=3043)
**Status**: success  **Score**: 75  **Confidence**: high  **Created**: Mon Jul 27 2026 02:57:26 GMT+0000 (Coordinated Universal Time)  


### financial (id=3037)
**Status**: success  **Score**: 82  **Confidence**: high  **Created**: Mon Jul 27 2026 02:57:25 GMT+0000 (Coordinated Universal Time)  


### operational (id=3038)
**Status**: success  **Score**: 72  **Confidence**: high  **Created**: Mon Jul 27 2026 02:57:26 GMT+0000 (Coordinated Universal Time)  


### qoe (id=3040)
**Status**: success  **Score**: 78  **Confidence**: high  **Created**: Mon Jul 27 2026 02:57:26 GMT+0000 (Coordinated Universal Time)  

Adjusted EBITDA: conservative=£2510565 base=£2583885 optimistic=£2725565  


### risk (id=3039)
**Status**: success  **Score**: 72  **Confidence**: medium  **Created**: Mon Jul 27 2026 02:57:26 GMT+0000 (Coordinated Universal Time)  


### screening (id=2436)
**Status**: success  **Score**: —  **Confidence**: —  **Created**: Thu Jul 02 2026 11:28:45 GMT+0000 (Coordinated Universal Time)  


### sector (id=3041)
**Status**: success  **Score**: 68  **Confidence**: medium  **Created**: Mon Jul 27 2026 02:57:26 GMT+0000 (Coordinated Universal Time)  


### synthesis (id=3044)
**Status**: success  **Score**: —  **Confidence**: —  **Created**: Mon Jul 27 2026 02:57:26 GMT+0000 (Coordinated Universal Time)  


### valuation (id=3042)
**Status**: success  **Score**: 85  **Confidence**: high  **Created**: Mon Jul 27 2026 02:57:26 GMT+0000 (Coordinated Universal Time)  

Multiple: —  adjusted_ebitda_base: £—  


## 6.4 Live Deal Models



### Model id=130 name="Deal Model v1"

| Column | Value |
|---|---|
| averaging_years | 3 |
| ebitda_multiple | 4.25 |
| calculated_ebitda | 4488010.666666667 |
| adjusted_ebitda | 4488010.666666667 |
| total_purchase_price | 21662159.333333336 |
| is_locked | false |


**Adjustments (3)**:
| id | type | category | description | amount | status | accepted |
|---|---|---|---|---|---|---|
| 605 | deduction | bad_debt_provision | Inventory Obsolescence Provision | £346019 | suggested | false |
| 606 | deduction | deferred_maintenance | Maintenance Capex Requirement | £90619 | suggested | false |
| 604 | add_back | one_off_cost | Depreciation of Tangible Assets | £90619 | accepted | true |


### Model id=131 name="Deal Model v2"

| Column | Value |
|---|---|
| averaging_years | 3 |
| ebitda_multiple | 4.25 |
| calculated_ebitda | 2138647.6666666665 |
| adjusted_ebitda | 2138647.6666666665 |
| total_purchase_price | 11677366.583333332 |
| is_locked | false |


**Adjustments (3)**:
| id | type | category | description | amount | status | accepted |
|---|---|---|---|---|---|---|
| 607 | add_back | one_off_cost | Depreciation of Tangible Assets | £90619 | suggested | false |
| 608 | deduction | bad_debt_provision | Inventory Obsolescence Provision | £346019 | suggested | false |
| 609 | deduction | deferred_maintenance | Maintenance Capex Requirement | £90619 | suggested | false |


### Model id=134 name="Deal Model v3"

| Column | Value |
|---|---|
| averaging_years | 3 |
| ebitda_multiple | 4.25 |
| calculated_ebitda | 4488010.666666667 |
| adjusted_ebitda | 4488010.666666667 |
| total_purchase_price | 21662159.333333336 |
| is_locked | false |


**Adjustments (3)**:
| id | type | category | description | amount | status | accepted |
|---|---|---|---|---|---|---|
| 621 | add_back | one_off_cost | Depreciation of Tangible Assets | £90619 | accepted | true |
| 622 | deduction | bad_debt_provision | Inventory Obsolescence Provision | £346019 | suggested | false |
| 623 | deduction | deferred_maintenance | Maintenance Capex Requirement | £90619 | suggested | false |


### Current Offers & Offer Documents


**current_offer id=11** sent_at=Wed Jul 01 2026 11:45:52 GMT+0000 (Coordinated Universal Time) deal_model_id=130 offer_price=£2,588,114 ev=£0 status=sent  

Stored averageEbitda=£0 multiple=4.25 breakdownText: Average Adjusted EBITDA: £0 | Enterprise Value (Adjusted EBITDA × 4.25 multiple): £0 | Plus Excess Cash: £2,950,000 | Less Primary Debt: (£15,867) | Less Working Capital Adjustment: (£346,019) |  | Total Offer Price: £2,588,114  


## 6.5 Live EBITDA Recomputation (current data, filter rules)


**Eligible years** (full-year, non-IM, has IS data): 2026, 2025, 2024, 2023  

**Top 3 (averaging window)**: 2026, 2025, 2024  

- 2026: £2005593  

- 2025: £2822727  

- 2024: £1626170  

**Live raw avg EBITDA**: £2151496.67  

**Stored adjusted_ebitda**: £4488010.666666667 (model id=130)  

**Δ live_avg_raw vs stored**: £2336514.00 (note: adjusted_ebitda includes QoE adjustments, so raw avg ≠ stored is expected)  

**Offer averageEbitda**: £0 vs live raw avg £2151496.67 Δ=£2151496.67  

**⚠ OFFER FIGURE DIFFERS FROM LIVE DATA BY £2151496.67**  

