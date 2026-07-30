# Live Snapshot — TC 137 (Prod)

**Prod host**: ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech  
**Snapshot date**: 2026-07-30  

---

## 6.1 Documents on Live Record

| Doc id | Filename | Category | Type | Size | Analysis results | Status |
|---|---|---|---|---|---|---|
| 844 | Manor Building Solutions 2023-2024 accounts.pdf | Company Accounts | pdf | 25848 | 3 | usable_figures |
| 845 | Manor Building Solutions 2024-2025 accounts.pdf | Company Accounts | pdf | 25935 | 3 | usable_figures |
| 846 | HPM304_Information_Memorandum_Manor_Building_Solutions_(UK)_Ltd_1.pdf | Deal Documents | pdf | 1393998 | 3 | usable_figures |
| 1299 | Manor 2025-26 draft accounts.pdf | Company Accounts | pdf | 32888 | 3 | usable_figures |
| 1310 | Staff Organisation 2026-06-16 172912.png | Staff Matrix | png | 70911 | 1 | structure_only |
| 1312 | Fixed Assets.xlsm | Asset Register | vnd.ms-excel.sheet.macroEnabled.12 | 9625 | 0 | no_analysis |
| 1596 | Manor Building Solutions YTD P&L.pdf | Deal Documents | pdf | 211271 | 1 | usable_figures |
| 1597 | Manor Building Solutions YTD Balance Sheet.pdf | YTD Balance Sheet | pdf | 204124 | 1 | usable_figures |

## 6.2 Live Financial Periods

| id | period_type | fiscal_year | period_end | is_full_year | months | source_tier | IS rows | BS rows |
|---|---|---|---|---|---|---|---|---|
| 736 | management | 2023 | Fri Mar 31 2023 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | information_memorandum | 1 | 1 |
| 737 | management | 2024 | Sun Mar 31 2024 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | information_memorandum | 1 | 1 |
| 738 | statutory | 2025 | Mon Mar 31 2025 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |
| 742 | statutory | 2026 | Tue Mar 31 2026 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |

**Usable EBITDA years** (full-year, non-IM, has IS): 2025, 2026  


## 6.3 Most Recent Expert Analysis



### data_quality (id=2621)
**Status**: success  **Score**: 78  **Confidence**: medium  **Created**: Thu Jul 09 2026 16:14:21 GMT+0000 (Coordinated Universal Time)  


### deal_structure (id=3083)
**Status**: success  **Score**: 42  **Confidence**: medium  **Created**: Mon Jul 27 2026 13:15:51 GMT+0000 (Coordinated Universal Time)  


### financial (id=3077)
**Status**: success  **Score**: 55  **Confidence**: medium  **Created**: Mon Jul 27 2026 13:15:51 GMT+0000 (Coordinated Universal Time)  


### operational (id=3078)
**Status**: success  **Score**: 68  **Confidence**: high  **Created**: Mon Jul 27 2026 13:15:51 GMT+0000 (Coordinated Universal Time)  


### qoe (id=3080)
**Status**: success  **Score**: 45  **Confidence**: medium  **Created**: Mon Jul 27 2026 13:15:51 GMT+0000 (Coordinated Universal Time)  

Adjusted EBITDA: conservative=£-157427.01 base=£-63273.01 optimistic=£30880.99  


### risk (id=3079)
**Status**: success  **Score**: 68  **Confidence**: medium  **Created**: Mon Jul 27 2026 13:15:51 GMT+0000 (Coordinated Universal Time)  


### screening (id=2622)
**Status**: success  **Score**: —  **Confidence**: —  **Created**: Thu Jul 09 2026 16:14:29 GMT+0000 (Coordinated Universal Time)  


### sector (id=3081)
**Status**: success  **Score**: 52  **Confidence**: medium  **Created**: Mon Jul 27 2026 13:15:51 GMT+0000 (Coordinated Universal Time)  


### synthesis (id=3084)
**Status**: success  **Score**: —  **Confidence**: —  **Created**: Mon Jul 27 2026 13:15:51 GMT+0000 (Coordinated Universal Time)  


### valuation (id=3082)
**Status**: success  **Score**: 45  **Confidence**: medium  **Created**: Mon Jul 27 2026 13:15:51 GMT+0000 (Coordinated Universal Time)  

Multiple: —  adjusted_ebitda_base: £—  


## 6.4 Live Deal Models



### Model id=84 name="Deal Model v1"

| Column | Value |
|---|---|
| averaging_years | 2 |
| ebitda_multiple | 2.5 |
| calculated_ebitda | 239378.06 |
| adjusted_ebitda | 239378.06 |
| total_purchase_price | 151518.15000000002 |
| is_locked | false |


**Adjustments (5)**:
| id | type | category | description | amount | status | accepted |
|---|---|---|---|---|---|---|
| 403 | deduction | replacement_salary | Replacement MD Salary Adjustment | £32360 | suggested | false |
| 404 | deduction | deferred_maintenance | Vehicle Fleet Replacement Provision | £15000 | suggested | false |
| 405 | deduction | bad_debt_provision | Bad Debt Provisioning (Debtor Risk) | £14327 | suggested | false |
| 401 | add_back | owner_salary_excess | Excess Director Pension Contributions | £60494 | accepted | true |
| 402 | add_back | one_off_cost | Non-recurring Professional Fees | £167300 | modified | true |


## 6.5 Live EBITDA Recomputation (current data, filter rules)


**Eligible years** (full-year, non-IM, has IS data): 2026, 2025  

**Top 2 (averaging window)**: 2026, 2025  

- 2026: £30675.49  

- 2025: £489389  

**Live raw avg EBITDA**: £260032.24  

**Stored adjusted_ebitda**: £239378.06 (model id=84)  

**Δ live_avg_raw vs stored**: £20654.18 (note: adjusted_ebitda includes QoE adjustments, so raw avg ≠ stored is expected)  

