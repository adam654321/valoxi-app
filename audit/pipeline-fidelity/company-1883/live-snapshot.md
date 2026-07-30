# Live Snapshot — TC 220 (Prod)

**Prod host**: ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech  
**Snapshot date**: 2026-07-30  

---

## 6.1 Documents on Live Record

| Doc id | Filename | Category | Type | Size | Analysis results | Status |
|---|---|---|---|---|---|---|
| 1521 | Canoports_Company_Accounts_FY26.pdf | Company Accounts | pdf | 6828 | 3 | usable_figures |
| 1522 | Canoports_YTD_Balance_Sheet.pdf | YTD Balance Sheet | pdf | 4853 | 1 | usable_figures |
| 1535 | Canoports_Company_Accounts_FY24.pdf | Company Accounts | pdf | 4510 | 3 | usable_figures |
| 1536 | Canoports_Company_Accounts_FY23.pdf | Company Accounts | pdf | 4760 | 3 | usable_figures |
| 1537 | Canoports_Company_Accounts_FY22.pdf | Company Accounts | pdf | 3044 | 3 | usable_figures |
| 1540 | Canoports_Sales_Ledger.pdf | Sales Ledger | pdf | 4901 | 1 | structure_only |
| 1541 | Canoports_Asset_Register (1).pdf | Asset Register | pdf | 5002 | 1 | structure_only |
| 1542 | Canoports_Staff_Matrix (1).pdf | Staff Matrix | pdf | 6307 | 1 | structure_only |
| 1543 | Canoports_YTD_Profit_and_Loss.pdf | YTD Profit & Loss | pdf | 6460 | 1 | usable_figures |

## 6.2 Live Financial Periods

| id | period_type | fiscal_year | period_end | is_full_year | months | source_tier | IS rows | BS rows |
|---|---|---|---|---|---|---|---|---|
| 1265 | management | 2022 | Tue May 31 2022 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | management | 1 | 1 |
| 1264 | statutory | 2023 | Wed May 31 2023 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |
| 1263 | statutory | 2024 | Fri May 31 2024 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |
| 1246 | statutory | 2025 | Sat May 31 2025 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | statutory | 1 | 1 |
| 1247 | management | 2026 | Sun May 31 2026 00:00:00 GMT+0000 (Coordinated Universal Time) | true | — | management | 1 | 1 |

**Usable EBITDA years** (full-year, non-IM, has IS): 2022, 2023, 2024, 2025, 2026  


## 6.3 Most Recent Expert Analysis



### data_quality (id=2501)
**Status**: success  **Score**: 72  **Confidence**: medium  **Created**: Sat Jul 04 2026 08:50:53 GMT+0000 (Coordinated Universal Time)  


### deal_structure (id=3075)
**Status**: success  **Score**: 75  **Confidence**: high  **Created**: Mon Jul 27 2026 13:14:12 GMT+0000 (Coordinated Universal Time)  


### financial (id=3069)
**Status**: success  **Score**: 72  **Confidence**: high  **Created**: Mon Jul 27 2026 13:14:12 GMT+0000 (Coordinated Universal Time)  


### operational (id=3070)
**Status**: success  **Score**: 72  **Confidence**: high  **Created**: Mon Jul 27 2026 13:14:12 GMT+0000 (Coordinated Universal Time)  


### qoe (id=3072)
**Status**: success  **Score**: 74  **Confidence**: high  **Created**: Mon Jul 27 2026 13:14:12 GMT+0000 (Coordinated Universal Time)  

Adjusted EBITDA: conservative=£1893325 base=£2118625 optimistic=£2118625  


### risk (id=3071)
**Status**: success  **Score**: 78  **Confidence**: medium  **Created**: Mon Jul 27 2026 13:14:12 GMT+0000 (Coordinated Universal Time)  


### screening (id=2502)
**Status**: success  **Score**: —  **Confidence**: —  **Created**: Sat Jul 04 2026 08:50:59 GMT+0000 (Coordinated Universal Time)  


### sector (id=3073)
**Status**: success  **Score**: 62  **Confidence**: medium  **Created**: Mon Jul 27 2026 13:14:12 GMT+0000 (Coordinated Universal Time)  


### synthesis (id=3076)
**Status**: success  **Score**: —  **Confidence**: —  **Created**: Mon Jul 27 2026 13:14:12 GMT+0000 (Coordinated Universal Time)  


### valuation (id=3074)
**Status**: success  **Score**: 75  **Confidence**: high  **Created**: Mon Jul 27 2026 13:14:12 GMT+0000 (Coordinated Universal Time)  

Multiple: —  adjusted_ebitda_base: £—  


## 6.4 Live Deal Models



### Model id=140 name="Deal Model v1"

| Column | Value |
|---|---|
| averaging_years | 3 |
| ebitda_multiple | 5.3 |
| calculated_ebitda | 1979856.3333333333 |
| adjusted_ebitda | 1979856.3333333333 |
| total_purchase_price | 10316251.566666666 |
| is_locked | false |


**Adjustments (4)**:
| id | type | category | description | amount | status | accepted |
|---|---|---|---|---|---|---|
| 639 | add_back | one_off_cost | Non-recurring items FY26 | £285072 | accepted | true |
| 641 | deduction | replacement_salary | Market Rate Salary Adjustment - Louisa Wood | £59525 | accepted | true |
| 642 | deduction | bad_debt_provision | Inventory Valuation Risk Provision | £130000 | accepted | true |
| 640 | deduction | replacement_salary | Market Rate Salary Adjustment - Mark Wood | £102500 | accepted | true |


### Current Offers & Offer Documents


**current_offer id=12** sent_at=Mon Jul 06 2026 18:13:00 GMT+0000 (Coordinated Universal Time) deal_model_id=140 offer_price=£3,386,196 ev=£6,308,297 status=sent  

Stored averageEbitda=£1213134 multiple=5.2 breakdownText: Average Adjusted EBITDA: £1,213,134 | Enterprise Value (Adjusted EBITDA × 5.2 multiple): £6,308,297 | Plus Excess Cash: £1,500,000 | Less Primary Debt: (£176,987) | Less Working Capital Adjustment: (£4,245,114) |  | Total Offer Price: £3,386,196  


## 6.5 Live EBITDA Recomputation (current data, filter rules)


**Eligible years** (full-year, non-IM, has IS data): 2026, 2025, 2024, 2023, 2022  

**Top 3 (averaging window)**: 2026, 2025, 2024  

- 2026: £1967046  

- 2025: £2822727  

- 2024: £1930099  

**Live raw avg EBITDA**: £2239957.33  

**Stored adjusted_ebitda**: £1979856.3333333333 (model id=140)  

**Δ live_avg_raw vs stored**: £260101.00 (note: adjusted_ebitda includes QoE adjustments, so raw avg ≠ stored is expected)  

**Offer averageEbitda**: £1213134 vs live raw avg £2239957.33 Δ=£1026823.33  

**⚠ OFFER FIGURE DIFFERS FROM LIVE DATA BY £1026823.33**  

