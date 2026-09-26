// Isolated design experiment checks. No browser/layout or production validation implied.
import { Window } from 'happy-dom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('./survey-laboratory.html', import.meta.url), 'utf8');
const w = new Window();
w.document.body.innerHTML = source.replace(/<script>[\s\S]*?<\/script>/g, '');
w.eval(source.match(/<script>([\s\S]*?)<\/script>/)[1]);
const q = s => { const e = w.document.querySelector(s); assert.ok(e, s); return e; };
const click = s => q(s).click();
const text = s => q(s).textContent;
const change = (s, value) => { q(s).value = value; q(s).dispatchEvent(new w.Event('change', { bubbles: true })); };
assert.equal(w.document.querySelectorAll('[data-variant]').length, 6);
assert.equal(w.document.querySelectorAll('[data-variant]:not([hidden])').length, 1);
assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket/);

// Preview does not mutate, application changes only the measure base, undo restores.
assert.equal(text('#vl-prep-rate'), '46.3%');
change('#vl-role', 'dk');
assert.match(text('#vl-prep-preview'), /216 → 200/);
assert.equal(text('#vl-prep-rate'), '46.3%');
click('#vl-prep-apply');
assert.equal(text('#vl-prep-rate'), '50.0%');
assert.match(text('#vl-prep-base'), /240 records/);
assert.match(text('#vl-prep-recipe'), /code 97: Don’t know/);
click('#vl-prep-undo');
assert.equal(text('#vl-prep-rate'), '46.3%');
assert.equal(q('#vl-prep-undo').disabled, true);
// Removing a positive category updates numerator as well as denominator.
click('[data-code="5"]'); change('#vl-role', 'notasked'); click('#vl-prep-apply');
assert.equal(text('#vl-prep-rate'), (60 / 176 * 100).toFixed(1) + '%');
click('#vl-prep-undo');
// An empty valid base should be explicit, never NaN or Infinity.
for (const code of [1, 2, 3, 4, 5, 97]) {
  click(`[data-code="${code}"]`); change('#vl-role', 'notasked'); click('#vl-prep-apply');
}
assert.equal(text('#vl-prep-rate'), 'No valid base');
for (let i = 0; i < 6; i++) click('#vl-prep-undo');
assert.equal(text('#vl-prep-rate'), '46.3%');

// Inspection is not a population mutation. Adoption and clear are explicit.
click('[data-cohort="young"]');
assert.equal(text('#vl-lens-result'), '40.0%');
assert.match(text('#vl-lens-linked'), /50.0%/);
click('#vl-lens-adopt');
assert.equal(text('#vl-lens-result'), '50.0%');
assert.match(text('#vl-lens-base'), /n = 80/);
click('[data-cohort="older"]');
assert.equal(text('#vl-lens-result'), '50.0%');
click('#vl-lens-adopt'); assert.equal(text('#vl-lens-result'), '33.3%');
click('#vl-lens-reset'); assert.equal(text('#vl-lens-result'), '40.0%');

// Branch selection preserves the working analysis; uninvestigated exclusions cannot be adopted.
click('[data-branch="weighted"]');
assert.match(text('#vl-branch-working'), /\+2.5 pp/);
click('#vl-branch-adopt'); assert.match(text('#vl-branch-working'), /\+1.2 pp/);
click('[data-branch="quality"]');
assert.equal(q('#vl-branch-adopt').disabled, true);
assert.match(text('#vl-branches'), /-1.5 pp/);
assert.equal(w.document.querySelectorAll('#vl-branches tr').length, 3);
assert.match(text('#vl-branch-working'), /\+1.2 pp/);

// A new estimand is separate from existing evidence bindings.
change('#vl-measure-universe', 'all');
assert.equal(text('#vl-measure-result'), '26.7%');
assert.match(text('#vl-measure-caution'), /does not impute/);
assert.match(text('#vl-measure-impact'), /3 outputs remain bound/);
click('#vl-measure-publish');
assert.match(text('#vl-measure-impact'), /Existing trend, funnel and finding retain/);
change('#vl-measure-universe', 'aware');
assert.equal(text('#vl-measure-result'), '40.0%');

// Evidence invalidates, recomputes, and is separately reviewed. Prose survives both directions.
const prose = 'My judgement <script>must remain text</script>';
q('#vl-notebook-prose').value = prose;
change('#vl-notebook-weight', 'weighted');
assert.match(text('#vl-notebook-status'), /Out of date/);
assert.equal(text('#vl-notebook-result'), '+2.5 pp');
assert.equal(q('#vl-notebook-confirm').disabled, true);
click('#vl-notebook-run');
assert.equal(text('#vl-notebook-result'), '+1.2 pp');
assert.match(text('#vl-notebook-review'), /Review required/);
assert.equal(q('#vl-notebook-prose').value, prose);
click('#vl-notebook-confirm');
assert.match(text('#vl-notebook-review'), /Reviewed against current/);
change('#vl-notebook-weight', 'raw'); click('#vl-notebook-run');
assert.match(text('#vl-notebook-review'), /Review required/);
assert.equal(q('#vl-notebook-prose').value, prose);
assert.equal(w.document.querySelectorAll('textarea script').length, 0);

// Rehearsal cannot skip mapping; replay invalidates only the affected finding.
click('[data-stage="recipe"]'); assert.equal(q('#vl-wave-run').disabled, true);
click('[data-stage="meaning"]'); click('#vl-wave-map');
assert.match(text('#vl-wave-status'), /source Wave 5 questionnaire/);
click('[data-stage="recipe"]'); click('#vl-wave-run');
assert.match(text('#vl-wave-satisfaction'), /104 \/ 200 = 52.0%/);
assert.match(text('#vl-wave-finding'), /Evidence changed/);
assert.match(text('#vl-wave-status'), /remains on Wave 4/);
click('[data-stage="impact"]'); assert.match(text('#vl-wave-detail'), /do not depend on Q12/);
click('[data-stage="meaning"]'); assert.equal(q('#vl-wave-map').disabled, true);

// Independent arithmetic, using explicit fixture quantities rather than implementation exports.
assert.equal((100 / 216 * 100).toFixed(1), '46.3');
assert.equal(((64 / 160 - 54 / 144) * 100).toFixed(1), '2.5');
const previousWeighted = (36 * 1.5 + 18 * .75) / (72 * 1.5 + 72 * .75);
const currentWeighted = (32 * 1.5 + 32 * .75) / (64 * 1.5 + 96 * .75);
assert.equal(((currentWeighted - previousWeighted) * 100).toFixed(1), '1.2');
assert.equal(((58 / 152 - 54 / 136) * 100).toFixed(1), '-1.5');
assert.equal(104 / 200 * 100, 52);
console.log('PASS: all six laboratory journeys, reversible changes, scope, branches, semantic identity, stale review, replay and arithmetic. DOM/state checks only.');
