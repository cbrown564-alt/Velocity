#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const filePath = join(process.cwd(), 'src/core/sql/queryBuilder.ts');
const content = readFileSync(filePath, 'utf8');

const forbiddenPatterns = [
  { pattern: /\bconsole\./g, label: 'console usage' },
  { pattern: /\bwindow\./g, label: 'window usage' },
  { pattern: /\bdocument\./g, label: 'document usage' },
  { pattern: /\blocalStorage\b/g, label: 'localStorage usage' },
  { pattern: /\bfetch\(/g, label: 'fetch usage' },
  { pattern: /\bnew\s+Worker\b/g, label: 'Worker usage' },
  { pattern: /\bDate\.now\(/g, label: 'Date.now usage' },
  { pattern: /\bMath\.random\(/g, label: 'Math.random usage' },
  { pattern: /\bprocess\.env\b/g, label: 'process.env usage' },
];

const violations = [];
for (const { pattern, label } of forbiddenPatterns) {
  const match = content.match(pattern);
  if (match && match.length > 0) {
    violations.push(`${label} (${match.length})`);
  }
}

if (violations.length > 0) {
  console.error('queryBuilder purity check failed:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('queryBuilder purity check passed.');
