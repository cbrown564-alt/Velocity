# Prototype verification — not independent research review

These artifacts come from an automated QA reviewer. They must never be counted as human preferences, approvals or correction burden, or included in the blinded reviewer zip.

- Browser checks passed: independent baseline first; unfinished approval blocked; reasons required for edited findings; original wording and headline provenance preserved; evidence-bound export; changed data resets approval; invalid progress import preserves current work; mobile layout; no browser errors.
- Five adapter tests cover native chart values/notes, stale evidence rejection and reapproval, full ordinal distributions, invalid evidence/order rejection, and suppression of overlapping small-segment labels without changing the editable values.
- All five slides were rendered with LibreOffice and inspected visually. The earlier chart export also opened in Microsoft PowerPoint. Final charts use light fills, dark labels and 0–100% axes. Labels below 5% are omitted; exact values remain in the native chart and notes.
- The XML inspection flags five potential title overflows. Direct rendering shows the title wraps and all subtitles remain visible. This is a visual override of a heuristic warning, not a claim that the checker is green.
- The deck illustrates one chosen table per approved beat. Its notes retain all cited evidence and original/edited findings. It does not claim that the charts alone demonstrate every proposition in the headlines.

The automated review is deliberately named `qa-only-automated-review.json`. Actual researcher validation is still pending. Production UI, workspace persistence, other study adapters and publication-quality deck evaluation are outside this prototype.
