# Demo QA Checklist

Use this checklist before publishing a refreshed demo.

## Determinism and reliability

- [ ] Contract run passes end-to-end via `npm run demo:run:first-analysis`.
- [ ] `demo:run:deck-export-complete` passes and writes `downloads/velocity-export.pptx`.
- [ ] `demo/artifacts/*/latest/steps.json` shows `status: "passed"`.
- [ ] All required screenshots were generated under `demo/artifacts/*/latest/screens`.
- [ ] Export modal screenshots are fully opaque (no mid-transition fade).
- [ ] Export proof screenshot shows `export-modal-success` state.
- [ ] No flaky selectors (all selectors rely on stable ids or known labels).

## Content quality

- [ ] Tooltip and step copy explain outcomes, not UI trivia.
- [ ] Flow reaches a meaningful "aha" moment in <= 7 interactions.
- [ ] CTA matches buyer stage (try, book, or contact).
- [ ] Role/persona variant is linked if needed.

## Privacy and redaction

- [ ] No production user names, emails, or account identifiers are visible.
- [ ] Any sensitive fields in the flow are masked in the demo tool editor.
- [ ] Contract `sensitiveSelectors` list is up to date for current screens.

## Publish readiness

- [ ] Embed renders correctly on homepage and docs page.
- [ ] Mobile viewport is checked for major layout breakage.
- [ ] Analytics destination is configured (completion + drop-off + CTA click).
- [ ] Publish link and revision date are captured in release notes.
