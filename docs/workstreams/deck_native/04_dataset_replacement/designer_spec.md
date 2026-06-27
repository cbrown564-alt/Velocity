# Gate 4 Designer Spec: Dataset Replacement Review

**Status:** implemented  
**Date:** 2026-06-27  

## Contract

`buildDatasetReplacementReview` accepts slides, optional selected slide IDs, available variable sets, available variables, and optional analysis-state overrides.

It returns:

- `status: ready | warning | blocked`
- `canReplace`
- slide counts
- grouped `slideReviews`
- flat `issues`
- missing reference IDs

Replacement review differs from export readiness: missing filter/weight references warn because a user may choose to continue the wave replacement with changed assumptions, while unresolved row/column recipe references block selected slides.

## Tests

- selected-scope invalid slide does not block replacement
- selected broken slide groups row/column blockers under the slide
- filter/weight drift returns warning status
