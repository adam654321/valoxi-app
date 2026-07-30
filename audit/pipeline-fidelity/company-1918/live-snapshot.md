# Live Snapshot — TC 130 (Prod)

**Prod host**: ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech  
**Snapshot date**: 2026-07-30  

---

## 6.1 Documents on Live Record

| Doc id | Filename | Category | Type | Size | Analysis results | Status |
|---|---|---|---|---|---|---|
| 747 | ProjectRiver.pdf | Deal Documents | pdf | 7140311 | 3 | usable_figures |
| 748 | RiverUpdate.pdf | Deal Documents | pdf | 37879 | 1 | structure_only |
| 749 | Keen As Mustard Marketing Ltd - Limited Company Accounts 30.11.24[87].pdf | Company Accounts | pdf | 240944 | 3 | usable_figures |
| 750 | Copy of Client income 24-25.xlsx | Company Accounts | vnd.openxmlformats-officedocument.spreadsheetml.sheet | 18526 | 0 | no_analysis |
| 751 | Copy of Client income 23-24.xlsx | Company Accounts | vnd.openxmlformats-officedocument.spreadsheetml.sheet | 16788 | 0 | no_analysis |
| 862 | Keen as Mustard Marketing Ltd - MA 31.8.25.pdf | Deal Documents | pdf | 313052 | 3 | usable_figures |
| 863 | Keen as Mustard Marketing Ltd - MA 31.5.25.pdf | Deal Documents | pdf | 283259 | 3 | usable_figures |
| 864 | Keen as Mustard Marketing Ltd - MA 30.11.25.pdf | Deal Documents | pdf | 314246 | 3 | usable_figures |
| 865 | KEENASMUST-Limited company accounts 20.1-LTD- YE 30.11.21.PDF | Deal Documents | pdf | 20583 | 3 | usable_figures |
| 866 | Full Company Accounts YE 30.11.2023 - KAM Ltd.PDF | Deal Documents | pdf | 22239 | 3 | usable_figures |
| 867 | Full Company Accounts YE 30.11.2022 - KAM Ltd.PDF | Deal Documents | pdf | 22150 | 3 | usable_figures |
| 868 | KEENASMUST-Limited company accounts 20.1-LTD- YE 30.11.21.PDF | Deal Documents | pdf | 20583 | 3 | usable_figures |

## 6.2 Live Financial Periods

| id | period_type | fiscal_year | period_end | is_full_year | months | source_tier | IS rows | BS rows |
|---|---|---|---|---|---|---|---|---|
| 762 | management | 2020 | Mon Nov 30 2020 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | information_memorandum | 1 | 1 |
| 685 | management | 2021 | Tue Nov 30 2021 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | information_memorandum | 1 | 1 |
| 686 | management | 2022 | Wed Nov 30 2022 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | information_memorandum | 1 | 1 |
| 687 | management | 2023 | Fri Mar 31 2023 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | information_memorandum | 1 | 1 |
| 691 | statutory | 2024 | Sat Nov 30 2024 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |
| 759 | management | 2025 | Sun Nov 30 2025 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | information_memorandum | 1 | 1 |

**Usable EBITDA years** (full-year, non-IM, has IS): 2024  


## 6.3 Most Recent Expert Analysis



### data_quality (id=2806)
**Status**: success  **Score**: 62  **Confidence**: medium  **Created**: Sat Jul 18 2026 10:53:58 GMT+0000 (Coordinated Universal Time)  


### deal_structure (id=2814)
**Status**: success  **Score**: 58  **Confidence**: high  **Created**: Sat Jul 18 2026 10:54:10 GMT+0000 (Coordinated Universal Time)  


### financial (id=2808)
**Status**: success  **Score**: 68  **Confidence**: high  **Created**: Sat Jul 18 2026 10:54:09 GMT+0000 (Coordinated Universal Time)  


### operational (id=2809)
**Status**: success  **Score**: 68  **Confidence**: high  **Created**: Sat Jul 18 2026 10:54:09 GMT+0000 (Coordinated Universal Time)  


### qoe (id=2811)
**Status**: success  **Score**: 62  **Confidence**: high  **Created**: Sat Jul 18 2026 10:54:09 GMT+0000 (Coordinated Universal Time)  

Adjusted EBITDA: conservative=£108414 base=£120114 optimistic=£170006  


### risk (id=2810)
**Status**: success  **Score**: 62  **Confidence**: high  **Created**: Sat Jul 18 2026 10:54:09 GMT+0000 (Coordinated Universal Time)  


### screening (id=2807)
**Status**: success  **Score**: —  **Confidence**: —  **Created**: Sat Jul 18 2026 10:54:04 GMT+0000 (Coordinated Universal Time)  


### sector (id=2812)
**Status**: success  **Score**: 62  **Confidence**: medium  **Created**: Sat Jul 18 2026 10:54:09 GMT+0000 (Coordinated Universal Time)  


### synthesis (id=2815)
**Status**: success  **Score**: —  **Confidence**: —  **Created**: Sat Jul 18 2026 10:54:10 GMT+0000 (Coordinated Universal Time)  


### valuation (id=2813)
**Status**: success  **Score**: 72  **Confidence**: high  **Created**: Sat Jul 18 2026 10:54:09 GMT+0000 (Coordinated Universal Time)  

Multiple: —  adjusted_ebitda_base: £—  


## 6.4 Live Deal Models



### Model id=153 name="Deal Model v1"

| Column | Value |
|---|---|
| averaging_years | 4 |
| ebitda_multiple | 3.6 |
| calculated_ebitda | -16725.96 |
| adjusted_ebitda | -16725.96 |
| total_purchase_price | -60213.456 |
| is_locked | false |


**Adjustments (3)**:
| id | type | category | description | amount | status | accepted |
|---|---|---|---|---|---|---|
| 761 | deduction | bad_debt_provision | Bad Debt Provision (Debtor Spike) | £8725 | rejected | false |
| 759 | add_back | one_off_cost | Exceptional Professional Fees | £11700 | rejected | false |
| 760 | deduction | replacement_salary | Director Salary Market Rate Adjustment | £157500 | modified | true |


## 6.5 Live EBITDA Recomputation (current data, filter rules)


**Eligible years** (full-year, non-IM, has IS data): 2024  

**Top 4 (averaging window)**: 2024  

- 2024: £197806  

**Live raw avg EBITDA**: £197806.00  

**Stored adjusted_ebitda**: £-16725.96 (model id=153)  

**Δ live_avg_raw vs stored**: £214531.96 (note: adjusted_ebitda includes QoE adjustments, so raw avg ≠ stored is expected)  

