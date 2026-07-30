# Live Snapshot — TC 228 (Prod)

**Prod host**: ep-old-recipe-an7e4afw.c-6.us-east-1.aws.neon.tech  
**Snapshot date**: 2026-07-30  

---

## 6.1 Documents on Live Record

| Doc id | Filename | Category | Type | Size | Analysis results | Status |
|---|---|---|---|---|---|---|
| 1624 | Signed - Full Accounts - 31032024_230330.pdf | Company Accounts | pdf | 397088 | 3 | usable_figures |
| 1759 | Year Ending 31.03.2023.pdf | Company Accounts | pdf | 91859 | 3 | usable_figures |
| 1762 | Midland_Air_Conditioning___Facility_Management_Ltd_-_Profit_and_Loss (31) DRAFT.pdf | Company Accounts | pdf | 28001 | 3 | usable_figures |
| 1763 | P&L YE 31.03.2026.pdf | YTD Profit & Loss | pdf | 25634 | 1 | usable_figures |
| 1764 | MI Presentation 06-25.pptx | Deal Documents | vnd.openxmlformats-officedocument.presentationml.presentation | 796328 | 0 | no_analysis |
| 1765 | 154764 - Midland Air Conditioning & Facility Management Ltd.pdf | Deal Documents | pdf | 5607240 | 3 | usable_figures |
| 1775 | Balance Sheet.pdf | Company Accounts | pdf | 26424 | 3 | usable_figures |
| 1777 | MAC Sales Ledger 01.04.25 to 08.09.25.csv | Sales Ledger | csv | 53351 | 1 | structure_only |
| 1778 | MAC Staff Matrix - Sept 2025.csv | Staff Matrix | csv | 3821 | 1 | structure_only |
| 1779 | MAC Fixed Asset Register 08.09.25.csv | Asset Register | csv | 6329 | 1 | structure_only |
| 1780 | Signed NDA - Thor-CON | Deal Documents | pdf | 70090 | 0 | no_analysis |

## 6.2 Live Financial Periods

| id | period_type | fiscal_year | period_end | is_full_year | months | source_tier | IS rows | BS rows |
|---|---|---|---|---|---|---|---|---|
| 1346 | management | 2021 | Wed Mar 31 2021 00:00:00 GMT+0000 (Coordinated Universal Time) | true | 12 | information_memorandum | 1 | 1 |
| 1341 | management | 2022 | Thu Mar 31 2022 00:00:00 GMT+0000 (Coordinated Universal Time) | true | 12 | information_memorandum | 1 | 1 |
| 1339 | management | 2023 | Fri Mar 31 2023 00:00:00 GMT+0000 (Coordinated Universal Time) | true | 12 | information_memorandum | 1 | 1 |
| 1340 | management | 2024 | Sun Mar 31 2024 00:00:00 GMT+0000 (Coordinated Universal Time) | true | 12 | information_memorandum | 1 | 1 |
| 1363 | statutory | 2025 | Mon Mar 31 2025 00:00:00 GMT+0000 (Coordinated Universal Time) | true | 12 | statutory | 0 | 1 |
| 1345 | management | 2026 | Thu Jul 16 2026 00:00:00 GMT+0000 (Coordinated Universal Time) | false | — | management | 1 | 0 |

**Usable EBITDA years** (full-year, non-IM, has IS): NONE  


## 6.3 Most Recent Expert Analysis



### data_quality (id=2736)
**Status**: success  **Score**: 92  **Confidence**: high  **Created**: Thu Jul 16 2026 18:29:25 GMT+0000 (Coordinated Universal Time)  


### deal_structure (id=2744)
**Status**: success  **Score**: 65  **Confidence**: high  **Created**: Thu Jul 16 2026 18:29:54 GMT+0000 (Coordinated Universal Time)  


### financial (id=2738)
**Status**: success  **Score**: 78  **Confidence**: high  **Created**: Thu Jul 16 2026 18:29:54 GMT+0000 (Coordinated Universal Time)  


### operational (id=2739)
**Status**: success  **Score**: 72  **Confidence**: high  **Created**: Thu Jul 16 2026 18:29:54 GMT+0000 (Coordinated Universal Time)  


