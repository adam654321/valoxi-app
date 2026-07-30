# Live Snapshot — TC 172 (Prod)

**Prod host**: ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech  
**Snapshot date**: 2026-07-30  

---

## 6.1 Documents on Live Record

| Doc id | Filename | Category | Type | Size | Analysis results | Status |
|---|---|---|---|---|---|---|
| 1418 | staff matrix.pdf | Staff Matrix | pdf | 202179 | 1 | structure_only |
| 1419 | Aged Creditors.pdf | Deal Documents | pdf | 46389 | 1 | structure_only |
| 1420 | Balance sheet.pdf | YTD Balance Sheet | pdf | 35258 | 1 | usable_figures |
| 1421 | PNL.pdf | YTD Profit & Loss | pdf | 37601 | 1 | usable_figures |
| 1422 | draft year end 25.pdf | Company Accounts | pdf | 167993 | 3 | usable_figures |
| 1423 | year end 23.pdf | Company Accounts | pdf | 177855 | 2 | usable_figures |
| 1424 | year end 24.pdf | Company Accounts | pdf | 362236 | 3 | usable_figures |
| 1427 | Aged Debtors.pdf | Deal Documents | pdf | 40949 | 1 | structure_only |
| 1428 | Top 10 Customers 21.05.26.xlsx | Deal Documents | vnd.openxmlformats-officedocument.spreadsheetml.sheet | 10362 | 0 | no_analysis |
| 1429 | april management accs.pdf | Company Accounts | pdf | 35017 | 3 | usable_figures |
| 1430 | Business Overview.pdf | Company Accounts | pdf | 5147128 | 3 | usable_figures |
| 1431 | Asset register.xlsx | Asset Register | vnd.openxmlformats-officedocument.spreadsheetml.sheet | 88328 | 0 | no_analysis |

## 6.2 Live Financial Periods

| id | period_type | fiscal_year | period_end | is_full_year | months | source_tier | IS rows | BS rows |
|---|---|---|---|---|---|---|---|---|
| 983 | statutory | 2022 | Thu Mar 31 2022 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |
| 984 | statutory | 2023 | Fri Mar 31 2023 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |
| 994 | statutory | 2024 | Sun Mar 31 2024 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |
| 995 | statutory | 2025 | Mon Mar 31 2025 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |
| 991 | statutory | 2026 | Tue Mar 31 2026 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |

**Usable EBITDA years** (full-year, non-IM, has IS): 2022, 2023, 2024, 2025, 2026  


## 6.3 Most Recent Expert Analysis



### data_quality (id=2336)
**Status**: success  **Score**: 62  **Confidence**: medium  **Created**: Mon Jun 29 2026 15:27:29 GMT+0000 (Coordinated Universal Time)  


### deal_structure (id=1868)
**Status**: success  **Score**: 58  **Confidence**: high  **Created**: Sun Jun 07 2026 10:32:52 GMT+0000 (Coordinated Universal Time)  


### financial (id=1862)
**Status**: success  **Score**: 68  **Confidence**: high  **Created**: Sun Jun 07 2026 10:32:51 GMT+0000 (Coordinated Universal Time)  


### operational (id=1863)
**Status**: success  **Score**: 72  **Confidence**: high  **Created**: Sun Jun 07 2026 10:32:52 GMT+0000 (Coordinated Universal Time)  


### qoe (id=1865)
**Status**: success  **Score**: 62  **Confidence**: high  **Created**: Sun Jun 07 2026 10:32:52 GMT+0000 (Coordinated Universal Time)  

Adjusted EBITDA: conservative=£251236 base=£255404 optimistic=£346712  


### risk (id=1864)
**Status**: success  **Score**: 68  **Confidence**: high  **Created**: Sun Jun 07 2026 10:32:52 GMT+0000 (Coordinated Universal Time)  


### screening (id=2337)
**Status**: success  **Score**: —  **Confidence**: —  **Created**: Mon Jun 29 2026 15:27:36 GMT+0000 (Coordinated Universal Time)  


### sector (id=1866)
**Status**: success  **Score**: 52  **Confidence**: medium  **Created**: Sun Jun 07 2026 10:32:52 GMT+0000 (Coordinated Universal Time)  


### synthesis (id=1869)
**Status**: success  **Score**: —  **Confidence**: —  **Created**: Sun Jun 07 2026 10:32:52 GMT+0000 (Coordinated Universal Time)  


### valuation (id=1867)
**Status**: success  **Score**: 72  **Confidence**: high  **Created**: Sun Jun 07 2026 10:32:52 GMT+0000 (Coordinated Universal Time)  

Multiple: —  adjusted_ebitda_base: £—  


## 6.4 Live Deal Models



### Model id=104 name="Deal Model v1"

| Column | Value |
|---|---|
| averaging_years | 3 |
| ebitda_multiple | 2.5 |
| calculated_ebitda | 263117.17333333334 |
| adjusted_ebitda | 263117.17333333334 |
| total_purchase_price | 518483.93333333335 |
| is_locked | false |


**Adjustments (3)**:
| id | type | category | description | amount | status | accepted |
|---|---|---|---|---|---|---|
| 484 | add_back | one_off_cost | Insurance Claim Income | £4168 | suggested | false |
| 485 | deduction | replacement_salary | Director Salary Normalisation | £47976 | suggested | false |
| 486 | deduction | missing_management | Missing Financial Management Cost | £47500 | suggested | false |


### Model id=120 name="Deal Model v2"

| Column | Value |
|---|---|
| averaging_years | 3 |
| ebitda_multiple | 2.5 |
| calculated_ebitda | 265019.50666666665 |
| adjusted_ebitda | 265019.50666666665 |
| total_purchase_price | 523239.7666666666 |
| is_locked | false |


**Adjustments (3)**:
| id | type | category | description | amount | status | accepted |
|---|---|---|---|---|---|---|
| 559 | add_back | one_off_cost | Insurance Claim Income | £4168 | suggested | false |
| 560 | deduction | replacement_salary | Director Salary Normalisation | £47976 | suggested | false |
| 561 | deduction | missing_management | Missing Financial Management Cost | £47500 | suggested | false |


## 6.5 Live EBITDA Recomputation (current data, filter rules)


**Eligible years** (full-year, non-IM, has IS data): 2026, 2025, 2024, 2023, 2022  

**Top 3 (averaging window)**: 2026, 2025, 2024  

- 2026: £183908.52  

- 2025: £346712  

- 2024: £264438  

**Live raw avg EBITDA**: £265019.51  

**Stored adjusted_ebitda**: £263117.17333333334 (model id=104)  

**Δ live_avg_raw vs stored**: £1902.33 (note: adjusted_ebitda includes QoE adjustments, so raw avg ≠ stored is expected)  

