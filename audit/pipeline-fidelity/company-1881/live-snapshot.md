# Live Snapshot — TC 138 (Prod)

**Prod host**: ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech  
**Snapshot date**: 2026-07-30  

---

## 6.1 Documents on Live Record

| Doc id | Filename | Category | Type | Size | Analysis results | Status |
|---|---|---|---|---|---|---|
| 848 | IM - 163009.pdf | Deal Documents | pdf | 2082278 | 3 | usable_figures |
| 849 | Cooper-Gibson Limited AC and CT ye 29.02.2024.pdf | Company Accounts | pdf | 118101 | 2 | usable_figures |
| 851 | CGRProfitandLoss1Mar24.pdf | Company Accounts | pdf | 40179 | 3 | usable_figures |
| 852 | CompanyOverview-end28.2.25.pdf | Deal Documents | pdf | 35253 | 3 | usable_figures |
| 853 | FS_Cooper-GibsonLimited_28022025.pdf | Company Accounts | pdf | 73405 | 3 | usable_figures |
| 854 | YE23 Accounts.pdf | Company Accounts | pdf | 182192 | 3 | usable_figures |
| 1335 | Cooper-Gibson Ltd AC and CT ye 29.02.26._final.pdf | Company Accounts | pdf | 109852 | 3 | usable_figures |
| 1432 | FYTDBalanceSheet_25.6.26.pdf | YTD Balance Sheet | pdf | 37383 | 1 | usable_figures |
| 1433 | FYTD_ProfitandLoss_25.6.26.pdf | Deal Documents | pdf | 35681 | 1 | usable_figures |
| 1434 | Cooper-Gibson Ltd_Sales by Customer Summary_LastFYto28.2.26.xlsx | Sales Ledger | vnd.openxmlformats-officedocument.spreadsheetml.sheet | 10347 | 0 | no_analysis |
| 1435 | Cooper-Gibson Ltd_Sales by Customer Summary_1.3.26-25.6.26.xlsx | Deal Documents | vnd.openxmlformats-officedocument.spreadsheetml.sheet | 10099 | 0 | no_analysis |

## 6.2 Live Financial Periods

| id | period_type | fiscal_year | period_end | is_full_year | months | source_tier | IS rows | BS rows |
|---|---|---|---|---|---|---|---|---|
| 743 | statutory | 2022 | Thu Mar 31 2022 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |
| 744 | statutory | 2023 | Fri Mar 31 2023 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |
| 745 | statutory | 2024 | Thu Feb 29 2024 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |
| 746 | statutory | 2025 | Fri Feb 28 2025 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |
| 1129 | statutory | 2026 | Thu Jun 25 2026 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |

**Usable EBITDA years** (full-year, non-IM, has IS): 2022, 2023, 2024, 2025, 2026  


## 6.3 Most Recent Expert Analysis



### data_quality (id=3097)
**Status**: success  **Score**: 45  **Confidence**: low  **Created**: Tue Jul 28 2026 14:06:32 GMT+0000 (Coordinated Universal Time)  


### deal_structure (id=3123)
**Status**: success  **Score**: 45  **Confidence**: medium  **Created**: Tue Jul 28 2026 16:55:29 GMT+0000 (Coordinated Universal Time)  


### financial (id=3117)
**Status**: success  **Score**: 68  **Confidence**: high  **Created**: Tue Jul 28 2026 16:55:29 GMT+0000 (Coordinated Universal Time)  


### operational (id=3118)
**Status**: success  **Score**: 52  **Confidence**: medium  **Created**: Tue Jul 28 2026 16:55:29 GMT+0000 (Coordinated Universal Time)  


### qoe (id=3120)
**Status**: success  **Score**: 55  **Confidence**: medium  **Created**: Tue Jul 28 2026 16:55:29 GMT+0000 (Coordinated Universal Time)  

Adjusted EBITDA: conservative=£-9425 base=£17648 optimistic=£17648  


### risk (id=3119)
**Status**: success  **Score**: 68  **Confidence**: medium  **Created**: Tue Jul 28 2026 16:55:29 GMT+0000 (Coordinated Universal Time)  


### screening (id=3098)
**Status**: success  **Score**: —  **Confidence**: —  **Created**: Tue Jul 28 2026 14:06:39 GMT+0000 (Coordinated Universal Time)  


### sector (id=3121)
**Status**: success  **Score**: 68  **Confidence**: medium  **Created**: Tue Jul 28 2026 16:55:29 GMT+0000 (Coordinated Universal Time)  


### synthesis (id=3124)
**Status**: success  **Score**: —  **Confidence**: —  **Created**: Tue Jul 28 2026 16:55:30 GMT+0000 (Coordinated Universal Time)  


### valuation (id=3122)
**Status**: success  **Score**: 55  **Confidence**: medium  **Created**: Tue Jul 28 2026 16:55:29 GMT+0000 (Coordinated Universal Time)  

Multiple: —  adjusted_ebitda_base: £—  


## 6.4 Live Deal Models



### Model id=156 name="Deal Model v1"

| Column | Value |
|---|---|
| averaging_years | 3 |
| ebitda_multiple | 3 |
| calculated_ebitda | 48708.666666666664 |
| adjusted_ebitda | 48708.666666666664 |
| total_purchase_price | 142757 |
| is_locked | false |


**Adjustments (7)**:
| id | type | category | description | amount | status | accepted |
|---|---|---|---|---|---|---|
| 776 | deduction | replacement_salary | Sarah as QA | £30000 | accepted | true |
| 775 | deduction | missing_management | Bid Writer | £30000 | accepted | true |
| 772 | add_back | one_off_cost | VAT Expense (One-off Correction) | £37270 | accepted | true |
| 770 | add_back | owner_salary_excess | Discretionary Director Pension Contributions | £24000 | accepted | true |
| 773 | deduction | replacement_salary | Replacement Management Salary (MD Role) | £60000 | modified | true |
| 771 | add_back | one_off_cost | Loss on Disposal of Tangible Fixed Assets | £2761 | accepted | true |
| 774 | deduction | missing_management | Missing Finance/Admin Function | £15000 | rejected | false |


## 6.5 Live EBITDA Recomputation (current data, filter rules)


**Eligible years** (full-year, non-IM, has IS data): 2026, 2025, 2024, 2023, 2022  

**Top 3 (averaging window)**: 2026, 2025, 2024  

- 2026: £53266  

- 2025: £221671  

- 2024: £119158  

**Live raw avg EBITDA**: £131365.00  

**Stored adjusted_ebitda**: £48708.666666666664 (model id=156)  

**Δ live_avg_raw vs stored**: £82656.33 (note: adjusted_ebitda includes QoE adjustments, so raw avg ≠ stored is expected)  

