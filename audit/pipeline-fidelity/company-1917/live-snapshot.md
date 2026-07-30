# Live Snapshot — TC 190 (Prod)

**Prod host**: ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech  
**Snapshot date**: 2026-07-30  

---

## 6.1 Documents on Live Record

| Doc id | Filename | Category | Type | Size | Analysis results | Status |
|---|---|---|---|---|---|---|
| 1728 | Restored document — 2026-06-08 (1 of 8) | Restored | pdf | 483553 | 0 | no_analysis |
| 1729 | Restored document — 2026-06-08 (2 of 8) | Restored | pdf | 485224 | 0 | no_analysis |
| 1730 | Restored document — 2026-06-08 (3 of 8) | Restored | pdf | 485812 | 0 | no_analysis |
| 1731 | Restored document — 2026-06-08 (4 of 8) | Restored | pdf | 49960 | 0 | no_analysis |
| 1732 | Restored document — 2026-06-09 (5 of 8) | Restored | vnd.openxmlformats-officedocument.wordprocessingml.document | 19554 | 0 | no_analysis |
| 1733 | Restored document — 2026-06-09 (6 of 8) | Restored | pdf | 28068 | 0 | no_analysis |
| 1734 | Restored document — 2026-06-09 (7 of 8) | Restored | pdf | 28654 | 0 | no_analysis |
| 1735 | Restored document — 2026-06-09 (8 of 8) | Restored | pdf | 27597 | 0 | no_analysis |

## 6.2 Live Financial Periods

| id | period_type | fiscal_year | period_end | is_full_year | months | source_tier | IS rows | BS rows |
|---|---|---|---|---|---|---|---|---|
| 1019 | statutory | 2022 | Sat Dec 31 2022 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |
| 1024 | statutory | 2023 | Fri Jun 09 2023 00:00:00 GMT+0000 (Coordinated Universal Time) | false | — | statutory | 1 | 1 |
| 1018 | statutory | 2023 | Sun Dec 31 2023 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |
| 1025 | statutory | 2024 | Sun Jun 09 2024 00:00:00 GMT+0000 (Coordinated Universal Time) | false | — | statutory | 1 | 1 |
| 1016 | statutory | 2024 | Tue Dec 31 2024 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |
| 1026 | statutory | 2025 | Mon Jun 09 2025 00:00:00 GMT+0000 (Coordinated Universal Time) | false | — | statutory | 1 | 1 |
| 1017 | statutory | 2025 | Wed Dec 31 2025 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |
| 1027 | statutory | 2026 | Tue Jun 09 2026 00:00:00 GMT+0000 (Coordinated Universal Time) | false | — | statutory | 1 | 1 |

**Usable EBITDA years** (full-year, non-IM, has IS): 2022, 2023, 2024, 2025  


## 6.3 Most Recent Expert Analysis



### data_quality (id=1926)
**Status**: success  **Score**: 56  **Confidence**: low  **Created**: Tue Jun 09 2026 20:14:17 GMT+0000 (Coordinated Universal Time)  


### deal_structure (id=1934)
**Status**: success  **Score**: 82  **Confidence**: high  **Created**: Tue Jun 09 2026 20:14:42 GMT+0000 (Coordinated Universal Time)  


### financial (id=1928)
**Status**: success  **Score**: 72  **Confidence**: high  **Created**: Tue Jun 09 2026 20:14:42 GMT+0000 (Coordinated Universal Time)  


### operational (id=1929)
**Status**: success  **Score**: 78  **Confidence**: high  **Created**: Tue Jun 09 2026 20:14:42 GMT+0000 (Coordinated Universal Time)  


### qoe (id=1931)
**Status**: success  **Score**: 74  **Confidence**: high  **Created**: Tue Jun 09 2026 20:14:42 GMT+0000 (Coordinated Universal Time)  

Adjusted EBITDA: conservative=£303538 base=£307924 optimistic=£307924  


