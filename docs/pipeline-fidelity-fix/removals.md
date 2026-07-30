# Pipeline fidelity fix: removals

Operational checklist. Tick on landing, note the slice and V-check that removed
it. Nothing here is removed outside its slice.

- [ ] Tier suppression logic in the reconciled read (getReconciledFinancials
  path): replaced by trust states, nothing admissible silently dropped.
  Slice 5. #299, #328.
- [ ] abs() and sign normalisation on director and related-party balances,
  every occurrence on the write path, PLUS the inverted sign-convention text
  shipped verbatim in the reconciled expert input. Signed values on directional
  fields instead. Slices 2 and 7. #295.
- [ ] Auto-accept remnants in the adjustment path; new adjustments created
  suggested only, enforced by DB constraint; applied only on explicit
  acceptance. Slice 8. #322, #261.
- [ ] Blind "N months of costs" working capital deduction in the bridge;
  replaced by explicit peg-vs-actual calculation with method and inputs
  displayed. Slice 9. #324.
- [ ] Independently stored enterprise value on deal models; EV computed from
  the model version, never stored as an input; two-EV state unrepresentable.
  Slice 9. #323.
