# Pipeline fidelity fix: removals

Operational checklist. Tick on landing, note the slice and V-check that removed
it. Nothing here is removed outside its slice.

- [ ] Tier suppression logic in the reconciled read (getReconciledFinancials
  path): replaced by trust states, nothing admissible silently dropped.
  Slice 5. #299, #328.
- [ ] CORRECTED 31 July 2026. There is NO abs() applied to director or
  related-party balances on the write path at all, and the field LABELS are not
  inverted: amountsOwedByDirectors is correctly described as an asset that adds
  to equity. The single defect is the INSTRUCTION TEXT at
  server/services/reconciled-financials.service.ts lines 253 and 255, "Both positive
  and negative stored values represent this liability, use abs(value)", which
  ships verbatim to the experts and destroys direction. Remove the abs
  instruction, pass signed values, and let a negative in owedBy resolve to
  owedTo. No labels are flipped. Direction is a per-date fact, not a per-company
  constant: tc89's DLA genuinely flips sign between FY2024 and May 2026, and
  Cooper Gibson's director loan is an asset of £149,587.37 owed BY the directors.
  Instruction text: slice 7. Directional field semantics in canonical: slices 2
  and 3. #295.
- [ ] Math.abs(depreciation) inside the EBITDA calculation, two sites:
  server/services/financial-data.service.ts line 827 and
  server/services/reconciled-financials.service.ts line 174. Both are paired
  with an isNaN coercion to 0, so a year with absent or wrong-signed D&A silently
  computes as though D&A were zero and an incomplete basis presents as complete.
  Store signed, cast-check, flag as an anomaly, mark the year BASIS-INCOMPLETE.
  Never absolutise. Slice 6. #331, #320.
- [ ] Auto-accept remnants in the adjustment path; new adjustments created
  suggested only, enforced by DB constraint; applied only on explicit
  acceptance. Slice 8. #322, #261.
- [ ] Blind "N months of costs" working capital deduction in the bridge;
  replaced by explicit peg-vs-actual calculation with method and inputs
  displayed. Slice 9. #324.
- [ ] Independently stored enterprise value on deal models; EV computed from
  the model version, never stored as an input; two-EV state unrepresentable.
  Slice 9. #323.
