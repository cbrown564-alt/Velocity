// Run from repository root: node docs/assets/researcher-exploration/verify.mjs
// DOM/state checks for an isolated concept. This does not verify browser layout.
import { Window } from 'happy-dom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('./concept.html', import.meta.url), 'utf8');
const window = new Window();
window.document.body.innerHTML = source.replace(/<script>[\s\S]*?<\/script>/g, '');
window.eval(source.match(/<script>([\s\S]*?)<\/script>/)[1]);
const document = window.document;
const click = (selector) => {
  const element = document.querySelector(selector);
  assert.ok(element, selector);
  element.click();
};
const content = () => document.querySelector('#v-main').textContent;

assert.match(content(), /six-point rise/);
click('[data-action="check"]');
assert.equal(document.querySelectorAll('#v-main tbody tr').length, 3);
click('[data-action="edit"]');
document.querySelector('#v-headline').value = 'My interpretation <script>bad()</script>';
click('[data-action="save-edit"]');
click('[data-action="keep"]');
assert.match(content(), /My interpretation <script>bad/);
assert.equal(document.querySelectorAll('#v-main script').length, 0);
click('[data-view="changes"]');
click('[data-action="stage"]');
click('[data-action="cancel-stage"]');
click('[data-view="answer"]');
assert.doesNotMatch(content(), /Evidence changed/);
click('[data-view="changes"]');
click('[data-action="stage"]');
click('[data-action="apply"]');
click('[data-view="answer"]');
assert.match(content(), /Evidence changed/);
assert.match(content(), /My interpretation/);
click('[data-action="investigate"]');
click('[data-action="keep"]');
assert.match(content(), /My interpretation/);
assert.doesNotMatch(content(), /Evidence changed/);
click('[data-action="remove"]');
assert.match(content(), /No finding selected/);
click('[data-action="reset"]');
assert.equal(document.querySelector('#v-answer-count').textContent, '0');
click('[data-question="trust"]');
click('[data-action="mark-trust"]');
click('[data-question="action"]');
assert.match(content(), /counterfactual/);
click('[data-question="trust"]');
assert.match(content(), /Recorded · keep separate/);
click('[data-signal="wording"]');
click('#v-signal-decide');
assert.match(document.querySelector('#v-signal-state').textContent, /Decision recorded/);
click('[data-citation="mix"]');
assert.match(document.querySelector('#v-document-evidence').textContent, /20% → 50%/);
click('#v-document-edit');
document.querySelector('#v-document-text').value = 'Changed judgement';
click('#v-document-save');
assert.equal(document.querySelector('#v-document-conclusion').textContent, 'Changed judgement');

assert.equal(Math.round(((0.2 * 960 + 0.4 * 240) / 1200) * 100), 24);
assert.equal(Math.round(((0.2 * 600 + 0.4 * 600) / 1200) * 100), 30);
assert.equal(Math.round((0.2 * 0.7 + 0.4 * 0.3) * 100), 26);
assert.equal(Math.round((0.2 * 0.6 + 0.4 * 0.4) * 100), 28);
console.log('PASS: concept interactions, preserved edits, change review and fixture arithmetic. DOM checks only.');
