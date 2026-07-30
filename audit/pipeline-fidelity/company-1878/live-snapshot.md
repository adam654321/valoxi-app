# Live Snapshot — TC 196 (Prod)

**Prod host**: ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech  
**Snapshot date**: 2026-07-30  

---

## 6.1 Documents on Live Record

| Doc id | Filename | Category | Type | Size | Analysis results | Status |
|---|---|---|---|---|---|---|
| 1615 | 2026 Draft Accounts.PDF | Company Accounts | pdf | 1279714 | 3 | usable_figures |
| 1616 | 2025 Year End Accounts.PDF | Company Accounts | pdf | 308777 | 3 | usable_figures |
| 1617 | 2024 Year End Accounts.PDF | Company Accounts | pdf | 6883271 | 3 | usable_figures |
| 1618 | Staff Matrix.XLS | Staff Matrix | vnd.ms-excel | 81184 | 1 | structure_only |

## 6.2 Live Financial Periods

| id | period_type | fiscal_year | period_end | is_full_year | months | source_tier | IS rows | BS rows |
|---|---|---|---|---|---|---|---|---|
| 1330 | statutory | 2023 | Tue Feb 28 2023 00:00:00 GMT+0000 (Coordinated Universal Time) | true | 12 | statutory | 1 | 1 |
| 1329 | statutory | 2024 | Thu Feb 29 2024 00:00:00 GMT+0000 (Coordinated Universal Time) | true | 12 | statutory | 1 | 1 |
| 1327 | statutory | 2025 | Fri Feb 28 2025 00:00:00 GMT+0000 (Coordinated Universal Time) | true | 12 | statutory | 1 | 1 |
| 1328 | statutory | 2026 | Sat Feb 28 2026 00:00:00 GMT+0000 (Coordinated Universal Time) | true | 12 | statutory | 1 | 1 |
| 1331 | management | 2026 | Tue Jul 14 2026 00:00:00 GMT+0000 (Coordinated Universal Time) | false | — | null | 0 | 0 |

**Usable EBITDA years** (full-year, non-IM, has IS): 2023, 2024, 2025, 2026  


## 6.3 Most Recent Expert Analysis



### data_quality (id=2746)
**Status**: success  **Score**: 56  **Confidence**: medium  **Created**: Thu Jul 16 2026 18:30:25 GMT+0000 (Coordinated Universal Time)  


### deal_structure (id=2754)
**Status**: success  **Score**: 55  **Confidence**: high  **Created**: Thu Jul 16 2026 18:31:09 GMT+0000 (Coordinated Universal Time)  


### financial (id=2748)
**Status**: success  **Score**: 72  **Confidence**: high  **Created**: Thu Jul 16 2026 18:31:09 GMT+0000 (Coordinated Universal Time)  


### operational (id=2749)
**Status**: success  **Score**: 68  **Confidence**: high  **Created**: Thu Jul 16 2026 18:31:09 GMT+0000 (Coordinated Universal Time)  


### qoe (id=2751)
**Status**: success  **Score**: 65  **Confidence**: high  **Created**: Thu Jul 16 2026 18:31:09 GMT+0000 (Coordinated Universal Time)  

Adjusted EBITDA: conservative=£81306 base=£89291 optimistic=£103276  


### risk (id=2750)
**Status**: success  **Score**: 68  **Confidence**: medium  **Created**: Thu Jul 16 2026 18:31:09 GMT+0000 (Coordinated Universal Time)  


### screening (id=2747)
**Status**: success  **Score**: —  **Confidence**: —  **Created**: Thu Jul 16 2026 18:30:31 GMT+0000 (Coordinated Universal Time)  


### sector (id=2752)
**Status**: success  **Score**: 68  **Confidence**: high  **Created**: Thu Jul 16 2026 18:31:09 GMT+0000 (Coordinated Universal Time)  


### synthesis (id=2755)
**Status**: success  **Score**: —  **Confidence**: —  **Created**: Thu Jul 16 2026 18:31:09 GMT+0000 (Coordinated Universal Time)  


### valuation (id=2753)
**Status**: success  **Score**: 75  **Confidence**: high  **Created**: Thu Jul 16 2026 18:31:09 GMT+0000 (Coordinated Universal Time)  

Multiple: —  adjusted_ebitda_base: £—  


## 6.4 Live Deal Models



### Model id=113 name="Deal Model v1"

| Column | Value |
|---|---|
| averaging_years | 3 |
| ebitda_multiple | 2.7 |
| calculated_ebitda | 136487.33333333334 |
| adjusted_ebitda | 136487.33333333334 |
| total_purchase_price | 379977.80000000005 |
| is_locked | true |


**Adjustments (7)**:
| id | type | category | description | amount | status | accepted |
|---|---|---|---|---|---|---|
| 686 | add_back | director_remuneration | Directors Remuneration | £70994 | accepted | true |
| 524 | add_back | owner_salary_excess | Excess Director Remuneration | £10519 | accepted | true |
| 525 | add_back | one_off_cost | Loss on Disposal of Motor Vehicles | £526 | accepted | true |
| 526 | deduction | deferred_maintenance | Deferred Maintenance / IT Replacement Provision | £4500 | accepted | true |
| 527 | deduction | bad_debt_provision | Provision for Unrecoverable Other Debtors | £6631 | accepted | true |
| 735 | deduction | replacement_salary | Part Time Director/Accounts | £20000 | modified | true |
| 733 | deduction | replacement_salary | Registered Manager | £47000 | modified | true |


