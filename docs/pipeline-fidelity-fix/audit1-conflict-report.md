# Audit-1 Conflict Report

Generated from committed captures — timestamp suppressed for determinism
Script: `scripts/audit1-conflict-report.ts`  
Source: `audit/pipeline-fidelity/` (committed JSON captures, no DB, no Gemini)  
Scope: devDocIds 5830–5840 (Thor-CON), 5857–5872 (Innova), 5873–5883 excl 5878 (Cooper Gibson)

Tier precedence (highest → lowest): T1a > T1b > T2 > T3 > INT > n/a

---

## S1 — Write History per Company / Fiscal Year / Field

Surviving value marked **bold**. Only fields with at least one write event shown.

### Cooper Gibson

#### FY 2022

##### BS

**`cashAtBank`** (period 7980)
- **210479 (doc 5873/848, tier T3, FIRST_WRITE)** ← surviving

**`retainedEarnings`** (period 7980)
- **127321 (doc 5873/848, tier T3, FIRST_WRITE)** ← surviving

**`tangibleFixedAssets`** (period 7980)
- **1984 (doc 5873/848, tier T3, FIRST_WRITE)** ← surviving

**`totalCurrentAssets`** (period 7980)
- **210479 (doc 5873/848, tier T3, FIRST_WRITE)** ← surviving

**`totalCurrentLiabilities`** (period 7980)
- **85142 (doc 5873/848, tier T3, FIRST_WRITE)** ← surviving

**`totalEquity`** (period 7980)
- **127321 (doc 5873/848, tier T3, FIRST_WRITE)** ← surviving

**`totalLongTermLiabilities`** (period 7980)
- **0 (doc 5873/848, tier T3, FIRST_WRITE)** ← surviving

##### IS

**`administrativeExpenses`** (period 7980)
- **35249 (doc 5873/848, tier T3, FIRST_WRITE)** ← surviving

**`costOfSales`** (period 7980)
- **151818 (doc 5873/848, tier T3, FIRST_WRITE)** ← surviving

**`depreciationAmortisation`** (period 7980)
- **1478 (doc 5873/848, tier T3, FIRST_WRITE)** ← surviving

**`grossProfit`** (period 7980)
- **146321 (doc 5873/848, tier T3, FIRST_WRITE)** ← surviving

**`operatingProfit`** (period 7980)
- **111774 (doc 5873/848, tier T3, FIRST_WRITE)** ← surviving