### qoe (id=2741)
**Status**: success  **Score**: 74  **Confidence**: high  **Created**: Thu Jul 16 2026 18:29:54 GMT+0000 (Coordinated Universal Time)  

Adjusted EBITDA: conservative=£188837 base=£188837 optimistic=£202371  


### risk (id=2740)
**Status**: success  **Score**: 68  **Confidence**: high  **Created**: Thu Jul 16 2026 18:29:54 GMT+0000 (Coordinated Universal Time)  


### screening (id=2737)
**Status**: success  **Score**: —  **Confidence**: —  **Created**: Thu Jul 16 2026 18:29:33 GMT+0000 (Coordinated Universal Time)  


### sector (id=2742)
**Status**: success  **Score**: 68  **Confidence**: high  **Created**: Thu Jul 16 2026 18:29:54 GMT+0000 (Coordinated Universal Time)  


### synthesis (id=2745)
**Status**: success  **Score**: —  **Confidence**: —  **Created**: Thu Jul 16 2026 18:29:54 GMT+0000 (Coordinated Universal Time)  


### valuation (id=2743)
**Status**: success  **Score**: 76  **Confidence**: high  **Created**: Thu Jul 16 2026 18:29:54 GMT+0000 (Coordinated Universal Time)  

Multiple: —  adjusted_ebitda_base: £—  


## 6.4 Live Deal Models



### Model id=147 name="Deal Model v1"

| Column | Value |
|---|---|
| averaging_years | 3 |
| ebitda_multiple | 2.3 |
| calculated_ebitda | 0 |
| adjusted_ebitda | 0 |
| total_purchase_price | 21062 |
| is_locked | false |


**Adjustments (4)**:
| id | type | category | description | amount | status | accepted |
|---|---|---|---|---|---|---|
| 708 | add_back | one_off_cost | Exceptional Bad Debt Provision | £7534 | accepted | true |
| 709 | add_back | one_off_cost | One-off Director's Costs | £6000 | accepted | true |
| 711 | deduction | missing_management | Missing Finance Function Cost | £55000 | modified | true |
| 710 | deduction | replacement_salary | Director Salary Market Rate Adjustment | £42404 | accepted | true |


### Model id=150 name="Deal Model v2"

| Column | Value |
|---|---|
| averaging_years | 3 |
| ebitda_multiple | 2.3 |
| calculated_ebitda | 72372.54333333333 |
| adjusted_ebitda | 72372.54333333333 |
| total_purchase_price | 187518.84966666665 |
| is_locked | false |


**Adjustments (4)**:
| id | type | category | description | amount | status | accepted |
|---|---|---|---|---|---|---|
| 721 | add_back | one_off_cost | Exceptional Bad Debt Provision | £7534 | accepted | true |
| 722 | add_back | one_off_cost | One-off Director's Costs | £6000 | accepted | true |
| 723 | deduction | replacement_salary | Director Salary Market Rate Adjustment | £42404 | accepted | true |
| 724 | deduction | missing_management | Missing Finance Function Cost | £55000 | modified | true |


### Current Offers & Offer Documents


**current_offer id=13** sent_at=Thu Jul 16 2026 19:01:05 GMT+0000 (Coordinated Universal Time) deal_model_id=147 offer_price=£152,815 ev=£124,853 status=sent  

Stored averageEbitda=£57284 multiple=2.3 breakdownText: Valuation EBITDA: £54,284 | Enterprise Value (Valuation EBITDA × 2.3 multiple): £124,853 | Plus Excess Cash: £150,000 | Less Primary Debt: (£15,000) | Less Working Capital Adjustment: (£107,038) |  | Total Offer Price: £152,815  


## 6.5 Live EBITDA Recomputation (current data, filter rules)


**Eligible years** (full-year, non-IM, has IS data): NONE  

**Top 3 (averaging window)**: none  

**Live raw avg EBITDA**: £0.00  

**Stored adjusted_ebitda**: £0 (model id=147)  

**Δ live_avg_raw vs stored**: £0.00 (note: adjusted_ebitda includes QoE adjustments, so raw avg ≠ stored is expected)  

**Offer averageEbitda**: £57284 vs live raw avg £0.00 Δ=£57284.00  

**⚠ OFFER FIGURE DIFFERS FROM LIVE DATA BY £57284.00**  