### Model id=132 name="Deal Model v2"

| Column | Value |
|---|---|
| averaging_years | 3 |
| ebitda_multiple | 3.3 |
| calculated_ebitda | 136487.33333333334 |
| adjusted_ebitda | 136487.33333333334 |
| total_purchase_price | 461900.19999999995 |
| is_locked | false |


**Adjustments (7)**:
| id | type | category | description | amount | status | accepted |
|---|---|---|---|---|---|---|
| 610 | add_back | owner_salary_excess | Excess Director Remuneration | £10519 | accepted | true |
| 690 | deduction | replacement_salary | Registered Manager | £47000 | accepted | true |
| 611 | add_back | one_off_cost | Loss on Disposal of Motor Vehicles | £526 | accepted | true |
| 612 | deduction | deferred_maintenance | Deferred Maintenance / IT Replacement Provision | £4500 | accepted | true |
| 613 | deduction | bad_debt_provision | Provision for Unrecoverable Other Debtors | £6631 | accepted | true |
| 695 | deduction | replacement_salary | Part Time Admin | £20000 | accepted | true |
| 696 | add_back | director_remuneration | Directors Remuneration | £70994 | modified | true |


### Model id=146 name="Deal Model v3"

| Column | Value |
|---|---|
| averaging_years | 3 |
| ebitda_multiple | 3.5 |
| calculated_ebitda | 136487.33333333334 |
| adjusted_ebitda | 136487.33333333334 |
| total_purchase_price | 489199.66666666674 |
| is_locked | false |


**Adjustments (7)**:
| id | type | category | description | amount | status | accepted |
|---|---|---|---|---|---|---|
| 704 | add_back | director_remuneration | Directors Remuneration | £70994 | modified | true |
| 706 | deduction | replacement_salary | Part Time Admin | £20000 | accepted | true |
| 707 | deduction | replacement_salary | Registered Manager | £47000 | accepted | true |
| 676 | add_back | one_off_cost | Loss on Disposal of Motor Vehicles | £526 | accepted | true |
| 677 | deduction | deferred_maintenance | Deferred Maintenance / IT Replacement Provision | £4500 | accepted | true |
| 678 | deduction | bad_debt_provision | Provision for Unrecoverable Other Debtors | £6631 | accepted | true |
| 675 | add_back | owner_salary_excess | Excess Director Remuneration | £10519 | modified | true |


### Model id=152 name="Deal Model v4"

| Column | Value |
|---|---|
| averaging_years | 3 |
| ebitda_multiple | 3.3 |
| calculated_ebitda | 136487.33333333334 |
| adjusted_ebitda | 136487.33333333334 |
| total_purchase_price | 461900.19999999995 |
| is_locked | false |


**Adjustments (7)**:
| id | type | category | description | amount | status | accepted |
|---|---|---|---|---|---|---|
| 753 | add_back | one_off_cost | Loss on Disposal of Motor Vehicles | £526 | accepted | true |
| 754 | deduction | deferred_maintenance | Deferred Maintenance / IT Replacement Provision | £4500 | accepted | true |
| 755 | deduction | bad_debt_provision | Provision for Unrecoverable Other Debtors | £6631 | accepted | true |
| 756 | deduction | replacement_salary | Registered Manager | £47000 | accepted | true |
| 757 | deduction | replacement_salary | Part Time Admin | £20000 | accepted | true |
| 758 | add_back | director_remuneration | Directors Remuneration | £70994 | modified | true |
| 752 | add_back | owner_salary_excess | Excess Director Remuneration | £10519 | accepted | true |


### Current Offers & Offer Documents


**current_offer id=15** sent_at=Fri Jul 17 2026 14:23:54 GMT+0000 (Coordinated Universal Time) deal_model_id=113 offer_price=£379,978 ev=£368,516 status=sent  

Stored averageEbitda=£136487.33333333334 multiple=2.7 breakdownText: Average Adjusted EBITDA: £136,487 | Enterprise Value (Adjusted EBITDA × 2.7 multiple): £368,516 | Plus Excess Cash: £77,903 | Less Primary Debt: (£11,441) | Less Working Capital Adjustment: (£55,000) |  | Total Offer Price: £379,978  


## 6.5 Live EBITDA Recomputation (current data, filter rules)


**Eligible years** (full-year, non-IM, has IS data): 2026, 2025, 2024, 2023  

**Top 3 (averaging window)**: 2026, 2025, 2024  

- 2026: £135076  

- 2025: £121426  

- 2024: £135131  

**Live raw avg EBITDA**: £130544.33  

**Stored adjusted_ebitda**: £136487.33333333334 (model id=113)  

**Δ live_avg_raw vs stored**: £5943.00 (note: adjusted_ebitda includes QoE adjustments, so raw avg ≠ stored is expected)  

**Offer averageEbitda**: £136487.33333333334 vs live raw avg £130544.33 Δ=£5943.00  

**⚠ OFFER FIGURE DIFFERS FROM LIVE DATA BY £5943.00**  