**`otherOperatingIncome`** (period 7980)
- **702 (doc 5873/848, tier T3, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.depreciation`** (period 7980)
- **1478 (doc 5873/848, tier T3, FIRST_WRITE)** ← surviving

**`profitBeforeTax`** (period 7980)
- **111774 (doc 5873/848, tier T3, FIRST_WRITE)** ← surviving

**`revenue`** (period 7980)
- **298139 (doc 5873/848, tier T3, FIRST_WRITE)** ← surviving

#### FY 2023

##### BS

**`accruals`** (period 7981)
- **2421 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`bankLoansLongTerm`** (period 7981)
- **38 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`cashAtBank`** (period 7981)
- 167499 (doc 5873/848, tier T3, FIRST_WRITE)
- **167499 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`computerEquipment`** (period 7981)
- **1223 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`corporationTaxDue`** (period 7981)
- **11735 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`fixturesFittings`** (period 7981)
- **105 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`otherCreditors`** (period 7981)
- **49508 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`prepayments`** (period 7981)
- 18660 (doc 5873/848, tier T3, FIRST_WRITE)
- **18660 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`retainedEarnings`** (period 7981)
- 123842 (doc 5873/848, tier T3, FIRST_WRITE)
- **123842 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`tangibleFixedAssets`** (period 7981)
- 1737 (doc 5873/848, tier T3, FIRST_WRITE)
- **1737 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`taxationSocialSecurity`** (period 7981)
- **352 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`totalCurrentAssets`** (period 7981)
- 186159 (doc 5873/848, tier T3, FIRST_WRITE)
- **186159 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`totalCurrentLiabilities`** (period 7981)
- 64016 (doc 5873/848, tier T3, FIRST_WRITE)
- **64016 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`totalEquity`** (period 7981)
- 123842 (doc 5873/848, tier T3, FIRST_WRITE)
- **123842 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`totalLongTermLiabilities`** (period 7981)
- 38 (doc 5873/848, tier T3, FIRST_WRITE)
- **38 (doc 5874/849, tier T1a, AGREE)** ← surviving

##### IS

**`administrativeExpenses`** (period 7981)
- 69497 (doc 5873/848, tier T3, FIRST_WRITE)
- **135820 (doc 5874/849, tier T1a, CONFLICT)** ← surviving

**`corporationTax`** (period 7981)
- **11735 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`costOfSales`** (period 7981)
- 68452 (doc 5873/848, tier T3, FIRST_WRITE)
- **447 (doc 5874/849, tier T1a, GRANULARITY)** ← surviving

**`costOfSalesBreakdown.other_direct_costs`** (period 7981)
- **447 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`depreciationAmortisation`** (period 7981)
- 1328 (doc 5873/848, tier T3, FIRST_WRITE)
- **1328 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`directorsRemuneration`** (period 7981)
- **52672 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`grossProfit`** (period 7981)
- 130075 (doc 5873/848, tier T3, FIRST_WRITE)
- **198080 (doc 5874/849, tier T1a, CONFLICT)** ← surviving

**`interestPayable`** (period 7981)
- **1672 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`interestReceivable`** (period 7981)
- **179 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`netProfit`** (period 7981)
- **49022 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`operatingProfit`** (period 7981)
- 60757 (doc 5873/848, tier T3, FIRST_WRITE)
- **62250 (doc 5874/849, tier T1a, CONFLICT)** ← surviving

**`otherOperatingIncome`** (period 7981)
- 179 (doc 5873/848, tier T3, FIRST_WRITE)
- **179 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.accountancy_bookkeeping`** (period 7981)
- **2421 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.computer_costs`** (period 7981)
- **2867 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.depreciation`** (period 7981)
- 1328 (doc 5873/848, tier T3, FIRST_WRITE)
- **1328 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.directors_pension`** (period 7981)
- **40000 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.directors_salaries`** (period 7981)
- **12320 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.employers_national_insurance`** (period 7981)
- **352 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.insurance`** (period 7981)
- **1972 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.other_overheads`** (period 7981)
- **68155 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.printing_stationery`** (period 7981)
- **51 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.professional_fees`** (period 7981)
- **1025 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.repairs_maintenance`** (period 7981)
- **853 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.telecommunications`** (period 7981)
- **1930 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.travel_subsistence`** (period 7981)
- **1482 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.use_of_home_as_office`** (period 7981)
- **312 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`profitBeforeTax`** (period 7981)
- 60757 (doc 5873/848, tier T3, FIRST_WRITE)
- **60757 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`revenue`** (period 7981)
- 198527 (doc 5873/848, tier T3, FIRST_WRITE)
- **198527 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`staffCosts`** (period 7981)
- **150 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

#### FY 2024

##### BS

**`accruals`** (period 7982)
- **2421 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`cashAtBank`** (period 7982)
- 173616 (doc 5873/848, tier T3, FIRST_WRITE)
- **173616 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`computerEquipment`** (period 7982)
- **1098 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`corporationTaxDue`** (period 7982)
- **27388 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`otherCreditors`** (period 7982)
- **16476 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`prepayments`** (period 7982)
- 2030 (doc 5873/848, tier T3, FIRST_WRITE)
- **2030 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`retainedEarnings`** (period 7982)
- 129972 (doc 5873/848, tier T3, FIRST_WRITE)
- **129972 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`tangibleFixedAssets`** (period 7982)
- 1097 (doc 5873/848, tier T3, FIRST_WRITE)
- **1097 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`taxationSocialSecurity`** (period 7982)
- **486 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`totalCurrentAssets`** (period 7982)
- 175646 (doc 5873/848, tier T3, FIRST_WRITE)
- **175646 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`totalCurrentLiabilities`** (period 7982)
- 46771 (doc 5873/848, tier T3, FIRST_WRITE)
- **46771 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`totalEquity`** (period 7982)
- 129972 (doc 5873/848, tier T3, FIRST_WRITE)
- **129972 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`totalLongTermLiabilities`** (period 7982)
- 0 (doc 5873/848, tier T3, FIRST_WRITE)
- **0 (doc 5874/849, tier T1a, AGREE)** ← surviving

##### IS

**`administrativeExpenses`** (period 7982)
- 12094 (doc 5873/848, tier T3, FIRST_WRITE)
- **204475 (doc 5874/849, tier T1a, CONFLICT)** ← surviving

**`corporationTax`** (period 7982)
- **27388 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`costOfSales`** (period 7982)
- 196355 (doc 5873/848, tier T3, FIRST_WRITE)
- **4221 (doc 5874/849, tier T1a, CONFLICT)** ← surviving

**`costOfSalesBreakdown.other_direct_costs`** (period 7982)
- **4221 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`depreciationAmortisation`** (period 7982)
- 640 (doc 5873/848, tier T3, FIRST_WRITE)
- **640 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`directorsRemuneration`** (period 7982)
- 55757 (doc 5873/848, tier T3, FIRST_WRITE)
- **56056 (doc 5874/849, tier T1a, CONFLICT)** ← surviving

**`grossProfit`** (period 7982)
- 129872 (doc 5873/848, tier T3, FIRST_WRITE)
- **322006 (doc 5874/849, tier T1a, CONFLICT)** ← surviving

**`interestReceivable`** (period 7982)
- **740 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`netProfit`** (period 7982)
- **91130 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`operatingProfit`** (period 7982)
- 118518 (doc 5873/848, tier T3, FIRST_WRITE)
- **117531 (doc 5874/849, tier T1a, CONFLICT)** ← surviving

**`otherOperatingIncome`** (period 7982)
- 740 (doc 5873/848, tier T3, FIRST_WRITE)
- **740 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.accountancy_bookkeeping`** (period 7982)
- **2421 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.computer_costs`** (period 7982)
- **2407 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.depreciation`** (period 7982)
- 640 (doc 5873/848, tier T3, FIRST_WRITE)
- **640 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.directors_pension`** (period 7982)
- 43000 (doc 5873/848, tier T3, FIRST_WRITE)
- **43000 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.directors_salaries`** (period 7982)
- 12570 (doc 5873/848, tier T3, FIRST_WRITE)
- **12570 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.employers_national_insurance`** (period 7982)
- 187 (doc 5873/848, tier T3, FIRST_WRITE)
- **486 (doc 5874/849, tier T1a, CONFLICT)** ← surviving

**`overheadsBreakdown.other_overheads`** (period 7982)
- **136282 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.printing_stationery`** (period 7982)
- **5 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.professional_fees`** (period 7982)
- **1985 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.repairs_maintenance`** (period 7982)
- **1609 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.telecommunications`** (period 7982)
- **2062 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.travel_subsistence`** (period 7982)
- **696 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.use_of_home_as_office`** (period 7982)
- **312 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

**`profitBeforeTax`** (period 7982)
- 118518 (doc 5873/848, tier T3, FIRST_WRITE)
- **118518 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`revenue`** (period 7982)
- 326227 (doc 5873/848, tier T3, FIRST_WRITE)
- **326227 (doc 5874/849, tier T1a, AGREE)** ← surviving

**`staffCosts`** (period 7982)
- **289 (doc 5874/849, tier T1a, ENRICHED)** ← surviving

#### FY 2025

##### BS

**`amountsOwedToDirectors`** (period 7983)
- -180194.29 (doc 5876/852, tier T2, ENRICHED)
- **(null) (doc 5877/853, tier T1a, ERASED)** ← surviving

**`cashAtBank`** (period 7983)
- 167600.6 (doc 5876/852, tier T2, ENRICHED)
- **295005 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`computerEquipment`** (period 7983)
- 4658.06 (doc 5876/852, tier T2, ENRICHED)
- **1680 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`corporationTaxDue`** (period 7983)
- **52782 (doc 5877/853, tier T1a, ENRICHED)** ← surviving

**`otherCreditors`** (period 7983)
- -11949.85 (doc 5876/852, tier T2, ENRICHED)
- **44411 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`prepayments`** (period 7983)
- 2030 (doc 5876/852, tier T2, ENRICHED)
- **7617 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`retainedEarnings`** (period 7983)
- 214137 (doc 5873/848, tier T3, FIRST_WRITE)
- 214970.17 (doc 5876/852, tier T2, CONFLICT)
- **214137 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`shareCapital`** (period 7983)
- 2 (doc 5876/852, tier T2, ENRICHED)
- **(null) (doc 5877/853, tier T1a, ERASED)** ← surviving

**`tangibleFixedAssets`** (period 7983)
- 9142 (doc 5873/848, tier T3, FIRST_WRITE)
- 4658.06 (doc 5876/852, tier T2, CONFLICT)
- **9142 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`taxationSocialSecurity`** (period 7983)
- -1567.67 (doc 5876/852, tier T2, ENRICHED)
- **434 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`totalCurrentAssets`** (period 7983)
- 302622 (doc 5873/848, tier T3, FIRST_WRITE)
- 181240.6 (doc 5876/852, tier T2, CONFLICT)
- **302622 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`totalCurrentLiabilities`** (period 7983)
- 97627 (doc 5873/848, tier T3, FIRST_WRITE)
- -180251.17 (doc 5876/852, tier T2, CONFLICT)
- **97627 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`totalEquity`** (period 7983)
- 214137 (doc 5873/848, tier T3, FIRST_WRITE)
- 364119.83 (doc 5876/852, tier T2, CONFLICT)
- **214137 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`totalLongTermLiabilities`** (period 7983)
- 0 (doc 5873/848, tier T3, FIRST_WRITE)
- (null) (doc 5876/852, tier T2, ERASED)
- **0 (doc 5877/853, tier T1a, ENRICHED)** ← surviving

**`tradeCreditors`** (period 7983)
- 2030 (doc 5876/852, tier T2, ENRICHED)
- **(null) (doc 5877/853, tier T1a, ERASED)** ← surviving

**`tradeDebtors`** (period 7983)
- 11610 (doc 5876/852, tier T2, ENRICHED)
- **(null) (doc 5877/853, tier T1a, ERASED)** ← surviving

**`vatPayable`** (period 7983)
- 13460.64 (doc 5876/852, tier T2, ENRICHED)
- **(null) (doc 5877/853, tier T1a, ERASED)** ← surviving

##### IS

**`administrativeExpenses`** (period 7983)
- 17848 (doc 5873/848, tier T3, FIRST_WRITE)
- 41676.33 (doc 5876/852, tier T2, CONFLICT)
- **53647 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`corporationTax`** (period 7983)
- **52207 (doc 5877/853, tier T1a, ENRICHED)** ← surviving

**`costOfSales`** (period 7983)
- 205301 (doc 5873/848, tier T3, FIRST_WRITE)
- 166074 (doc 5876/852, tier T2, CONFLICT)
- **166054 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`costOfSalesBreakdown.direct_materials`** (period 7983)
- **2383 (doc 5877/853, tier T1a, ENRICHED)** ← surviving

**`costOfSalesBreakdown.other_direct_costs`** (period 7983)
- 2403 (doc 5876/852, tier T2, ENRICHED)
- **(null) (doc 5877/853, tier T1a, ERASED)** ← surviving

**`costOfSalesBreakdown.subcontractor_costs`** (period 7983)
- 163671 (doc 5876/852, tier T2, ENRICHED)
- **163671 (doc 5877/853, tier T1a, AGREE)** ← surviving

**`depreciationAmortisation`** (period 7983)
- 299 (doc 5873/848, tier T3, FIRST_WRITE)
- (null) (doc 5876/852, tier T2, ERASED)
- **299 (doc 5877/853, tier T1a, ENRICHED)** ← surviving

**`directorsRemuneration`** (period 7983)
- 37004 (doc 5873/848, tier T3, FIRST_WRITE)
- 24000 (doc 5876/852, tier T2, CONFLICT)
- **37004 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`dividendsPaid`** (period 7983)
- 85000 (doc 5876/852, tier T2, ENRICHED)
- **(null) (doc 5877/853, tier T1a, ERASED)** ← surviving

**`grossProfit`** (period 7983)
- 235772 (doc 5873/848, tier T3, FIRST_WRITE)
- 274998.5 (doc 5876/852, tier T2, CONFLICT)
- **275019 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`interestPayable`** (period 7983)
- **0 (doc 5877/853, tier T1a, ENRICHED)** ← surviving

**`interestReceivable`** (period 7983)
- 805.49 (doc 5876/852, tier T2, ENRICHED)
- **3448 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`netProfit`** (period 7983)
- 234147.66 (doc 5876/852, tier T2, ENRICHED)
- **169165 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`operatingProfit`** (period 7983)
- 221372 (doc 5873/848, tier T3, FIRST_WRITE)
- 233322.17 (doc 5876/852, tier T2, CONFLICT)
- **221372 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`otherOperatingIncome`** (period 7983)
- 3448 (doc 5873/848, tier T3, FIRST_WRITE)
- **(null) (doc 5876/852, tier T2, ERASED)** ← surviving

**`overheadsBreakdown.accountancy_bookkeeping`** (period 7983)
- 1623 (doc 5876/852, tier T2, ENRICHED)
- **2423 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`overheadsBreakdown.advertising_marketing`** (period 7983)
- 2702.5 (doc 5876/852, tier T2, ENRICHED)
- **2703 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`overheadsBreakdown.computer_costs`** (period 7983)
- 2259.55 (doc 5876/852, tier T2, ENRICHED)
- **2488 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`overheadsBreakdown.depreciation`** (period 7983)
- 299 (doc 5873/848, tier T3, FIRST_WRITE)
- (null) (doc 5876/852, tier T2, ERASED)
- **299 (doc 5877/853, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.directors_pension`** (period 7983)
- 24000 (doc 5873/848, tier T3, FIRST_WRITE)
- 24000 (doc 5876/852, tier T2, AGREE)
- **24000 (doc 5877/853, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.directors_salaries`** (period 7983)
- 12570 (doc 5873/848, tier T3, FIRST_WRITE)
- (null) (doc 5876/852, tier T2, ERASED)
- **12570 (doc 5877/853, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.employers_national_insurance`** (period 7983)
- 434 (doc 5873/848, tier T3, FIRST_WRITE)
- (null) (doc 5876/852, tier T2, ERASED)
- **434 (doc 5877/853, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.it_support_hosting`** (period 7983)
- 60 (doc 5876/852, tier T2, ENRICHED)
- **(null) (doc 5877/853, tier T1a, ERASED)** ← surviving

**`overheadsBreakdown.motor_expenses`** (period 7983)
- **1058 (doc 5877/853, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.other_overheads`** (period 7983)
- 2157.87 (doc 5876/852, tier T2, ENRICHED)
- **-1284 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`overheadsBreakdown.printing_stationery`** (period 7983)
- 5.35 (doc 5876/852, tier T2, ENRICHED)
- **5 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`overheadsBreakdown.professional_fees`** (period 7983)
- 4682.55 (doc 5876/852, tier T2, ENRICHED)
- **4083 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`overheadsBreakdown.rent_rates`** (period 7983)
- **1026 (doc 5877/853, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.repairs_maintenance`** (period 7983)
- 702.54 (doc 5876/852, tier T2, ENRICHED)
- **770 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`overheadsBreakdown.software_subscriptions`** (period 7983)
- 1258.63 (doc 5876/852, tier T2, ENRICHED)
- **(null) (doc 5877/853, tier T1a, ERASED)** ← surviving

**`overheadsBreakdown.staff_wages_salaries`** (period 7983)
- **1089 (doc 5877/853, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.subscriptions_memberships`** (period 7983)
- **1259 (doc 5877/853, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.telecommunications`** (period 7983)
- 1223.15 (doc 5876/852, tier T2, ENRICHED)
- **1254 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`overheadsBreakdown.travel_subsistence`** (period 7983)
- 1001.19 (doc 5876/852, tier T2, ENRICHED)
- **1154 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`overheadsBreakdown.use_of_home_as_office`** (period 7983)
- **312 (doc 5877/853, tier T1a, ENRICHED)** ← surviving

**`profitBeforeTax`** (period 7983)
- 221372 (doc 5873/848, tier T3, FIRST_WRITE)
- 234147.66 (doc 5876/852, tier T2, CONFLICT)
- **221372 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`revenue`** (period 7983)
- 441073 (doc 5873/848, tier T3, FIRST_WRITE)
- 441072.5 (doc 5876/852, tier T2, CONFLICT)
- **441073 (doc 5877/853, tier T1a, CONFLICT)** ← surviving

**`staffCosts`** (period 7983)
- **1089 (doc 5877/853, tier T1a, ENRICHED)** ← surviving

#### FY 2026

##### BS

**`accruals`** (period 7998)
- **0 (doc 5880/1432, tier INT, FIRST_WRITE)** ← surviving

**`amountsOwedByConnectedCompanies`** (period 7998)
- **0 (doc 5880/1432, tier INT, FIRST_WRITE)** ← surviving

**`amountsOwedToDirectors`** (period 7998)
- **-149587.37 (doc 5880/1432, tier INT, FIRST_WRITE)** ← surviving

**`cashAtBank`** (period 7997)
- **195634 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 75312.48 (doc 5880/1432, tier INT, FIRST_WRITE)

**`computerEquipment`** (period 7997)
- **1350 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 6389.47 (doc 5880/1432, tier INT, FIRST_WRITE)

**`corporationTaxDue`** (period 7997)
- **7819 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 87.81 (doc 5880/1432, tier INT, FIRST_WRITE)

**`fixturesFittings`** (period 7998)
- **0 (doc 5880/1432, tier INT, FIRST_WRITE)** ← surviving

**`intangibleAssets`** (period 7998)
- **20291.36 (doc 5880/1432, tier INT, FIRST_WRITE)** ← surviving

**`otherCreditors`** (period 7997)
- **4732 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- -16633.34 (doc 5880/1432, tier INT, FIRST_WRITE)

**`otherDebtors`** (period 7998)
- **32171.51 (doc 5880/1432, tier INT, FIRST_WRITE)** ← surviving

**`prepayments`** (period 7997)
- **0 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 7616.93 (doc 5880/1432, tier INT, FIRST_WRITE)

**`retainedEarnings`** (period 7997)
- **200547 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 377972.93 (doc 5880/1432, tier INT, FIRST_WRITE)

**`shareCapital`** (period 7998)
- **2 (doc 5880/1432, tier INT, FIRST_WRITE)** ← surviving

**`tangibleFixedAssets`** (period 7997)
- **17464 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 6389.47 (doc 5880/1432, tier INT, FIRST_WRITE)

**`taxationSocialSecurity`** (period 7998)
- **-1399.37 (doc 5880/1432, tier INT, FIRST_WRITE)** ← surviving

**`totalCurrentAssets`** (period 7997)
- **195634 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 115100.92 (doc 5880/1432, tier INT, FIRST_WRITE)

**`totalCurrentLiabilities`** (period 7997)
- **12551 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- -151193.18 (doc 5880/1432, tier INT, FIRST_WRITE)

**`totalEquity`** (period 7997)
- **200547 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 292974.93 (doc 5880/1432, tier INT, FIRST_WRITE)

**`totalLongTermLiabilities`** (period 7997)
- **0 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 0 (doc 5880/1432, tier INT, FIRST_WRITE)

**`tradeCreditors`** (period 7998)
- **8960 (doc 5880/1432, tier INT, FIRST_WRITE)** ← surviving

**`vatPayable`** (period 7998)
- **7379.09 (doc 5880/1432, tier INT, FIRST_WRITE)** ← surviving

##### IS

**`administrativeExpenses`** (period 7997)
- **177671 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 13550.42 (doc 5881/1433, tier INT, FIRST_WRITE)

**`corporationTax`** (period 7997)
- **7819 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving

**`costOfSales`** (period 7997)
- **0 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 26882 (doc 5881/1433, tier INT, FIRST_WRITE)

**`costOfSalesBreakdown.subcontractor_costs`** (period 7998)
- **26882 (doc 5881/1433, tier INT, FIRST_WRITE)** ← surviving

**`depreciationAmortisation`** (period 7997)
- **7533 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving

**`directorsRemuneration`** (period 7997)
- **37693 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 8000 (doc 5881/1433, tier INT, FIRST_WRITE)

**`grossProfit`** (period 7997)
- **223404 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 21245 (doc 5881/1433, tier INT, FIRST_WRITE)

**`interestPayable`** (period 7997)
- **0 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving

**`interestReceivable`** (period 7997)
- **3746 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 118.87 (doc 5881/1433, tier INT, FIRST_WRITE)

**`netProfit`** (period 7997)
- **41660 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 7813.45 (doc 5881/1433, tier INT, FIRST_WRITE)

**`operatingProfit`** (period 7997)
- **49479 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 7694.58 (doc 5881/1433, tier INT, FIRST_WRITE)

**`otherOperatingIncome`** (period 7997)
- **3746 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.accountancy_bookkeeping`** (period 7997)
- **2400 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.amortisation`** (period 7997)
- **3422 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.bank_charges`** (period 7997)
- **30 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 40.66 (doc 5881/1433, tier INT, FIRST_WRITE)

**`overheadsBreakdown.computer_costs`** (period 7997)
- **550 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 2291 (doc 5881/1433, tier INT, FIRST_WRITE)

**`overheadsBreakdown.depreciation`** (period 7997)
- **1350 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.directors_pension`** (period 7997)
- **24000 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 8000 (doc 5881/1433, tier INT, FIRST_WRITE)

**`overheadsBreakdown.directors_salaries`** (period 7997)
- **12570 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.employers_national_insurance`** (period 7997)
- **1123 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.insurance`** (period 7997)
- **1032 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 1059.9 (doc 5881/1433, tier INT, FIRST_WRITE)

**`overheadsBreakdown.motor_expenses`** (period 7997)
- **1361 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 2.6 (doc 5881/1433, tier INT, FIRST_WRITE)

**`overheadsBreakdown.other_overheads`** (period 7997)
- **1018 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 202.79 (doc 5881/1433, tier INT, FIRST_WRITE)

**`overheadsBreakdown.professional_fees`** (period 7997)
- **747 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 1038.62 (doc 5881/1433, tier INT, FIRST_WRITE)

**`overheadsBreakdown.rent_rates`** (period 7997)
- **368 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.repairs_maintenance`** (period 7997)
- **758 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 275.18 (doc 5881/1433, tier INT, FIRST_WRITE)

**`overheadsBreakdown.subscriptions_memberships`** (period 7997)
- **188 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 47 (doc 5881/1433, tier INT, FIRST_WRITE)

**`overheadsBreakdown.telecommunications`** (period 7997)
- **1657 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 586.07 (doc 5881/1433, tier INT, FIRST_WRITE)

**`overheadsBreakdown.travel_subsistence`** (period 7997)
- **1273 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 6.6 (doc 5881/1433, tier INT, FIRST_WRITE)

**`overheadsBreakdown.use_of_home_as_office`** (period 7997)
- **312 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving

**`profitBeforeTax`** (period 7997)
- **49479 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 7813.45 (doc 5881/1433, tier INT, FIRST_WRITE)

**`revenue`** (period 7997)
- **223404 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving
- 48127 (doc 5881/1433, tier INT, FIRST_WRITE)

**`staffCosts`** (period 7997)
- **121874 (doc 5879/1335, tier T1a, FIRST_WRITE)** ← surviving

### Innova Design Group Limited

#### FY 2021

##### BS

**`cashAtBank`** (period 7978)
- **133417 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`hirePurchaseCurrent`** (period 7978)
- **93418 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`hirePurchaseLongTerm`** (period 7978)
- **80112 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`otherLongTermDebt`** (period 7978)
- **78623 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`retainedEarnings`** (period 7978)
- **311172 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`shareCapital`** (period 7978)
- **100 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`stockInventory`** (period 7978)
- **819476 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`tangibleFixedAssets`** (period 7978)
- **288699 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`totalCurrentAssets`** (period 7978)
- **1551556 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`totalCurrentLiabilities`** (period 7978)
- **1370248 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`totalEquity`** (period 7978)
- **311272 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`totalLongTermLiabilities`** (period 7978)
- **158735 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`tradeDebtors`** (period 7978)
- **598663 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

##### IS

**`administrativeExpenses`** (period 7978)
- **960613 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`corporationTax`** (period 7978)
- **-48949 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`costOfSales`** (period 7978)
- **3558769 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.direct_labour`** (period 7978)
- **257518 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.direct_materials`** (period 7978)
- **588332 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.other_direct_costs`** (period 7978)
- **549323 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.subcontractor_costs`** (period 7978)
- **2163596 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`depreciationAmortisation`** (period 7978)
- **76175 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`directorsRemuneration`** (period 7978)
- **19995 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`dividendsPaid`** (period 7978)
- **90000 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`grossProfit`** (period 7978)
- **1097543 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`interestPayable`** (period 7978)
- **29920 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`netProfit`** (period 7978)
- **155959 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`operatingProfit`** (period 7978)
- **136930 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.accountancy_bookkeeping`** (period 7978)
- **3600 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.advertising_marketing`** (period 7978)
- **22039 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.bank_charges`** (period 7978)
- **917 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.computer_costs`** (period 7978)
- **20675 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.depreciation`** (period 7978)
- **76175 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.directors_salaries`** (period 7978)
- **19995 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.employers_national_insurance`** (period 7978)
- **54970 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.insurance`** (period 7978)
- **16515 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.motor_expenses`** (period 7978)
- **12065 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.other_overheads`** (period 7978)
- **43894 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.printing_stationery`** (period 7978)
- **9500 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.professional_fees`** (period 7978)
- **25689 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.rent_rates`** (period 7978)
- **151591 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.repairs_maintenance`** (period 7978)
- **29582 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.staff_pension_contributions`** (period 7978)
- **14187 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.staff_training_recruitment`** (period 7978)
- **7392 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.staff_wages_salaries`** (period 7978)
- **400751 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.subscriptions_memberships`** (period 7978)
- **1692 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.telecommunications`** (period 7978)
- **11100 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.travel_subsistence`** (period 7978)
- **7611 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.use_of_home_as_office`** (period 7978)
- **1800 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.utilities`** (period 7978)
- **28868 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`profitBeforeTax`** (period 7978)
- **107010 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`revenue`** (period 7978)
- **4656312 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

**`staffCosts`** (period 7978)
- **469908 (doc 5863/1674, tier T1b, FIRST_WRITE)** ← surviving

#### FY 2022

##### BS

**`cashAtBank`** (period 7977)
- 21316 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **21316 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`hirePurchaseCurrent`** (period 7977)
- **67951 (doc 5863/1674, tier T1b, ENRICHED)** ← surviving

**`hirePurchaseLongTerm`** (period 7977)
- 81413 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **12790 (doc 5863/1674, tier T1b, GRANULARITY)** ← surviving

**`otherLongTermDebt`** (period 7977)
- **68623 (doc 5863/1674, tier T1b, ENRICHED)** ← surviving

**`retainedEarnings`** (period 7977)
- 429089 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **429089 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`shareCapital`** (period 7977)
- 100 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **100 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`stockInventory`** (period 7977)
- 620875 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **620875 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`tangibleFixedAssets`** (period 7977)
- 230701 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **230701 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`totalCurrentAssets`** (period 7977)
- 1524897 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **1524897 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`totalCurrentLiabilities`** (period 7977)
- 1244996 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **1244996 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`totalEquity`** (period 7977)
- 429189 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **429189 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`totalLongTermLiabilities`** (period 7977)
- 81413 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **81413 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`tradeDebtors`** (period 7977)
- 882706 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **882706 (doc 5863/1674, tier T1b, AGREE)** ← surviving

##### IS

**`administrativeExpenses`** (period 7977)
- 1078058 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **1078058 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`corporationTax`** (period 7977)
- -19642 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **-19642 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`costOfSales`** (period 7977)
- 4437034 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **4437034 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`costOfSalesBreakdown.direct_labour`** (period 7977)
- 252380 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **252380 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`costOfSalesBreakdown.direct_materials`** (period 7977)
- 819476 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **819476 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`costOfSalesBreakdown.other_direct_costs`** (period 7977)
- 1582248 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **980718 (doc 5863/1674, tier T1b, CONFLICT)** ← surviving

**`costOfSalesBreakdown.subcontractor_costs`** (period 7977)
- 2384460 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **2384460 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`depreciationAmortisation`** (period 7977)
- 61034 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **61034 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`directorsRemuneration`** (period 7977)
- 23427 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **23427 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`dividendsPaid`** (period 7977)
- **92000 (doc 5863/1674, tier T1b, ENRICHED)** ← surviving

**`grossProfit`** (period 7977)
- 1317259 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **1317259 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`interestPayable`** (period 7977)
- 48926 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **48926 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`interestReceivable`** (period 7977)
- 0 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **(null) (doc 5863/1674, tier T1b, ERASED)** ← surviving

**`netProfit`** (period 7977)
- 209917 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **209917 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`operatingProfit`** (period 7977)
- 239201 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **239201 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.accountancy_bookkeeping`** (period 7977)
- 2600 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **2600 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.advertising_marketing`** (period 7977)
- 27848 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **27848 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.bank_charges`** (period 7977)
- 2427 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **2427 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.computer_costs`** (period 7977)
- 30486 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **30486 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.depreciation`** (period 7977)
- 61034 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **61034 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.directors_salaries`** (period 7977)
- 23427 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **23427 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.employers_national_insurance`** (period 7977)
- 53034 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **53034 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.insurance`** (period 7977)
- 18601 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **18601 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.motor_expenses`** (period 7977)
- 10347 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **10347 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.other_overheads`** (period 7977)
- 18121 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **33723 (doc 5863/1674, tier T1b, CONFLICT)** ← surviving

**`overheadsBreakdown.postage_courier`** (period 7977)
- 17417 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **(null) (doc 5863/1674, tier T1b, ERASED)** ← surviving

**`overheadsBreakdown.printing_stationery`** (period 7977)
- 8371 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **8371 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.professional_fees`** (period 7977)
- 16995 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **16995 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.rent_rates`** (period 7977)
- 135583 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **135583 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.repairs_maintenance`** (period 7977)
- 32882 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **32882 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.staff_pension_contributions`** (period 7977)
- 13494 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **13494 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.staff_training_recruitment`** (period 7977)
- 21533 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **21533 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.staff_wages_salaries`** (period 7977)
- 471773 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **471773 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.subscriptions_memberships`** (period 7977)
- 2099 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **2099 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.telecommunications`** (period 7977)
- 9757 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **9757 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.travel_subsistence`** (period 7977)
- 15439 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **15439 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.use_of_home_as_office`** (period 7977)
- 1800 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **1800 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.utilities`** (period 7977)
- 85081 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **85081 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`profitBeforeTax`** (period 7977)
- 190275 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **190275 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`revenue`** (period 7977)
- 5754293 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **5754293 (doc 5863/1674, tier T1b, AGREE)** ← surviving

**`staffCosts`** (period 7977)
- 506800 (doc 5862/1673, tier T1b, FIRST_WRITE)
- **538301 (doc 5863/1674, tier T1b, CONFLICT)** ← surviving

#### FY 2023

##### BS

**`accruals`** (period 7976)
- 37211 (doc 5861/1672, tier T1a, FIRST_WRITE)
- **(null) (doc 5862/1673, tier T1b, ERASED)** ← surviving

**`amountsOwedToDirectors`** (period 7976)
- 24607 (doc 5861/1672, tier T1a, FIRST_WRITE)
- **(null) (doc 5862/1673, tier T1b, ERASED)** ← surviving

**`bankLoansLongTerm`** (period 7976)
- 17500 (doc 5861/1672, tier T1a, FIRST_WRITE)
- **(null) (doc 5862/1673, tier T1b, ERASED)** ← surviving

**`bankLoansOverdraftCurrent`** (period 7976)
- 10000 (doc 5861/1672, tier T1a, FIRST_WRITE)
- **(null) (doc 5862/1673, tier T1b, ERASED)** ← surviving

**`cashAtBank`** (period 7976)
- 28094 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 28094 (doc 5862/1673, tier T1b, AGREE)
- **28094 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`computerEquipment`** (period 7976)
- 5934 (doc 5861/1672, tier T1a, FIRST_WRITE)
- **(null) (doc 5862/1673, tier T1b, ERASED)** ← surviving

**`corporationTaxDue`** (period 7976)
- 22101 (doc 5861/1672, tier T1a, FIRST_WRITE)
- **(null) (doc 5862/1673, tier T1b, ERASED)** ← surviving

**`hirePurchaseCurrent`** (period 7976)
- 115840 (doc 5861/1672, tier T1a, FIRST_WRITE)
- (null) (doc 5862/1673, tier T1b, ERASED)
- **115840 (doc 5869/1680, tier T1b, ENRICHED)** ← surviving

**`hirePurchaseLongTerm`** (period 7976)
- 27720 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 86343 (doc 5862/1673, tier T1b, CONFLICT)
- **27720 (doc 5869/1680, tier T1b, GRANULARITY)** ← surviving

**`otherCreditors`** (period 7976)
- 2634 (doc 5861/1672, tier T1a, FIRST_WRITE)
- (null) (doc 5862/1673, tier T1b, ERASED)
- **590332 (doc 5869/1680, tier T1b, ENRICHED)** ← surviving

**`otherDebtors`** (period 7976)
- 850 (doc 5861/1672, tier T1a, FIRST_WRITE)
- (null) (doc 5862/1673, tier T1b, ERASED)
- **553354 (doc 5869/1680, tier T1b, ENRICHED)** ← surviving

**`otherLongTermDebt`** (period 7976)
- 41123 (doc 5861/1672, tier T1a, FIRST_WRITE)
- (null) (doc 5862/1673, tier T1b, ERASED)
- **58623 (doc 5869/1680, tier T1b, ENRICHED)** ← surviving

**`plantMachinery`** (period 7976)
- 231540 (doc 5861/1672, tier T1a, FIRST_WRITE)
- **(null) (doc 5862/1673, tier T1b, ERASED)** ← surviving

**`prepayments`** (period 7976)
- 81765 (doc 5861/1672, tier T1a, FIRST_WRITE)
- **(null) (doc 5862/1673, tier T1b, ERASED)** ← surviving

**`retainedEarnings`** (period 7976)
- 457593 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 457593 (doc 5862/1673, tier T1b, AGREE)
- **457593 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`shareCapital`** (period 7976)
- 100 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 100 (doc 5862/1673, tier T1b, AGREE)
- **100 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`stockInventory`** (period 7976)
- 431286 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 431286 (doc 5862/1673, tier T1b, AGREE)
- **431286 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`tangibleFixedAssets`** (period 7976)
- 237474 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 237474 (doc 5862/1673, tier T1b, AGREE)
- **237474 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`taxationSocialSecurity`** (period 7976)
- 36792 (doc 5861/1672, tier T1a, FIRST_WRITE)
- **(null) (doc 5862/1673, tier T1b, ERASED)** ← surviving

**`totalCurrentAssets`** (period 7976)
- 1012734 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 1012734 (doc 5862/1673, tier T1b, AGREE)
- **1012734 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`totalCurrentLiabilities`** (period 7976)
- 706172 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 706172 (doc 5862/1673, tier T1b, AGREE)
- **706172 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`totalEquity`** (period 7976)
- 457693 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 457693 (doc 5862/1673, tier T1b, AGREE)
- **457693 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`totalLongTermLiabilities`** (period 7976)
- 86343 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 86343 (doc 5862/1673, tier T1b, AGREE)
- **86343 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`tradeCreditors`** (period 7976)
- 291986 (doc 5861/1672, tier T1a, FIRST_WRITE)
- **(null) (doc 5862/1673, tier T1b, ERASED)** ← surviving

**`tradeDebtors`** (period 7976)
- 470739 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 553354 (doc 5862/1673, tier T1b, CONFLICT)
- **(null) (doc 5869/1680, tier T1b, ERASED)** ← surviving

**`vatPayable`** (period 7976)
- 165001 (doc 5861/1672, tier T1a, FIRST_WRITE)
- **(null) (doc 5862/1673, tier T1b, ERASED)** ← surviving

##### IS

**`administrativeExpenses`** (period 7976)
- 1076406 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 1076406 (doc 5862/1673, tier T1b, AGREE)
- **1076406 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`corporationTax`** (period 7976)
- 22101 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 22101 (doc 5862/1673, tier T1b, AGREE)
- **22101 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`costOfSales`** (period 7976)
- 3248360 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 3248360 (doc 5862/1673, tier T1b, AGREE)
- **3248360 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`costOfSalesBreakdown.direct_labour`** (period 7976)
- 283368 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 283368 (doc 5862/1673, tier T1b, AGREE)
- **283368 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`costOfSalesBreakdown.direct_materials`** (period 7976)
- 1083880 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 620875 (doc 5862/1673, tier T1b, CONFLICT)
- **(null) (doc 5869/1680, tier T1b, ERASED)** ← surviving

**`costOfSalesBreakdown.other_direct_costs`** (period 7976)
- 58319 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 723073 (doc 5862/1673, tier T1b, CONFLICT)
- **1343948 (doc 5869/1680, tier T1b, CONFLICT)** ← surviving

**`costOfSalesBreakdown.subcontractor_costs`** (period 7976)
- 1621044 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 1621044 (doc 5862/1673, tier T1b, AGREE)
- **1621044 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`depreciationAmortisation`** (period 7976)
- 54527 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 54527 (doc 5862/1673, tier T1b, AGREE)
- **54527 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`directorsRemuneration`** (period 7976)
- 25140 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 25140 (doc 5862/1673, tier T1b, AGREE)
- **25140 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`dividendsPaid`** (period 7976)
- 60000 (doc 5861/1672, tier T1a, FIRST_WRITE)
- **(null) (doc 5862/1673, tier T1b, ERASED)** ← surviving

**`grossProfit`** (period 7976)
- 1201919 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 1201919 (doc 5862/1673, tier T1b, AGREE)
- **1201919 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`interestPayable`** (period 7976)
- 15450 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 15450 (doc 5862/1673, tier T1b, AGREE)
- **15450 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`interestReceivable`** (period 7976)
- 542 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 542 (doc 5862/1673, tier T1b, AGREE)
- **542 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`netProfit`** (period 7976)
- 88504 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 88504 (doc 5862/1673, tier T1b, AGREE)
- **88504 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`operatingProfit`** (period 7976)
- 125513 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 125513 (doc 5862/1673, tier T1b, AGREE)
- **125513 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.accountancy_bookkeeping`** (period 7976)
- 2800 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 2800 (doc 5862/1673, tier T1b, AGREE)
- **2800 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.advertising_marketing`** (period 7976)
- 31842 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 31842 (doc 5862/1673, tier T1b, AGREE)
- **31842 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.bank_charges`** (period 7976)
- 5253 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 5253 (doc 5862/1673, tier T1b, AGREE)
- **5253 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.computer_costs`** (period 7976)
- 30450 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 30450 (doc 5862/1673, tier T1b, AGREE)
- **30450 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.depreciation`** (period 7976)
- 54527 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 54527 (doc 5862/1673, tier T1b, AGREE)
- **54527 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.directors_salaries`** (period 7976)
- 25140 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 25140 (doc 5862/1673, tier T1b, AGREE)
- **25140 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.employers_national_insurance`** (period 7976)
- 48915 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 48915 (doc 5862/1673, tier T1b, AGREE)
- **48915 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.insurance`** (period 7976)
- 38452 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 38452 (doc 5862/1673, tier T1b, AGREE)
- **38452 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.motor_expenses`** (period 7976)
- 8668 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 8668 (doc 5862/1673, tier T1b, AGREE)
- **8668 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.other_overheads`** (period 7976)
- 22243 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 14534 (doc 5862/1673, tier T1b, CONFLICT)
- **14472 (doc 5869/1680, tier T1b, CONFLICT)** ← surviving

**`overheadsBreakdown.postage_courier`** (period 7976)
- 11012 (doc 5862/1673, tier T1b, ENRICHED)
- **11012 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.printing_stationery`** (period 7976)
- 11248 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 11248 (doc 5862/1673, tier T1b, AGREE)
- **11248 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.professional_fees`** (period 7976)
- 5809 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 5809 (doc 5862/1673, tier T1b, AGREE)
- **5809 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.rent_rates`** (period 7976)
- 154371 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 154371 (doc 5862/1673, tier T1b, AGREE)
- **154371 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.repairs_maintenance`** (period 7976)
- 22784 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 22784 (doc 5862/1673, tier T1b, AGREE)
- **22784 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.staff_pension_contributions`** (period 7976)
- 10217 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 10217 (doc 5862/1673, tier T1b, AGREE)
- **10217 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.staff_training_recruitment`** (period 7976)
- 3150 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 3150 (doc 5862/1673, tier T1b, AGREE)
- **3150 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.staff_wages_salaries`** (period 7976)
- 484866 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 484866 (doc 5862/1673, tier T1b, AGREE)
- **484866 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.subscriptions_memberships`** (period 7976)
- 2339 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 2339 (doc 5862/1673, tier T1b, AGREE)
- **2339 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.telecommunications`** (period 7976)
- 10377 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 10377 (doc 5862/1673, tier T1b, AGREE)
- **10377 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.travel_subsistence`** (period 7976)
- 26101 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 26101 (doc 5862/1673, tier T1b, AGREE)
- **26101 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.use_of_home_as_office`** (period 7976)
- 1800 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 1800 (doc 5862/1673, tier T1b, AGREE)
- **1800 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`overheadsBreakdown.utilities`** (period 7976)
- 52271 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 52271 (doc 5862/1673, tier T1b, AGREE)
- **52271 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`profitBeforeTax`** (period 7976)
- 110605 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 110605 (doc 5862/1673, tier T1b, AGREE)
- **110605 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`revenue`** (period 7976)
- 4450279 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 4450279 (doc 5862/1673, tier T1b, AGREE)
- **4450279 (doc 5869/1680, tier T1b, AGREE)** ← surviving

**`staffCosts`** (period 7976)
- 547148 (doc 5861/1672, tier T1a, FIRST_WRITE)
- 498233 (doc 5862/1673, tier T1b, CONFLICT)
- **547038 (doc 5869/1680, tier T1b, CONFLICT)** ← surviving

#### FY 2024

##### BS

**`accruals`** (period 7973)
- 113429 (doc 5861/1672, tier T1a, ENRICHED)
- **113429 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`amountsOwedToDirectors`** (period 7973)
- 3098 (doc 5861/1672, tier T1a, ENRICHED)
- **3098 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`bankLoansLongTerm`** (period 7973)
- 7500 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 7500 (doc 5861/1672, tier T1a, AGREE)
- **7500 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`bankLoansOverdraftCurrent`** (period 7973)
- 10000 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 10000 (doc 5861/1672, tier T1a, AGREE)
- **10000 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`cashAtBank`** (period 7973)
- 346697 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 346697 (doc 5861/1672, tier T1a, AGREE)
- **346697 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`computerEquipment`** (period 7973)
- 11684 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 11684 (doc 5861/1672, tier T1a, AGREE)
- **11684 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`corporationTaxDue`** (period 7973)
- 99882 (doc 5861/1672, tier T1a, ENRICHED)
- **99882 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`hirePurchaseCurrent`** (period 7973)
- 80840 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 80840 (doc 5861/1672, tier T1a, AGREE)
- **80840 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`hirePurchaseLongTerm`** (period 7973)
- 11880 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 11880 (doc 5861/1672, tier T1a, AGREE)
- **11880 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`otherCreditors`** (period 7973)
- 122423 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 5896 (doc 5861/1672, tier T1a, GRANULARITY)
- **5896 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`otherDebtors`** (period 7973)
- 107085 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 1564 (doc 5861/1672, tier T1a, GRANULARITY)
- **850 (doc 5868/1679, tier T1a, CONFLICT)** ← surviving

**`otherLongTermDebt`** (period 7973)
- 40000 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 40000 (doc 5861/1672, tier T1a, AGREE)
- **40000 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`plantMachinery`** (period 7973)
- 199103 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 199103 (doc 5861/1672, tier T1a, AGREE)
- **199103 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`prepayments`** (period 7973)
- 105521 (doc 5861/1672, tier T1a, ENRICHED)
- **105521 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`retainedEarnings`** (period 7973)
- 670553 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 670553 (doc 5861/1672, tier T1a, AGREE)
- **670553 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`shareCapital`** (period 7973)
- 100 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 100 (doc 5861/1672, tier T1a, AGREE)
- **100 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`stockInventory`** (period 7973)
- 166956 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 166956 (doc 5861/1672, tier T1a, AGREE)
- **166956 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`tangibleFixedAssets`** (period 7973)
- 210787 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 210787 (doc 5861/1672, tier T1a, AGREE)
- **210787 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`taxationSocialSecurity`** (period 7973)
- 255845 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 22148 (doc 5861/1672, tier T1a, GRANULARITY)
- **22148 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`totalCurrentAssets`** (period 7973)
- 1284307 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 1284307 (doc 5861/1672, tier T1a, AGREE)
- **1284307 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`totalCurrentLiabilities`** (period 7973)
- 765061 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 765061 (doc 5861/1672, tier T1a, AGREE)
- **765061 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`totalEquity`** (period 7973)
- 670653 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 670653 (doc 5861/1672, tier T1a, AGREE)
- **670653 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`totalLongTermLiabilities`** (period 7973)
- 59380 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 59380 (doc 5861/1672, tier T1a, AGREE)
- **59380 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`tradeCreditors`** (period 7973)
- 295953 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 295953 (doc 5861/1672, tier T1a, AGREE)
- **295953 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`tradeDebtors`** (period 7973)
- 663569 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 663569 (doc 5861/1672, tier T1a, AGREE)
- **663569 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`vatPayable`** (period 7973)
- 133815 (doc 5861/1672, tier T1a, ENRICHED)
- **133815 (doc 5868/1679, tier T1a, AGREE)** ← surviving

##### IS

**`administrativeExpenses`** (period 7973)
- 1198254 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 1198254 (doc 5861/1672, tier T1a, AGREE)
- **1198254 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`corporationTax`** (period 7973)
- 99882 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 99882 (doc 5861/1672, tier T1a, AGREE)
- **99882 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`costOfSales`** (period 7973)
- 3366215 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 3366215 (doc 5861/1672, tier T1a, AGREE)
- **3366215 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`costOfSalesBreakdown.direct_labour`** (period 7973)
- 258889 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 258889 (doc 5861/1672, tier T1a, AGREE)
- **258889 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`costOfSalesBreakdown.direct_materials`** (period 7973)
- 1121586 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 1121586 (doc 5861/1672, tier T1a, AGREE)
- **1121586 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`costOfSalesBreakdown.other_direct_costs`** (period 7973)
- 99354 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 88185 (doc 5861/1672, tier T1a, CONFLICT)
- **88185 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`costOfSalesBreakdown.subcontractor_costs`** (period 7973)
- 1622056 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 1622056 (doc 5861/1672, tier T1a, AGREE)
- **1622056 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`depreciationAmortisation`** (period 7973)
- 52606 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 52606 (doc 5861/1672, tier T1a, AGREE)
- **52606 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`directorsRemuneration`** (period 7973)
- 25140 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 25140 (doc 5861/1672, tier T1a, AGREE)
- **25140 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`dividendsPaid`** (period 7973)
- 60000 (doc 5861/1672, tier T1a, ENRICHED)
- **60000 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`grossProfit`** (period 7973)
- 1589938 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 1589938 (doc 5861/1672, tier T1a, AGREE)
- **1589938 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`interestPayable`** (period 7973)
- 18842 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 18842 (doc 5861/1672, tier T1a, AGREE)
- **18842 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`interestReceivable`** (period 7973)
- 0 (doc 5861/1672, tier T1a, ENRICHED)
- **0 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`netProfit`** (period 7973)
- 272960 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 272960 (doc 5861/1672, tier T1a, AGREE)
- **272960 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`operatingProfit`** (period 7973)
- 391684 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 391684 (doc 5861/1672, tier T1a, AGREE)
- **391684 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.accountancy_bookkeeping`** (period 7973)
- 2800 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 2800 (doc 5861/1672, tier T1a, AGREE)
- **2800 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.advertising_marketing`** (period 7973)
- 38290 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 38290 (doc 5861/1672, tier T1a, AGREE)
- **38290 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.bank_charges`** (period 7973)
- 4518 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 4518 (doc 5861/1672, tier T1a, AGREE)
- **4518 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.computer_costs`** (period 7973)
- 31981 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 31981 (doc 5861/1672, tier T1a, AGREE)
- **31981 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.depreciation`** (period 7973)
- 52606 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 52606 (doc 5861/1672, tier T1a, AGREE)
- **52606 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.directors_salaries`** (period 7973)
- 25140 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 25140 (doc 5861/1672, tier T1a, AGREE)
- **25140 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.employers_national_insurance`** (period 7973)
- 47699 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 47699 (doc 5861/1672, tier T1a, AGREE)
- **47699 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.insurance`** (period 7973)
- 38563 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 38563 (doc 5861/1672, tier T1a, AGREE)
- **38563 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.motor_expenses`** (period 7973)
- 5929 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 5929 (doc 5861/1672, tier T1a, AGREE)
- **5929 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.other_overheads`** (period 7973)
- 13718 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 44937 (doc 5861/1672, tier T1a, CONFLICT)
- **44937 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.printing_stationery`** (period 7973)
- 7827 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 7827 (doc 5861/1672, tier T1a, AGREE)
- **7827 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.professional_fees`** (period 7973)
- 37619 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 37619 (doc 5861/1672, tier T1a, AGREE)
- **37619 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.rent_rates`** (period 7973)
- 212372 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 212372 (doc 5861/1672, tier T1a, AGREE)
- **212372 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.repairs_maintenance`** (period 7973)
- 25612 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 25612 (doc 5861/1672, tier T1a, AGREE)
- **25612 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.staff_pension_contributions`** (period 7973)
- 9513 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 9513 (doc 5861/1672, tier T1a, AGREE)
- **9513 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.staff_training_recruitment`** (period 7973)
- 10901 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 13373 (doc 5861/1672, tier T1a, CONFLICT)
- **13373 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.staff_wages_salaries`** (period 7973)
- 499569 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 499569 (doc 5861/1672, tier T1a, AGREE)
- **499569 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.subscriptions_memberships`** (period 7973)
- 2602 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 2602 (doc 5861/1672, tier T1a, AGREE)
- **2602 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.telecommunications`** (period 7973)
- 10493 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 10493 (doc 5861/1672, tier T1a, AGREE)
- **10493 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.travel_subsistence`** (period 7973)
- 27060 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 27060 (doc 5861/1672, tier T1a, AGREE)
- **27060 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.use_of_home_as_office`** (period 7973)
- 1800 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 1800 (doc 5861/1672, tier T1a, AGREE)
- **1800 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.utilities`** (period 7973)
- 53160 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 53160 (doc 5861/1672, tier T1a, AGREE)
- **53160 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`profitBeforeTax`** (period 7973)
- 372842 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 372842 (doc 5861/1672, tier T1a, AGREE)
- **372842 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`revenue`** (period 7973)
- 4956153 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 4956153 (doc 5861/1672, tier T1a, AGREE)
- **4956153 (doc 5868/1679, tier T1a, AGREE)** ← surviving

**`staffCosts`** (period 7973)
- 556781 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 570154 (doc 5861/1672, tier T1a, CONFLICT)
- **570154 (doc 5868/1679, tier T1a, AGREE)** ← surviving

#### FY 2025

##### BS

**`bankLoansOverdraftCurrent`** (period 7974)
- 7500 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **7500 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`cashAtBank`** (period 7974)
- 346281 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **346281 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`computerEquipment`** (period 7974)
- 24263 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **24263 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`hirePurchaseLongTerm`** (period 7974)
- 33755 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **33755 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`otherCreditors`** (period 7974)
- 48215 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **48215 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`otherDebtors`** (period 7974)
- 81257 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **81257 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`otherLongTermDebt`** (period 7974)
- 20000 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **20000 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`plantMachinery`** (period 7974)
- 183449 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **183449 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`retainedEarnings`** (period 7974)
- 673137 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **673137 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`shareCapital`** (period 7974)
- 100 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **100 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`stockInventory`** (period 7974)
- 274650 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **274650 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`tangibleFixedAssets`** (period 7974)
- 207712 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **207712 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`taxationSocialSecurity`** (period 7974)
- 209786 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **209786 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`totalCurrentAssets`** (period 7974)
- 1131855 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **1131855 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`totalCurrentLiabilities`** (period 7974)
- 612575 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **612575 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`totalEquity`** (period 7974)
- 673237 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **673237 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`totalLongTermLiabilities`** (period 7974)
- 53755 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **53755 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`tradeCreditors`** (period 7974)
- 347074 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **347074 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`tradeDebtors`** (period 7974)
- 429667 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **429667 (doc 5867/1678, tier T1a, AGREE)** ← surviving

##### IS

**`administrativeExpenses`** (period 7974)
- 1361040 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 1303834 (doc 5860/1671, tier T2, FIRST_WRITE)
- **1361040 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`corporationTax`** (period 7974)
- 39122 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 99882 (doc 5860/1671, tier T2, FIRST_WRITE)
- **39122 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`costOfSales`** (period 7974)
- 2979013 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 3044637 (doc 5860/1671, tier T2, FIRST_WRITE)
- **2979013 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`costOfSalesBreakdown.direct_labour`** (period 7974)
- 348777 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 364967 (doc 5860/1671, tier T2, FIRST_WRITE)
- **348777 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`costOfSalesBreakdown.direct_materials`** (period 7974)
- 1332262 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 1302917 (doc 5860/1671, tier T2, FIRST_WRITE)
- **1332262 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`costOfSalesBreakdown.other_direct_costs`** (period 7974)
- 81485 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 68616 (doc 5860/1671, tier T2, FIRST_WRITE)
- **81485 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`costOfSalesBreakdown.subcontractor_costs`** (period 7974)
- 1324183 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 1308137 (doc 5860/1671, tier T2, FIRST_WRITE)
- **1324183 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`depreciationAmortisation`** (period 7974)
- 49005 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 49005 (doc 5860/1671, tier T2, FIRST_WRITE)
- **49005 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`directorsRemuneration`** (period 7974)
- 25140 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **25140 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`grossProfit`** (period 7974)
- 1530073 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 1464340 (doc 5860/1671, tier T2, FIRST_WRITE)
- **1530073 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`interestPayable`** (period 7974)
- 10327 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **10327 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`netProfit`** (period 7974)
- 119584 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 60624 (doc 5860/1671, tier T2, FIRST_WRITE)
- **119584 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`operatingProfit`** (period 7974)
- 169033 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 160506 (doc 5860/1671, tier T2, FIRST_WRITE)
- **169033 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`otherOperatingIncome`** (period 7975)
- **109 (doc 5860/1671, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.accountancy_bookkeeping`** (period 7974)
- 2800 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **2800 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.advertising_marketing`** (period 7974)
- 42617 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 45809 (doc 5860/1671, tier T2, FIRST_WRITE)
- **42617 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.bank_charges`** (period 7974)
- 4729 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 14946 (doc 5860/1671, tier T2, FIRST_WRITE)
- **4729 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.computer_costs`** (period 7974)
- 41092 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 41092 (doc 5860/1671, tier T2, FIRST_WRITE)
- **41092 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.depreciation`** (period 7974)
- 49005 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 49005 (doc 5860/1671, tier T2, FIRST_WRITE)
- **49005 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.directors_salaries`** (period 7974)
- 25140 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **25140 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.employers_national_insurance`** (period 7974)
- 71084 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **71084 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.insurance`** (period 7974)
- 26099 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 28421 (doc 5860/1671, tier T2, FIRST_WRITE)
- **26099 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.motor_expenses`** (period 7974)
- 7475 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 397 (doc 5860/1671, tier T2, FIRST_WRITE)
- **7475 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.other_overheads`** (period 7974)
- 24042 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 30224 (doc 5860/1671, tier T2, FIRST_WRITE)
- **24084 (doc 5867/1678, tier T1a, CONFLICT)** ← surviving

**`overheadsBreakdown.printing_stationery`** (period 7974)
- 13805 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 11686 (doc 5860/1671, tier T2, FIRST_WRITE)
- **13805 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.professional_fees`** (period 7974)
- 16027 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 15541 (doc 5860/1671, tier T2, FIRST_WRITE)
- **12885 (doc 5867/1678, tier T1a, CONFLICT)** ← surviving

**`overheadsBreakdown.rent_rates`** (period 7974)
- 235186 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 238125 (doc 5860/1671, tier T2, FIRST_WRITE)
- **235186 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.repairs_maintenance`** (period 7974)
- 35479 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 12359 (doc 5860/1671, tier T2, FIRST_WRITE)
- **35479 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.staff_pension_contributions`** (period 7974)
- 12416 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **12416 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.staff_training_recruitment`** (period 7974)
- 3471 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **3471 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.staff_wages_salaries`** (period 7974)
- 629176 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 724993 (doc 5860/1671, tier T2, FIRST_WRITE)
- **629176 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.subscriptions_memberships`** (period 7974)
- 3192 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **3192 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.telecommunications`** (period 7974)
- 11977 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 11977 (doc 5860/1671, tier T2, FIRST_WRITE)
- **11977 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.travel_subsistence`** (period 7974)
- 25786 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 30576 (doc 5860/1671, tier T2, FIRST_WRITE)
- **25786 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.use_of_home_as_office`** (period 7974)
- 1800 (doc 5857/1668, tier T1a, FIRST_WRITE)
- **1800 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.utilities`** (period 7974)
- 43142 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 43208 (doc 5860/1671, tier T2, FIRST_WRITE)
- **43142 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`profitBeforeTax`** (period 7974)
- 158706 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 160506 (doc 5860/1671, tier T2, FIRST_WRITE)
- **158706 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`revenue`** (period 7974)
- 4509086 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 4508976 (doc 5860/1671, tier T2, FIRST_WRITE)
- **4509086 (doc 5867/1678, tier T1a, AGREE)** ← surviving

**`staffCosts`** (period 7974)
- 712676 (doc 5857/1668, tier T1a, FIRST_WRITE)
- 724993 (doc 5860/1671, tier T2, FIRST_WRITE)
- **716147 (doc 5867/1678, tier T1a, CONFLICT)** ← surviving

#### FY 2026

##### BS

**`accruals`** (period 7979)
- **116331 (doc 5866/1677, tier INT, FIRST_WRITE)** ← surviving

**`cashAtBank`** (period 7979)
- **210202 (doc 5866/1677, tier INT, FIRST_WRITE)** ← surviving

**`computerEquipment`** (period 7979)
- **20392 (doc 5866/1677, tier INT, FIRST_WRITE)** ← surviving

**`corporationTaxDue`** (period 7979)
- **39122 (doc 5866/1677, tier INT, FIRST_WRITE)** ← surviving

**`otherCreditors`** (period 7979)
- **34350 (doc 5866/1677, tier INT, FIRST_WRITE)** ← surviving

**`otherDebtors`** (period 7979)
- **12211 (doc 5866/1677, tier INT, FIRST_WRITE)** ← surviving

**`otherLongTermDebt`** (period 7979)
- **182975 (doc 5866/1677, tier INT, FIRST_WRITE)** ← surviving

**`plantMachinery`** (period 7979)
- **249529 (doc 5866/1677, tier INT, FIRST_WRITE)** ← surviving

**`prepayments`** (period 7979)
- **80360 (doc 5866/1677, tier INT, FIRST_WRITE)** ← surviving

**`retainedEarnings`** (period 7979)
- **648247 (doc 5866/1677, tier INT, FIRST_WRITE)** ← surviving

**`shareCapital`** (period 7979)
- **100 (doc 5866/1677, tier INT, FIRST_WRITE)** ← surviving

**`stockInventory`** (period 7979)
- **386462 (doc 5866/1677, tier INT, FIRST_WRITE)** ← surviving

**`tangibleFixedAssets`** (period 7979)
- **269921 (doc 5866/1677, tier INT, FIRST_WRITE)** ← surviving

**`taxationSocialSecurity`** (period 7979)
- **39357 (doc 5866/1677, tier INT, FIRST_WRITE)** ← surviving

**`totalCurrentAssets`** (period 7979)
- **1145049 (doc 5866/1677, tier INT, FIRST_WRITE)** ← surviving

**`totalCurrentLiabilities`** (period 7979)
- **583648 (doc 5866/1677, tier INT, FIRST_WRITE)** ← surviving

**`totalEquity`** (period 7979)
- **648347 (doc 5866/1677, tier INT, FIRST_WRITE)** ← surviving

**`totalLongTermLiabilities`** (period 7979)
- **182975 (doc 5866/1677, tier INT, FIRST_WRITE)** ← surviving

**`tradeCreditors`** (period 7979)
- **248574 (doc 5866/1677, tier INT, FIRST_WRITE)** ← surviving

**`tradeDebtors`** (period 7979)
- **480236 (doc 5866/1677, tier INT, FIRST_WRITE)** ← surviving

**`vatPayable`** (period 7979)
- **163976 (doc 5866/1677, tier INT, FIRST_WRITE)** ← surviving

##### IS

**`administrativeExpenses`** (period 7979)
- **576277 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`corporationTax`** (period 7979)
- **0 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`costOfSales`** (period 7979)
- **823023 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.direct_labour`** (period 7979)
- **307162 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.direct_materials`** (period 7979)
- **253422 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.other_direct_costs`** (period 7979)
- **137169 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.subcontractor_costs`** (period 7979)
- **125270 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`depreciationAmortisation`** (period 7979)
- **26663 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`grossProfit`** (period 7979)
- **717177 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`netProfit`** (period 7979)
- **140900 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`operatingProfit`** (period 7979)
- **149189 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`otherOperatingIncome`** (period 7979)
- **8289 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.advertising_marketing`** (period 7979)
- **24194 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.bank_charges`** (period 7979)
- **6855 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.computer_costs`** (period 7979)
- **18270 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.depreciation`** (period 7979)
- **26663 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.insurance`** (period 7979)
- **16142 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.motor_expenses`** (period 7979)
- **422 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.other_overheads`** (period 7979)
- **11743 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.printing_stationery`** (period 7979)
- **3927 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.professional_fees`** (period 7979)
- **21177 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.rent_rates`** (period 7979)
- **93966 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.repairs_maintenance`** (period 7979)
- **2312 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.staff_wages_salaries`** (period 7979)
- **339232 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.telecommunications`** (period 7979)
- **3298 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.travel_subsistence`** (period 7979)
- **9437 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.utilities`** (period 7979)
- **20639 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`profitBeforeTax`** (period 7979)
- **149189 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`revenue`** (period 7979)
- **1540000 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

**`staffCosts`** (period 7979)
- **339232 (doc 5865/1676, tier INT, FIRST_WRITE)** ← surviving

### Thor-CON (Midland Air Conditioning)

#### FY 2021

##### BS

**`retainedEarnings`** (period 7953)
- **33166 (doc 5835/1765, tier T3, FIRST_WRITE)** ← surviving

**`shareCapital`** (period 7953)
- **0 (doc 5835/1765, tier T3, FIRST_WRITE)** ← surviving

**`totalCurrentAssets`** (period 7953)
- **194994 (doc 5835/1765, tier T3, FIRST_WRITE)** ← surviving

**`totalCurrentLiabilities`** (period 7953)
- **136629 (doc 5835/1765, tier T3, FIRST_WRITE)** ← surviving

**`totalEquity`** (period 7953)
- **33166 (doc 5835/1765, tier T3, FIRST_WRITE)** ← surviving

**`totalLongTermLiabilities`** (period 7953)
- **120131 (doc 5835/1765, tier T3, FIRST_WRITE)** ← surviving

##### IS

**`administrativeExpenses`** (period 7953)
- **432058 (doc 5835/1765, tier T3, FIRST_WRITE)** ← surviving

**`costOfSales`** (period 7953)
- **127439 (doc 5835/1765, tier T3, FIRST_WRITE)** ← surviving

**`depreciationAmortisation`** (period 7953)
- **25307 (doc 5835/1765, tier T3, FIRST_WRITE)** ← surviving

**`directorsRemuneration`** (period 7953)
- **8628 (doc 5835/1765, tier T3, FIRST_WRITE)** ← surviving

**`grossProfit`** (period 7953)
- **316523 (doc 5835/1765, tier T3, FIRST_WRITE)** ← surviving

**`netProfit`** (period 7953)
- **-2200 (doc 5835/1765, tier T3, FIRST_WRITE)** ← surviving

**`operatingProfit`** (period 7953)
- **-2200 (doc 5835/1765, tier T3, FIRST_WRITE)** ← surviving

**`otherOperatingIncome`** (period 7953)
- **113335 (doc 5835/1765, tier T3, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.depreciation`** (period 7953)
- **25307 (doc 5835/1765, tier T3, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.directors_salaries`** (period 7953)
- **8628 (doc 5835/1765, tier T3, FIRST_WRITE)** ← surviving

**`profitBeforeTax`** (period 7953)
- **-2200 (doc 5835/1765, tier T3, FIRST_WRITE)** ← surviving

**`revenue`** (period 7953)
- **443962 (doc 5835/1765, tier T3, FIRST_WRITE)** ← surviving

#### FY 2022

##### BS

**`bankLoansLongTerm`** (period 7950)
- **63333 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`bankLoansOverdraftCurrent`** (period 7950)
- **20000 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`cashAtBank`** (period 7950)
- **144776 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`corporationTaxDue`** (period 7950)
- **29820 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`hirePurchaseCurrent`** (period 7950)
- **5770 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`hirePurchaseLongTerm`** (period 7950)
- **12497 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`otherCreditors`** (period 7950)
- **33809 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`otherDebtors`** (period 7950)
- **62753 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`plantMachinery`** (period 7950)
- **49395 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`retainedEarnings`** (period 7950)
- **77808 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`shareCapital`** (period 7950)
- **100 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`tangibleFixedAssets`** (period 7950)
- **49395 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`taxationSocialSecurity`** (period 7950)
- **60792 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`totalCurrentAssets`** (period 7950)
- **321236 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`totalCurrentLiabilities`** (period 7950)
- **216893 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`totalEquity`** (period 7950)
- **77908 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`totalLongTermLiabilities`** (period 7950)
- **75830 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`tradeCreditors`** (period 7950)
- **96522 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`tradeDebtors`** (period 7950)
- **113707 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

##### IS

**`administrativeExpenses`** (period 7950)
- **554473 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`corporationTax`** (period 7950)
- **29820 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`costOfSales`** (period 7950)
- **440662 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.direct_materials`** (period 7950)
- **261649 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.other_direct_costs`** (period 7950)
- **17648 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.subcontractor_costs`** (period 7950)
- **161365 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`depreciationAmortisation`** (period 7950)
- **10960 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`directorsRemuneration`** (period 7950)
- **8628 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`dividendsPaid`** (period 7950)
- **44500 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`grossProfit`** (period 7950)
- **656645 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`interestPayable`** (period 7950)
- **7720 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`interestReceivable`** (period 7950)
- **3 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`netProfit`** (period 7950)
- **89242 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`operatingProfit`** (period 7950)
- **126779 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`otherOperatingIncome`** (period 7950)
- **24607 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.accountancy_bookkeeping`** (period 7950)
- **905 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.advertising_marketing`** (period 7950)
- **30198 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.bank_charges`** (period 7950)
- **4376 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.computer_costs`** (period 7950)
- **31663 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.depreciation`** (period 7950)
- **10960 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.directors_salaries`** (period 7950)
- **8628 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.employers_national_insurance`** (period 7950)
- **20467 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.insurance`** (period 7950)
- **6317 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.motor_expenses`** (period 7950)
- **58660 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.other_overheads`** (period 7950)
- **114 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.printing_stationery`** (period 7950)
- **1853 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.professional_fees`** (period 7950)
- **13262 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.rent_rates`** (period 7950)
- **11995 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.repairs_maintenance`** (period 7950)
- **4052 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.staff_pension_contributions`** (period 7950)
- **4833 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.staff_training_recruitment`** (period 7950)
- **2090 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.staff_wages_salaries`** (period 7950)
- **287844 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.subscriptions_memberships`** (period 7950)
- **6290 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.telecommunications`** (period 7950)
- **8441 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.travel_subsistence`** (period 7950)
- **16519 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.utilities`** (period 7950)
- **2126 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`profitBeforeTax`** (period 7950)
- **119062 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`revenue`** (period 7950)
- **1097307 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

**`staffCosts`** (period 7950)
- **315234 (doc 5831/1759, tier T1a, FIRST_WRITE)** ← surviving

#### FY 2023

##### BS

**`bankLoansLongTerm`** (period 7948)
- 43333 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **43333 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`bankLoansOverdraftCurrent`** (period 7948)
- 20000 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **20000 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`cashAtBank`** (period 7948)
- 139509 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **139509 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`corporationTaxDue`** (period 7948)
- **31780 (doc 5831/1759, tier T1a, ENRICHED)** ← surviving

**`deferredTaxation`** (period 7948)
- 4434 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **(null) (doc 5831/1759, tier T1a, ERASED)** ← surviving

**`hirePurchaseCurrent`** (period 7948)
- **2677 (doc 5831/1759, tier T1a, ENRICHED)** ← surviving

**`hirePurchaseLongTerm`** (period 7948)
- 1711 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **1711 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`leaseholdProperty`** (period 7948)
- 10231 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **(null) (doc 5831/1759, tier T1a, ERASED)** ← surviving

**`otherCreditors`** (period 7948)
- 36449 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **33772 (doc 5831/1759, tier T1a, GRANULARITY)** ← surviving

**`otherDebtors`** (period 7948)
- 92793 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **92793 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`plantMachinery`** (period 7948)
- 35376 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **45607 (doc 5831/1759, tier T1a, CONFLICT)** ← surviving

**`retainedEarnings`** (period 7948)
- 164400 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **168834 (doc 5831/1759, tier T1a, CONFLICT)** ← surviving

**`shareCapital`** (period 7948)
- 100 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **100 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`tangibleFixedAssets`** (period 7948)
- 45607 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **45607 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`taxationSocialSecurity`** (period 7948)
- 54118 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **54118 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`totalCurrentAssets`** (period 7948)
- 391084 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **391084 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`totalCurrentLiabilities`** (period 7948)
- 222713 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **222713 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`totalEquity`** (period 7948)
- 164500 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **168934 (doc 5831/1759, tier T1a, CONFLICT)** ← surviving

**`totalLongTermLiabilities`** (period 7948)
- 49478 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **45044 (doc 5831/1759, tier T1a, CONFLICT)** ← surviving

**`tradeCreditors`** (period 7948)
- 112146 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **112146 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`tradeDebtors`** (period 7948)
- 158782 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **158782 (doc 5831/1759, tier T1a, AGREE)** ← surviving

##### IS

**`administrativeExpenses`** (period 7948)
- 730019 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **730019 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`corporationTax`** (period 7948)
- 36214 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **31780 (doc 5831/1759, tier T1a, CONFLICT)** ← surviving

**`costOfSales`** (period 7948)
- 538883 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **538883 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`costOfSalesBreakdown.direct_materials`** (period 7948)
- 422194 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **422194 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`costOfSalesBreakdown.other_direct_costs`** (period 7948)
- 24307 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **24307 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`costOfSalesBreakdown.subcontractor_costs`** (period 7948)
- 92382 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **92382 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`depreciationAmortisation`** (period 7948)
- 10824 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **10824 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`directorsRemuneration`** (period 7948)
- 9211 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **9211 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`dividendsPaid`** (period 7948)
- 45500 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **45500 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`grossProfit`** (period 7948)
- 902788 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **902788 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`interestPayable`** (period 7948)
- 4524 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **4524 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`interestReceivable`** (period 7948)
- 61 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **61 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`netProfit`** (period 7948)
- 132092 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **136526 (doc 5831/1759, tier T1a, CONFLICT)** ← surviving

**`operatingProfit`** (period 7948)
- 172769 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **172769 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`otherOperatingIncome`** (period 7948)
- **0 (doc 5831/1759, tier T1a, ENRICHED)** ← surviving

**`overheadsBreakdown.accountancy_bookkeeping`** (period 7948)
- 1485 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **1485 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.advertising_marketing`** (period 7948)
- 34869 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **34869 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.bank_charges`** (period 7948)
- 8939 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **8939 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.computer_costs`** (period 7948)
- 65498 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **65498 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.depreciation`** (period 7948)
- 10824 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **10824 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.directors_salaries`** (period 7948)
- 9211 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **9211 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.employers_national_insurance`** (period 7948)
- 24418 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **24418 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.insurance`** (period 7948)
- 8347 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **8347 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.motor_expenses`** (period 7948)
- 65303 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **65303 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.other_overheads`** (period 7948)
- 15403 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **1460 (doc 5831/1759, tier T1a, CONFLICT)** ← surviving

**`overheadsBreakdown.printing_stationery`** (period 7948)
- 298 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **298 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.professional_fees`** (period 7948)
- 50440 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **50440 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.rent_rates`** (period 7948)
- 11995 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **11995 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.repairs_maintenance`** (period 7948)
- 12362 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **12362 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.staff_pension_contributions`** (period 7948)
- 6345 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **6345 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.staff_training_recruitment`** (period 7948)
- 3099 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **3099 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.staff_wages_salaries`** (period 7948)
- 327248 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **327248 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.subscriptions_memberships`** (period 7948)
- 8702 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **8702 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.telecommunications`** (period 7948)
- 6107 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **6107 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.travel_subsistence`** (period 7948)
- 16298 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **16298 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`overheadsBreakdown.utilities`** (period 7948)
- 5455 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **5455 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`profitBeforeTax`** (period 7948)
- 168306 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **168306 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`revenue`** (period 7948)
- 1441671 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **1441671 (doc 5831/1759, tier T1a, AGREE)** ← surviving

**`staffCosts`** (period 7948)
- 361110 (doc 5830/1624, tier T1a, FIRST_WRITE)
- **361110 (doc 5831/1759, tier T1a, AGREE)** ← surviving

#### FY 2024

##### BS

**`bankLoansLongTerm`** (period 7949)
- **23333 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`bankLoansOverdraftCurrent`** (period 7949)
- **20000 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`cashAtBank`** (period 7949)
- **154281 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`deferredTaxation`** (period 7949)
- **46935 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`hirePurchaseLongTerm`** (period 7949)
- **249133 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`leaseholdProperty`** (period 7949)
- **6879 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`otherCreditors`** (period 7949)
- **155415 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`otherDebtors`** (period 7949)
- **151660 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`plantMachinery`** (period 7949)
- **325585 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`retainedEarnings`** (period 7949)
- **165682 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`shareCapital`** (period 7949)
- **100 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`tangibleFixedAssets`** (period 7949)
- **332464 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`taxationSocialSecurity`** (period 7949)
- **9830 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`totalCurrentAssets`** (period 7949)
- **446241 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`totalCurrentLiabilities`** (period 7949)
- **293522 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`totalEquity`** (period 7949)
- **165782 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`totalLongTermLiabilities`** (period 7949)
- **319401 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`tradeCreditors`** (period 7949)
- **108277 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`tradeDebtors`** (period 7949)
- **140300 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

##### IS

**`administrativeExpenses`** (period 7949)
- **985102 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`corporationTax`** (period 7949)
- **17148 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`costOfSales`** (period 7949)
- **632814 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.direct_materials`** (period 7949)
- **486595 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.other_direct_costs`** (period 7949)
- **21263 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.subcontractor_costs`** (period 7949)
- **124956 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`depreciationAmortisation`** (period 7949)
- **51911 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`directorsRemuneration`** (period 7949)
- **15096 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`dividendsPaid`** (period 7949)
- **52608 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`grossProfit`** (period 7949)
- **1062389 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`interestPayable`** (period 7949)
- **6761 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`interestReceivable`** (period 7949)
- **512 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`netProfit`** (period 7949)
- **53890 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`operatingProfit`** (period 7949)
- **77287 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.accountancy_bookkeeping`** (period 7949)
- **2120 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.advertising_marketing`** (period 7949)
- **77861 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.bank_charges`** (period 7949)
- **10268 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.computer_costs`** (period 7949)
- **33098 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.depreciation`** (period 7949)
- **51911 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.directors_pension`** (period 7949)
- **6000 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.directors_salaries`** (period 7949)
- **9096 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.employers_national_insurance`** (period 7949)
- **36211 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.insurance`** (period 7949)
- **8485 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.motor_expenses`** (period 7949)
- **69978 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.other_overheads`** (period 7949)
- **45155 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.printing_stationery`** (period 7949)
- **1095 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.professional_fees`** (period 7949)
- **61055 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.rent_rates`** (period 7949)
- **11995 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.repairs_maintenance`** (period 7949)
- **16104 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.staff_pension_contributions`** (period 7949)
- **8812 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.staff_training_recruitment`** (period 7949)
- **15418 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.staff_wages_salaries`** (period 7949)
- **471211 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.subscriptions_memberships`** (period 7949)
- **11716 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.telecommunications`** (period 7949)
- **7395 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.travel_subsistence`** (period 7949)
- **22064 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.utilities`** (period 7949)
- **7312 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`profitBeforeTax`** (period 7949)
- **71038 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`revenue`** (period 7949)
- **1695203 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

**`staffCosts`** (period 7949)
- **531652 (doc 5830/1624, tier T1a, FIRST_WRITE)** ← surviving

#### FY 2025

##### BS

**`accruals`** (period 7958)
- **7412.48 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`amountsOwedByConnectedCompanies`** (period 7958)
- **122038.22 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`amountsOwedToDirectors`** (period 7958)
- **-16056.67 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`bankLoansLongTerm`** (period 7958)
- **5140.73 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`cashAtBank`** (period 7958)
- **187479.57 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`computerEquipment`** (period 7958)
- **12798.44 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`corporationTaxDue`** (period 7958)
- **1208.26 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`deferredTaxation`** (period 7958)
- **46935 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`fixturesFittings`** (period 7958)
- **12786.16 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`hirePurchaseLongTerm`** (period 7958)
- **-167914.37 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`motorVehicles`** (period 7958)
- **297992.12 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`otherCreditors`** (period 7958)
- **58803.27 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`otherDebtors`** (period 7958)
- **5140.1 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`otherLongTermDebt`** (period 7958)
- **319252.04 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`plantMachinery`** (period 7958)
- **2008 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`prepayments`** (period 7958)
- **499 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`retainedEarnings`** (period 7951)
- **279164.69 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving
- 622863.28 (doc 5836/1775, tier INT, FIRST_WRITE)

**`shareCapital`** (period 7958)
- **100 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`tangibleFixedAssets`** (period 7958)
- **502332.22 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`taxationSocialSecurity`** (period 7958)
- **22742.17 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`totalCurrentAssets`** (period 7958)
- **419921.68 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`totalCurrentLiabilities`** (period 7958)
- **95877.22 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`totalEquity`** (period 7951)
- **279164.69 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving
- 622963.28 (doc 5836/1775, tier INT, FIRST_WRITE)

**`totalLongTermLiabilities`** (period 7958)
- **203413.4 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`tradeCreditors`** (period 7958)
- **14122.57 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`tradeDebtors`** (period 7958)
- **226803.01 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

**`vatPayable`** (period 7958)
- **7645.14 (doc 5836/1775, tier INT, FIRST_WRITE)** ← surviving

##### IS

**`administrativeExpenses`** (period 7951)
- **538499.64 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`costOfSales`** (period 7951)
- **1127175.46 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.direct_labour`** (period 7951)
- **262957.82 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.direct_materials`** (period 7951)
- **679731.07 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.other_direct_costs`** (period 7951)
- **28752.69 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.subcontractor_costs`** (period 7951)
- **155733.88 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`directorsRemuneration`** (period 7951)
- **9096 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`grossProfit`** (period 7951)
- **816903.54 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`interestPayable`** (period 7951)
- **3254.93 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`interestReceivable`** (period 7951)
- **760.79 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`netProfit`** (period 7951)
- **279164.69 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`operatingProfit`** (period 7951)
- **278403.9 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.accountancy_bookkeeping`** (period 7951)
- **1720 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.advertising_marketing`** (period 7951)
- **115375.65 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.bank_charges`** (period 7951)
- **9804.95 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.directors_salaries`** (period 7951)
- **9096 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.employers_national_insurance`** (period 7951)
- **14696.96 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.insurance`** (period 7951)
- **33318.71 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.motor_expenses`** (period 7951)
- **126444.1 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.other_overheads`** (period 7951)
- **18700.74 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.postage_courier`** (period 7951)
- **30.74 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.printing_stationery`** (period 7951)
- **1666.84 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.professional_fees`** (period 7951)
- **36281.27 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.rent_rates`** (period 7951)
- **11994.96 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.repairs_maintenance`** (period 7951)
- **13165.77 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.software_subscriptions`** (period 7951)
- **19928.63 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.staff_pension_contributions`** (period 7951)
- **4084.1 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.staff_training_recruitment`** (period 7951)
- **18542.02 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.staff_wages_salaries`** (period 7951)
- **194583.37 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.subscriptions_memberships`** (period 7951)
- **12568.17 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.telecommunications`** (period 7951)
- **7492.72 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.travel_subsistence`** (period 7951)
- **9311.29 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.utilities`** (period 7951)
- **5287.65 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`profitBeforeTax`** (period 7951)
- **279164.69 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`revenue`** (period 7951)
- **1944079 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

**`staffCosts`** (period 7951)
- **213364.43 (doc 5832/1762, tier T2, FIRST_WRITE)** ← surviving

#### FY 2026

##### IS

**`administrativeExpenses`** (period 7952)
- **269379.63 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`costOfSales`** (period 7952)
- **372850.39 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.direct_labour`** (period 7952)
- **87593.07 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.direct_materials`** (period 7952)
- **225926.99 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.other_direct_costs`** (period 7952)
- **12112.18 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`costOfSalesBreakdown.subcontractor_costs`** (period 7952)
- **47218.15 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`directorsRemuneration`** (period 7952)
- **3789.98 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`grossProfit`** (period 7952)
- **452384.26 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`interestPayable`** (period 7952)
- **4613.79 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`interestReceivable`** (period 7952)
- **121.94 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`netProfit`** (period 7952)
- **183126.57 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`operatingProfit`** (period 7952)
- **183004.63 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`otherOperatingIncome`** (period 7952)
- **121.94 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.advertising_marketing`** (period 7952)
- **42211.5 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.bank_charges`** (period 7952)
- **6028.16 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.computer_costs`** (period 7952)
- **1659.38 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.directors_salaries`** (period 7952)
- **3789.98 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.employers_national_insurance`** (period 7952)
- **13541.71 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.insurance`** (period 7952)
- **9755.5 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.motor_expenses`** (period 7952)
- **19351.05 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.other_overheads`** (period 7952)
- **21403.36 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.postage_courier`** (period 7952)
- **11 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.printing_stationery`** (period 7952)
- **96.01 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.professional_fees`** (period 7952)
- **12616.54 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.rent_rates`** (period 7952)
- **6998.32 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.repairs_maintenance`** (period 7952)
- **4423.75 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.software_subscriptions`** (period 7952)
- **7358.44 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.staff_pension_contributions`** (period 7952)
- **2151.21 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.staff_training_recruitment`** (period 7952)
- **3742.33 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.staff_wages_salaries`** (period 7952)
- **105376.37 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.subscriptions_memberships`** (period 7952)
- **6570.37 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.telecommunications`** (period 7952)
- **3044.84 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.travel_subsistence`** (period 7952)
- **1611.29 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`overheadsBreakdown.utilities`** (period 7952)
- **639.52 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`profitBeforeTax`** (period 7952)
- **183126.57 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`revenue`** (period 7952)
- **825234.65 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

**`staffCosts`** (period 7952)
- **124811.62 (doc 5833/1763, tier INT, FIRST_WRITE)** ← surviving

---

## S2 — CONFLICT Rows

Sorted: company → fiscal year → field.

| Company | FY | Stmt | Period | Field | Prev value | Prev doc (tier) | New value | New doc (tier) | |Δ| | %Δ |
|---|---|---|---|---|---|---|---|---|---|---|
| Cooper Gibson | 2023 | IS | 7981 | `administrativeExpenses` | 69497 | 5873/849 (T3) | 135820 | 5874/849 (T1a) | 66323 | 95.43% |
| Cooper Gibson | 2023 | IS | 7981 | `grossProfit` | 130075 | 5873/849 (T3) | 198080 | 5874/849 (T1a) | 68005 | 52.28% |
| Cooper Gibson | 2023 | IS | 7981 | `operatingProfit` | 60757 | 5873/849 (T3) | 62250 | 5874/849 (T1a) | 1493 | 2.46% |
| Cooper Gibson | 2024 | IS | 7982 | `administrativeExpenses` | 12094 | 5873/849 (T3) | 204475 | 5874/849 (T1a) | 192381 | 1590.71% |
| Cooper Gibson | 2024 | IS | 7982 | `costOfSales` | 196355 | 5873/849 (T3) | 4221 | 5874/849 (T1a) | 192134 | 97.85% |
| Cooper Gibson | 2024 | IS | 7982 | `directorsRemuneration` | 55757 | 5873/849 (T3) | 56056 | 5874/849 (T1a) | 299 | 0.54% |
| Cooper Gibson | 2024 | IS | 7982 | `grossProfit` | 129872 | 5873/849 (T3) | 322006 | 5874/849 (T1a) | 192134 | 147.94% |
| Cooper Gibson | 2024 | IS | 7982 | `operatingProfit` | 118518 | 5873/849 (T3) | 117531 | 5874/849 (T1a) | 987 | 0.83% |
| Cooper Gibson | 2024 | IS | 7982 | `overheadsBreakdown.employers_national_insurance` | 187 | 5873/849 (T3) | 486 | 5874/849 (T1a) | 299 | 159.89% |
| Cooper Gibson | 2025 | BS | 7983 | `cashAtBank` | 167600.6 | 5876/853 (T2) | 295005 | 5877/853 (T1a) | 127404.4 | 76.02% |
| Cooper Gibson | 2025 | BS | 7983 | `computerEquipment` | 4658.06 | 5876/853 (T2) | 1680 | 5877/853 (T1a) | 2978.0600000000004 | 63.93% |
| Cooper Gibson | 2025 | BS | 7983 | `otherCreditors` | -11949.85 | 5876/853 (T2) | 44411 | 5877/853 (T1a) | 56360.85 | 471.64% |
| Cooper Gibson | 2025 | BS | 7983 | `prepayments` | 2030 | 5876/853 (T2) | 7617 | 5877/853 (T1a) | 5587 | 275.22% |
| Cooper Gibson | 2025 | BS | 7983 | `retainedEarnings` | 214137 | 5873/852 (T3) | 214970.17 | 5876/852 (T2) | 833.1700000000128 | 0.39% |
| Cooper Gibson | 2025 | BS | 7983 | `retainedEarnings` | 214970.17 | 5876/853 (T2) | 214137 | 5877/853 (T1a) | 833.1700000000128 | 0.39% |
| Cooper Gibson | 2025 | BS | 7983 | `tangibleFixedAssets` | 9142 | 5873/852 (T3) | 4658.06 | 5876/852 (T2) | 4483.94 | 49.05% |
| Cooper Gibson | 2025 | BS | 7983 | `tangibleFixedAssets` | 4658.06 | 5876/853 (T2) | 9142 | 5877/853 (T1a) | 4483.94 | 96.26% |
| Cooper Gibson | 2025 | BS | 7983 | `taxationSocialSecurity` | -1567.67 | 5876/853 (T2) | 434 | 5877/853 (T1a) | 2001.67 | 127.68% |
| Cooper Gibson | 2025 | BS | 7983 | `totalCurrentAssets` | 302622 | 5873/852 (T3) | 181240.6 | 5876/852 (T2) | 121381.4 | 40.11% |
| Cooper Gibson | 2025 | BS | 7983 | `totalCurrentAssets` | 181240.6 | 5876/853 (T2) | 302622 | 5877/853 (T1a) | 121381.4 | 66.97% |
| Cooper Gibson | 2025 | BS | 7983 | `totalCurrentLiabilities` | 97627 | 5873/852 (T3) | -180251.17 | 5876/852 (T2) | 277878.17000000004 | 284.63% |
| Cooper Gibson | 2025 | BS | 7983 | `totalCurrentLiabilities` | -180251.17 | 5876/853 (T2) | 97627 | 5877/853 (T1a) | 277878.17000000004 | 154.16% |
| Cooper Gibson | 2025 | BS | 7983 | `totalEquity` | 214137 | 5873/852 (T3) | 364119.83 | 5876/852 (T2) | 149982.83000000002 | 70.04% |
| Cooper Gibson | 2025 | BS | 7983 | `totalEquity` | 364119.83 | 5876/853 (T2) | 214137 | 5877/853 (T1a) | 149982.83000000002 | 41.19% |
| Cooper Gibson | 2025 | IS | 7983 | `administrativeExpenses` | 17848 | 5873/852 (T3) | 41676.33 | 5876/852 (T2) | 23828.33 | 133.51% |
| Cooper Gibson | 2025 | IS | 7983 | `administrativeExpenses` | 41676.33 | 5876/853 (T2) | 53647 | 5877/853 (T1a) | 11970.669999999998 | 28.72% |
| Cooper Gibson | 2025 | IS | 7983 | `costOfSales` | 205301 | 5873/852 (T3) | 166074 | 5876/852 (T2) | 39227 | 19.11% |
| Cooper Gibson | 2025 | IS | 7983 | `costOfSales` | 166074 | 5876/853 (T2) | 166054 | 5877/853 (T1a) | 20 | 0.01% |
| Cooper Gibson | 2025 | IS | 7983 | `directorsRemuneration` | 37004 | 5873/852 (T3) | 24000 | 5876/852 (T2) | 13004 | 35.14% |
| Cooper Gibson | 2025 | IS | 7983 | `directorsRemuneration` | 24000 | 5876/853 (T2) | 37004 | 5877/853 (T1a) | 13004 | 54.18% |
| Cooper Gibson | 2025 | IS | 7983 | `grossProfit` | 235772 | 5873/852 (T3) | 274998.5 | 5876/852 (T2) | 39226.5 | 16.64% |
| Cooper Gibson | 2025 | IS | 7983 | `grossProfit` | 274998.5 | 5876/853 (T2) | 275019 | 5877/853 (T1a) | 20.5 | 0.01% |
| Cooper Gibson | 2025 | IS | 7983 | `interestReceivable` | 805.49 | 5876/853 (T2) | 3448 | 5877/853 (T1a) | 2642.51 | 328.06% |
| Cooper Gibson | 2025 | IS | 7983 | `netProfit` | 234147.66 | 5876/853 (T2) | 169165 | 5877/853 (T1a) | 64982.66 | 27.75% |
| Cooper Gibson | 2025 | IS | 7983 | `operatingProfit` | 221372 | 5873/852 (T3) | 233322.17 | 5876/852 (T2) | 11950.170000000013 | 5.40% |
| Cooper Gibson | 2025 | IS | 7983 | `operatingProfit` | 233322.17 | 5876/853 (T2) | 221372 | 5877/853 (T1a) | 11950.170000000013 | 5.12% |
| Cooper Gibson | 2025 | IS | 7983 | `overheadsBreakdown.accountancy_bookkeeping` | 1623 | 5876/853 (T2) | 2423 | 5877/853 (T1a) | 800 | 49.29% |
| Cooper Gibson | 2025 | IS | 7983 | `overheadsBreakdown.advertising_marketing` | 2702.5 | 5876/853 (T2) | 2703 | 5877/853 (T1a) | 0.5 | 0.02% |
| Cooper Gibson | 2025 | IS | 7983 | `overheadsBreakdown.computer_costs` | 2259.55 | 5876/853 (T2) | 2488 | 5877/853 (T1a) | 228.44999999999982 | 10.11% |
| Cooper Gibson | 2025 | IS | 7983 | `overheadsBreakdown.other_overheads` | 2157.87 | 5876/853 (T2) | -1284 | 5877/853 (T1a) | 3441.87 | 159.50% |
| Cooper Gibson | 2025 | IS | 7983 | `overheadsBreakdown.printing_stationery` | 5.35 | 5876/853 (T2) | 5 | 5877/853 (T1a) | 0.34999999999999964 | 6.54% |
| Cooper Gibson | 2025 | IS | 7983 | `overheadsBreakdown.professional_fees` | 4682.55 | 5876/853 (T2) | 4083 | 5877/853 (T1a) | 599.5500000000002 | 12.80% |
| Cooper Gibson | 2025 | IS | 7983 | `overheadsBreakdown.repairs_maintenance` | 702.54 | 5876/853 (T2) | 770 | 5877/853 (T1a) | 67.46000000000004 | 9.60% |
| Cooper Gibson | 2025 | IS | 7983 | `overheadsBreakdown.telecommunications` | 1223.15 | 5876/853 (T2) | 1254 | 5877/853 (T1a) | 30.84999999999991 | 2.52% |
| Cooper Gibson | 2025 | IS | 7983 | `overheadsBreakdown.travel_subsistence` | 1001.19 | 5876/853 (T2) | 1154 | 5877/853 (T1a) | 152.80999999999995 | 15.26% |
| Cooper Gibson | 2025 | IS | 7983 | `profitBeforeTax` | 221372 | 5873/852 (T3) | 234147.66 | 5876/852 (T2) | 12775.660000000003 | 5.77% |
| Cooper Gibson | 2025 | IS | 7983 | `profitBeforeTax` | 234147.66 | 5876/853 (T2) | 221372 | 5877/853 (T1a) | 12775.660000000003 | 5.46% |
| Cooper Gibson | 2025 | IS | 7983 | `revenue` | 441073 | 5873/852 (T3) | 441072.5 | 5876/852 (T2) | 0.5 | 0.00% |
| Cooper Gibson | 2025 | IS | 7983 | `revenue` | 441072.5 | 5876/853 (T2) | 441073 | 5877/853 (T1a) | 0.5 | 0.00% |
| Innova Design Group Limited | 2022 | IS | 7977 | `costOfSalesBreakdown.other_direct_costs` | 1582248 | 5862/1674 (T1b) | 980718 | 5863/1674 (T1b) | 601530 | 38.02% |
| Innova Design Group Limited | 2022 | IS | 7977 | `overheadsBreakdown.other_overheads` | 18121 | 5862/1674 (T1b) | 33723 | 5863/1674 (T1b) | 15602 | 86.10% |
| Innova Design Group Limited | 2022 | IS | 7977 | `staffCosts` | 506800 | 5862/1674 (T1b) | 538301 | 5863/1674 (T1b) | 31501 | 6.22% |
| Innova Design Group Limited | 2023 | BS | 7976 | `hirePurchaseLongTerm` | 27720 | 5861/1673 (T1a) | 86343 | 5862/1673 (T1b) | 58623 | 211.48% |
| Innova Design Group Limited | 2023 | BS | 7976 | `tradeDebtors` | 470739 | 5861/1673 (T1a) | 553354 | 5862/1673 (T1b) | 82615 | 17.55% |
| Innova Design Group Limited | 2023 | IS | 7976 | `costOfSalesBreakdown.direct_materials` | 1083880 | 5861/1673 (T1a) | 620875 | 5862/1673 (T1b) | 463005 | 42.72% |
| Innova Design Group Limited | 2023 | IS | 7976 | `costOfSalesBreakdown.other_direct_costs` | 58319 | 5861/1673 (T1a) | 723073 | 5862/1673 (T1b) | 664754 | 1139.86% |
| Innova Design Group Limited | 2023 | IS | 7976 | `costOfSalesBreakdown.other_direct_costs` | 723073 | 5862/1680 (T1b) | 1343948 | 5869/1680 (T1b) | 620875 | 85.87% |
| Innova Design Group Limited | 2023 | IS | 7976 | `overheadsBreakdown.other_overheads` | 22243 | 5861/1673 (T1a) | 14534 | 5862/1673 (T1b) | 7709 | 34.66% |
| Innova Design Group Limited | 2023 | IS | 7976 | `overheadsBreakdown.other_overheads` | 14534 | 5862/1680 (T1b) | 14472 | 5869/1680 (T1b) | 62 | 0.43% |
| Innova Design Group Limited | 2023 | IS | 7976 | `staffCosts` | 547148 | 5861/1673 (T1a) | 498233 | 5862/1673 (T1b) | 48915 | 8.94% |
| Innova Design Group Limited | 2023 | IS | 7976 | `staffCosts` | 498233 | 5862/1680 (T1b) | 547038 | 5869/1680 (T1b) | 48805 | 9.80% |
| Innova Design Group Limited | 2024 | BS | 7973 | `otherDebtors` | 1564 | 5861/1679 (T1a) | 850 | 5868/1679 (T1a) | 714 | 45.65% |
| Innova Design Group Limited | 2024 | IS | 7973 | `costOfSalesBreakdown.other_direct_costs` | 99354 | 5857/1672 (T1a) | 88185 | 5861/1672 (T1a) | 11169 | 11.24% |
| Innova Design Group Limited | 2024 | IS | 7973 | `overheadsBreakdown.other_overheads` | 13718 | 5857/1672 (T1a) | 44937 | 5861/1672 (T1a) | 31219 | 227.58% |
| Innova Design Group Limited | 2024 | IS | 7973 | `overheadsBreakdown.staff_training_recruitment` | 10901 | 5857/1672 (T1a) | 13373 | 5861/1672 (T1a) | 2472 | 22.68% |
| Innova Design Group Limited | 2024 | IS | 7973 | `staffCosts` | 556781 | 5857/1672 (T1a) | 570154 | 5861/1672 (T1a) | 13373 | 2.40% |
| Innova Design Group Limited | 2025 | IS | 7974 | `overheadsBreakdown.other_overheads` | 24042 | 5857/1678 (T1a) | 24084 | 5867/1678 (T1a) | 42 | 0.17% |
| Innova Design Group Limited | 2025 | IS | 7974 | `overheadsBreakdown.professional_fees` | 16027 | 5857/1678 (T1a) | 12885 | 5867/1678 (T1a) | 3142 | 19.60% |
| Innova Design Group Limited | 2025 | IS | 7974 | `staffCosts` | 712676 | 5857/1678 (T1a) | 716147 | 5867/1678 (T1a) | 3471 | 0.49% |
| Thor-CON (Midland Air Conditioning) | 2023 | BS | 7948 | `plantMachinery` | 35376 | 5830/1759 (T1a) | 45607 | 5831/1759 (T1a) | 10231 | 28.92% |
| Thor-CON (Midland Air Conditioning) | 2023 | BS | 7948 | `retainedEarnings` | 164400 | 5830/1759 (T1a) | 168834 | 5831/1759 (T1a) | 4434 | 2.70% |
| Thor-CON (Midland Air Conditioning) | 2023 | BS | 7948 | `totalEquity` | 164500 | 5830/1759 (T1a) | 168934 | 5831/1759 (T1a) | 4434 | 2.70% |
| Thor-CON (Midland Air Conditioning) | 2023 | BS | 7948 | `totalLongTermLiabilities` | 49478 | 5830/1759 (T1a) | 45044 | 5831/1759 (T1a) | 4434 | 8.96% |
| Thor-CON (Midland Air Conditioning) | 2023 | IS | 7948 | `corporationTax` | 36214 | 5830/1759 (T1a) | 31780 | 5831/1759 (T1a) | 4434 | 12.24% |
| Thor-CON (Midland Air Conditioning) | 2023 | IS | 7948 | `netProfit` | 132092 | 5830/1759 (T1a) | 136526 | 5831/1759 (T1a) | 4434 | 3.36% |
| Thor-CON (Midland Air Conditioning) | 2023 | IS | 7948 | `overheadsBreakdown.other_overheads` | 15403 | 5830/1759 (T1a) | 1460 | 5831/1759 (T1a) | 13943 | 90.52% |

---

## S3 — Counts and Accuracy Rate by Tier Pair

Total write events (all classifications): **1425**

- FIRST_WRITE: 817
- AGREE: 383
- GRANULARITY: 7
- CONFLICT: 76
- ENRICHED: 105
- ERASED: 37
- Sum check: 817 + 383 + 7 + 76 + 105 + 37 = 1425 (expected 1425)

Accuracy rate = **AGREE / (AGREE + CONFLICT)**. Its sample size is the denominator. GRANULARITY, ENRICHED, FIRST_WRITE and ERASED are excluded from this rate.

| Tier pair | AGREE | CONFLICT | GRANULARITY | ENRICHED | ERASED | Accuracy rate (AGREE / sample) | Sample size |
|---|---|---|---|---|---|---|---|
| T1a → T1a | 218 | 15 | 4 | 10 | 2 | 93.56% (218/233) | 233 |
| T1a → T1b | 44 | 6 | 0 | 1 | 16 | 88.00% (44/50) | 50 |
| T1b → T1b | 90 | 6 | 2 | 7 | 4 | 93.75% (90/96) | 96 |
| T2 → T1a | 2 | 28 | 0 | 15 | 9 | 6.67% (2/30) | 30 |
| T3 → T1a | 28 | 9 | 1 | 46 | 0 | 75.68% (28/37) | 37 |
| T3 → T2 | 1 | 12 | 0 | 26 | 6 | 7.69% (1/13) | 13 |

---

## S4 — HIGHER TIER DEGRADED BY LOWER TIER

ERASED rows are listed first, followed by CONFLICT rows. Each previous document tier outranks the replacing document tier (T1a > T1b > T2 > T3 > INT > n/a).

| Class | Company | FY | Stmt | Period | Field | High-tier value | High-tier doc | Lower-tier value | Lower-tier doc |
|---|---|---|---|---|---|---|---|---|---|
| ERASED | Innova Design Group Limited | 2023 | BS | 7976 | `accruals` | 37211 | 5861 (T1a) | (null) | 5862 (T1b) |
| ERASED | Innova Design Group Limited | 2023 | BS | 7976 | `amountsOwedToDirectors` | 24607 | 5861 (T1a) | (null) | 5862 (T1b) |
| ERASED | Innova Design Group Limited | 2023 | BS | 7976 | `bankLoansLongTerm` | 17500 | 5861 (T1a) | (null) | 5862 (T1b) |
| ERASED | Innova Design Group Limited | 2023 | BS | 7976 | `bankLoansOverdraftCurrent` | 10000 | 5861 (T1a) | (null) | 5862 (T1b) |
| ERASED | Innova Design Group Limited | 2023 | BS | 7976 | `computerEquipment` | 5934 | 5861 (T1a) | (null) | 5862 (T1b) |
| ERASED | Innova Design Group Limited | 2023 | BS | 7976 | `corporationTaxDue` | 22101 | 5861 (T1a) | (null) | 5862 (T1b) |
| ERASED | Innova Design Group Limited | 2023 | BS | 7976 | `hirePurchaseCurrent` | 115840 | 5861 (T1a) | (null) | 5862 (T1b) |
| ERASED | Innova Design Group Limited | 2023 | BS | 7976 | `otherCreditors` | 2634 | 5861 (T1a) | (null) | 5862 (T1b) |
| ERASED | Innova Design Group Limited | 2023 | BS | 7976 | `otherDebtors` | 850 | 5861 (T1a) | (null) | 5862 (T1b) |
| ERASED | Innova Design Group Limited | 2023 | BS | 7976 | `otherLongTermDebt` | 41123 | 5861 (T1a) | (null) | 5862 (T1b) |
| ERASED | Innova Design Group Limited | 2023 | BS | 7976 | `plantMachinery` | 231540 | 5861 (T1a) | (null) | 5862 (T1b) |
| ERASED | Innova Design Group Limited | 2023 | BS | 7976 | `prepayments` | 81765 | 5861 (T1a) | (null) | 5862 (T1b) |
| ERASED | Innova Design Group Limited | 2023 | BS | 7976 | `taxationSocialSecurity` | 36792 | 5861 (T1a) | (null) | 5862 (T1b) |
| ERASED | Innova Design Group Limited | 2023 | BS | 7976 | `tradeCreditors` | 291986 | 5861 (T1a) | (null) | 5862 (T1b) |
| ERASED | Innova Design Group Limited | 2023 | BS | 7976 | `vatPayable` | 165001 | 5861 (T1a) | (null) | 5862 (T1b) |
| ERASED | Innova Design Group Limited | 2023 | IS | 7976 | `dividendsPaid` | 60000 | 5861 (T1a) | (null) | 5862 (T1b) |
| CONFLICT | Innova Design Group Limited | 2023 | BS | 7976 | `hirePurchaseLongTerm` | 27720 | 5861 (T1a) | 86343 | 5862 (T1b) |
| CONFLICT | Innova Design Group Limited | 2023 | BS | 7976 | `tradeDebtors` | 470739 | 5861 (T1a) | 553354 | 5862 (T1b) |
| CONFLICT | Innova Design Group Limited | 2023 | IS | 7976 | `costOfSalesBreakdown.direct_materials` | 1083880 | 5861 (T1a) | 620875 | 5862 (T1b) |
| CONFLICT | Innova Design Group Limited | 2023 | IS | 7976 | `costOfSalesBreakdown.other_direct_costs` | 58319 | 5861 (T1a) | 723073 | 5862 (T1b) |
| CONFLICT | Innova Design Group Limited | 2023 | IS | 7976 | `overheadsBreakdown.other_overheads` | 22243 | 5861 (T1a) | 14534 | 5862 (T1b) |
| CONFLICT | Innova Design Group Limited | 2023 | IS | 7976 | `staffCosts` | 547148 | 5861 (T1a) | 498233 | 5862 (T1b) |

---

## S5 — All ERASED Rows

Grouped by company and fiscal year; every row where a later document replaced a non-null value with null.

### Cooper Gibson

#### FY 2025

| Stmt | Period | Field | Erased value | Previous doc (tier) | Erasing doc (tier) |
|---|---|---|---|---|---|
| BS | 7983 | `amountsOwedToDirectors` | -180194.29 | 5876 (T2) | 5877 (T1a) |
| BS | 7983 | `shareCapital` | 2 | 5876 (T2) | 5877 (T1a) |
| BS | 7983 | `totalLongTermLiabilities` | 0 | 5873 (T3) | 5876 (T2) |
| BS | 7983 | `tradeCreditors` | 2030 | 5876 (T2) | 5877 (T1a) |
| BS | 7983 | `tradeDebtors` | 11610 | 5876 (T2) | 5877 (T1a) |
| BS | 7983 | `vatPayable` | 13460.64 | 5876 (T2) | 5877 (T1a) |
| IS | 7983 | `costOfSalesBreakdown.other_direct_costs` | 2403 | 5876 (T2) | 5877 (T1a) |
| IS | 7983 | `depreciationAmortisation` | 299 | 5873 (T3) | 5876 (T2) |
| IS | 7983 | `dividendsPaid` | 85000 | 5876 (T2) | 5877 (T1a) |
| IS | 7983 | `otherOperatingIncome` | 3448 | 5873 (T3) | 5876 (T2) |
| IS | 7983 | `overheadsBreakdown.depreciation` | 299 | 5873 (T3) | 5876 (T2) |
| IS | 7983 | `overheadsBreakdown.directors_salaries` | 12570 | 5873 (T3) | 5876 (T2) |
| IS | 7983 | `overheadsBreakdown.employers_national_insurance` | 434 | 5873 (T3) | 5876 (T2) |
| IS | 7983 | `overheadsBreakdown.it_support_hosting` | 60 | 5876 (T2) | 5877 (T1a) |
| IS | 7983 | `overheadsBreakdown.software_subscriptions` | 1258.63 | 5876 (T2) | 5877 (T1a) |
### Innova Design Group Limited

#### FY 2022

| Stmt | Period | Field | Erased value | Previous doc (tier) | Erasing doc (tier) |
|---|---|---|---|---|---|
| IS | 7977 | `interestReceivable` | 0 | 5862 (T1b) | 5863 (T1b) |
| IS | 7977 | `overheadsBreakdown.postage_courier` | 17417 | 5862 (T1b) | 5863 (T1b) |
#### FY 2023

| Stmt | Period | Field | Erased value | Previous doc (tier) | Erasing doc (tier) |
|---|---|---|---|---|---|
| BS | 7976 | `accruals` | 37211 | 5861 (T1a) | 5862 (T1b) |
| BS | 7976 | `amountsOwedToDirectors` | 24607 | 5861 (T1a) | 5862 (T1b) |
| BS | 7976 | `bankLoansLongTerm` | 17500 | 5861 (T1a) | 5862 (T1b) |
| BS | 7976 | `bankLoansOverdraftCurrent` | 10000 | 5861 (T1a) | 5862 (T1b) |
| BS | 7976 | `computerEquipment` | 5934 | 5861 (T1a) | 5862 (T1b) |
| BS | 7976 | `corporationTaxDue` | 22101 | 5861 (T1a) | 5862 (T1b) |
| BS | 7976 | `hirePurchaseCurrent` | 115840 | 5861 (T1a) | 5862 (T1b) |
| BS | 7976 | `otherCreditors` | 2634 | 5861 (T1a) | 5862 (T1b) |
| BS | 7976 | `otherDebtors` | 850 | 5861 (T1a) | 5862 (T1b) |
| BS | 7976 | `otherLongTermDebt` | 41123 | 5861 (T1a) | 5862 (T1b) |
| BS | 7976 | `plantMachinery` | 231540 | 5861 (T1a) | 5862 (T1b) |
| BS | 7976 | `prepayments` | 81765 | 5861 (T1a) | 5862 (T1b) |
| BS | 7976 | `taxationSocialSecurity` | 36792 | 5861 (T1a) | 5862 (T1b) |
| BS | 7976 | `tradeCreditors` | 291986 | 5861 (T1a) | 5862 (T1b) |
| BS | 7976 | `tradeDebtors` | 553354 | 5862 (T1b) | 5869 (T1b) |
| BS | 7976 | `vatPayable` | 165001 | 5861 (T1a) | 5862 (T1b) |
| IS | 7976 | `costOfSalesBreakdown.direct_materials` | 620875 | 5862 (T1b) | 5869 (T1b) |
| IS | 7976 | `dividendsPaid` | 60000 | 5861 (T1a) | 5862 (T1b) |
### Thor-CON (Midland Air Conditioning)

#### FY 2023

| Stmt | Period | Field | Erased value | Previous doc (tier) | Erasing doc (tier) |
|---|---|---|---|---|---|
| BS | 7948 | `deferredTaxation` | 4434 | 5830 (T1a) | 5831 (T1a) |
| BS | 7948 | `leaseholdProperty` | 10231 | 5830 (T1a) | 5831 (T1a) |
