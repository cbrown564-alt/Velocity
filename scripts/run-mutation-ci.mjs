#!/usr/bin/env node
/**
 * CI entry for Stryker mutation testing.
 *
 * Diff-scopes mutate targets against MUTATION_BASE_SHA / PR base when possible
 * so a one-file core change does not re-run the full ~hour gated campaign.
 * Full campaign: mutation config/runner changes, MUTATION_FULL=1, or too many
 * eligible files. See scripts/lib/mutationScope.mjs and docs/arch_08_testing.md.
 */
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStrykerConfig, resolveMutationPlan, strykerArgsForPlan } from './lib/mutationScope.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const planOnly = process.argv.includes('--plan');
const concurrency = Number(process.env.MUTATION_CONCURRENCY || 2);

function resolveBaseSha() {
  if (process.env.MUTATION_BASE_SHA) return process.env.MUTATION_BASE_SHA;
  if (process.env.MUTATION_BASE_REF) return process.env.MUTATION_BASE_REF;
  if (process.env.GITHUB_BASE_REF) return `origin/${process.env.GITHUB_BASE_REF}`;
  try {
    execSync('git rev-parse --verify origin/main', { cwd: ROOT, stdio: 'ignore' });
    return 'origin/main';
  } catch {
    return 'HEAD^';
  }
}

function changedFilesSince(base) {
  try {
    let range = base;
    // Prefer three-dot merge-base diff when base is a ref tip.
    try {
      const mergeBase = execSync(`git merge-base HEAD ${base}`, {
        cwd: ROOT,
        encoding: 'utf8',
      }).trim();
      range = `${mergeBase}...HEAD`;
    } catch {
      range = `${base}...HEAD`;
    }
    const output = execSync(`git diff --name-only --diff-filter=ACMRTUXB ${range}`, {
      cwd: ROOT,
      encoding: 'utf8',
    });
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (err) {
    console.error('mutation-ci: failed to list changed files vs', base);
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

function writeGithubOutput(plan) {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  const lines = [
    `run=${plan.run ? 'true' : 'false'}`,
    `mode=${plan.mode}`,
    `reason=${plan.reason.replace(/\n/g, ' ')}`,
    `mutate_files=${plan.mutateFiles.join(',')}`,
  ];
  fs.appendFileSync(out, `${lines.join('\n')}\n`);
}

function main() {
  const base = resolveBaseSha();
  const forceFull = process.env.MUTATION_FULL === '1' || process.env.MUTATION_FULL === 'true';
  const changedFiles = forceFull ? [] : changedFilesSince(base);
  const { mutate } = loadStrykerConfig(ROOT);
  const plan = resolveMutationPlan({
    changedFiles,
    mutateGlobs: mutate,
    forceFull,
  });

  console.log(`mutation-ci: base=${base}`);
  console.log(`mutation-ci: mode=${plan.mode} run=${plan.run}`);
  console.log(`mutation-ci: ${plan.reason}`);
  if (plan.mutateFiles.length > 0) {
    console.log(`mutation-ci: eligible changed files:\n  - ${plan.mutateFiles.join('\n  - ')}`);
  }

  writeGithubOutput(plan);

  if (planOnly) {
    process.exit(0);
  }

  if (!plan.run) {
    console.log('mutation-ci: skipping Stryker (no mutate-eligible production changes)');
    process.exit(0);
  }

  const args = strykerArgsForPlan(plan, { concurrency });
  console.log(`mutation-ci: npx stryker ${args.join(' ')}`);
  execFileSync('npx', ['stryker', ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
}

main();
