import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const indexCss = readFileSync(resolve(__dirname, 'index.css'), 'utf8');

const LEGACY_RESEARCH_DESK_TOKENS = [
  '--color-paper',
  '--color-ink',
  '--color-terracotta',
  '--color-parchment',
] as const;

const VAR_HEX_FALLBACK = /var\(--[^,)]+,\s*#[0-9a-fA-F]{3,8}\)/;
const HARDCODED_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RGBA_BLACK = /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,/;
const GRAY_TOKEN = /--gray-|--color-charcoal/;
const RAW_TAILWIND_PALETTE =
  /\b(?:bg|text|border|ring|fill|stroke|divide|from|to|via|hover:bg|hover:text|hover:border|focus:border|focus:ring|hover:stroke|hover:fill)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?(?:\/[\d.]+)?\b/;

function walkSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      walkSourceFiles(fullPath, files);
      continue;
    }
    if (/\.(tsx?|css|module\.css)$/.test(entry) && !entry.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function walkComponentCssFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      walkComponentCssFiles(fullPath, files);
      continue;
    }
    if (/\.(css|module\.css)$/.test(entry) && entry !== 'index.css') {
      files.push(fullPath);
    }
  }
  return files;
}

function rootBlock(css: string): string {
  const match = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  expect(match, ':root block should exist in index.css').not.toBeNull();
  return match![1];
}

describe('index.css semantic tokens (STAB-DS-1)', () => {
  const root = rootBlock(indexCss);

  it('defines tertiary text and hover surface tokens', () => {
    expect(root).toMatch(/--text-tertiary:\s*var\(--muted-foreground\)/);
    expect(root).toMatch(/--bg-hover:\s*var\(--secondary\)/);
  });

  it('defines functional color aliases for success, warning, and error', () => {
    expect(root).toMatch(/--color-success:/);
    expect(root).toMatch(/--color-warning:\s*var\(--status-warning-text\)/);
    expect(root).toMatch(/--color-error:/);
  });

  it('defines status text and background pairs', () => {
    for (const status of ['error', 'warning', 'success'] as const) {
      expect(root).toMatch(new RegExp(`--status-${status}-bg:`));
      expect(root).toMatch(new RegExp(`--status-${status}-text:`));
    }
  });

  it('does not define deprecated Research Desk color tokens', () => {
    for (const token of LEGACY_RESEARCH_DESK_TOKENS) {
      expect(indexCss).not.toContain(`${token}:`);
    }
  });

  it('has no Research Desk legacy tokens in active source', () => {
    const srcDir = resolve(__dirname);
    const violations: string[] = [];

    for (const file of walkSourceFiles(srcDir)) {
      const content = readFileSync(file, 'utf8');
      for (const token of LEGACY_RESEARCH_DESK_TOKENS) {
        if (content.includes(token)) {
          violations.push(`${file.replace(srcDir + '/', '')}: ${token}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('has no hex fallbacks or hardcoded hex in component CSS', () => {
    const srcDir = resolve(__dirname);
    const violations: string[] = [];

    for (const file of walkComponentCssFiles(srcDir)) {
      const content = readFileSync(file, 'utf8');
      if (VAR_HEX_FALLBACK.test(content)) {
        violations.push(`${file.replace(srcDir + '/', '')}: var(--token, #hex) fallback`);
      }
      if (HARDCODED_HEX.test(content)) {
        violations.push(`${file.replace(srcDir + '/', '')}: hardcoded hex color`);
      }
      if (RGBA_BLACK.test(content)) {
        violations.push(`${file.replace(srcDir + '/', '')}: rgba(0,0,0,…)`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('has no rgba(0,0,0,…) in TSX/TS source outside theme definitions', () => {
    const srcDir = resolve(__dirname);
    const violations: string[] = [];

    for (const file of walkSourceFiles(srcDir)) {
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
      if (file.includes('theme/themes.ts')) continue; // theme color definitions are expected
      if (!/\.(tsx|ts)$/.test(file)) continue;
      const content = readFileSync(file, 'utf8');
      if (RGBA_BLACK.test(content)) {
        violations.push(`${file.replace(srcDir + '/', '')}: rgba(0,0,0,…)`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('has no gray families or raw Tailwind palette utilities in active source', () => {
    const srcDir = resolve(__dirname);
    const violations: string[] = [];

    for (const file of walkSourceFiles(srcDir)) {
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) {
        continue;
      }
      const content = readFileSync(file, 'utf8');
      if (GRAY_TOKEN.test(content)) {
        violations.push(`${file.replace(srcDir + '/', '')}: gray or charcoal token`);
      }
      if (/\.(tsx|ts)$/.test(file) && RAW_TAILWIND_PALETTE.test(content)) {
        violations.push(`${file.replace(srcDir + '/', '')}: raw Tailwind palette utility`);
      }
    }

    expect(violations).toEqual([]);
  });
});