### risk (id=1930)
**Status**: success  **Score**: 82  **Confidence**: high  **Created**: Tue Jun 09 2026 20:14:42 GMT+0000 (Coordinated Universal Time)  


### screening (id=1927)
**Status**: success  **Score**: —  **Confidence**: —  **Created**: Tue Jun 09 2026 20:14:23 GMT+0000 (Coordinated Universal Time)  


### sector (id=1932)
**Status**: success  **Score**: 58  **Confidence**: medium  **Created**: Tue Jun 09 2026 20:14:42 GMT+0000 (Coordinated Universal Time)  


### synthesis (id=1935)
**Status**: success  **Score**: —  **Confidence**: —  **Created**: Tue Jun 09 2026 20:14:42 GMT+0000 (Coordinated Universal Time)  


### valuation (id=1933)
**Status**: success  **Score**: 78  **Confidence**: high  **Created**: Tue Jun 09 2026 20:14:42 GMT+0000 (Coordinated Universal Time)  

Multiple: —  adjusted_ebitda_base: £—  


## 6.4 Live Deal Models



### Model id=105 name="Deal Model v1"

| Column | Value |
|---|---|
| averaging_years | 3 |
| ebitda_multiple | 5 |
| calculated_ebitda | 51177.333333333336 |
| adjusted_ebitda | 51177.333333333336 |
| total_purchase_price | 458926.66666666674 |
| is_locked | false |


**Adjustments (6)**:
| id | type | category | description | amount | status | accepted |
|---|---|---|---|---|---|---|
| 487 | add_back | owner_salary_excess | Directors Pension Contributions | £60000 | accepted | true |
| 488 | add_back | personal_expense | Use of Home as Office | £1700 | accepted | true |
| 489 | deduction | replacement_salary | Profit on Disposal of Fixed Assets | £4337 | accepted | true |
| 490 | deduction | replacement_salary | Replacement Management Salary Adjustment | £48400 | accepted | true |
| 491 | deduction | deferred_maintenance | Deferred Maintenance / Asset Replacement Provision | £15000 | accepted | true |
| 492 | deduction | replacement_salary | Director replacement cost: Combined Directors (2) (current: 9100, market: 115000) | £105900 | accepted | true |


### Model id=107 name="Deal Model v2"

| Column | Value |
|---|---|
| averaging_years | 3 |
| ebitda_multiple | 3 |
| calculated_ebitda | 95177.33333333333 |
| adjusted_ebitda | 95177.33333333333 |
| total_purchase_price | 836258 |
| is_locked | false |


**Adjustments (7)**:
| id | type | category | description | amount | status | accepted |
|---|---|---|---|---|---|---|
| 500 | deduction | replacement_salary | Profit on Disposal of Fixed Assets | £4337 | accepted | true |
| 512 | add_back | custom | Vehicle Depreciation | £66000 | accepted | true |
| 498 | add_back | owner_salary_excess | Directors Pension Contributions | £60000 | accepted | true |
| 499 | add_back | personal_expense | Use of Home as Office | £1700 | accepted | true |
| 501 | deduction | replacement_salary | Replacement Management Salary Adjustment | £48400 | accepted | true |
| 502 | deduction | deferred_maintenance | Deferred Maintenance / Asset Replacement Provision | £15000 | accepted | true |
| 503 | deduction | replacement_salary | Director replacement cost: Combined Directors (2) (current: 9100, market: 115000) | £105900 | accepted | true |


## 6.5 Live EBITDA Recomputation (current data, filter rules)


**Eligible years** (full-year, non-IM, has IS data): 2025, 2024, 2023, 2022  

**Top 3 (averaging window)**: 2025, 2024, 2023  

- 2025: £298961  

- 2024: £183298  

- 2023: £308398  

**Live raw avg EBITDA**: £263552.33  

**Stored adjusted_ebitda**: £51177.333333333336 (model id=105)  

**Δ live_avg_raw vs stored**: £212375.00 (note: adjusted_ebitda includes QoE adjustments, so raw avg ≠ stored is expected)  

