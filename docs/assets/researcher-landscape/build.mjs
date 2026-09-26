// Renders the researcher-landscape report to PDF.
// Usage: NODE_PATH=$(npm root -g) node docs/assets/researcher-landscape/build.mjs
// Two passes: the first locates each section's page so the contents page can list page numbers.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, mkdtempSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'landscape-'));
const out = join(here, 'quantitative-researcher-landscape-2026.pdf');

const footer = `<div style="width:100%;font-family:Inter,Arial,sans-serif;font-size:7px;color:#6f7a87;padding:0 17mm;display:flex;justify-content:space-between;">
  <span>Holding the number · How quantitative researchers work, and where Velocity fits · September 2026</span>
  <span class="pageNumber"></span></div>`;

const keys = ['sum', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', 'A'];
const markers = { sum: 'Section 00', A: 'Section A' };
for (const k of keys) if (!markers[k]) markers[k] = `Section ${k}`;

async function render(page, htmlPath, pdfPath, withFooter) {
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: withFooter, headerTemplate: '<span></span>', footerTemplate: withFooter ? footer : '<span></span>',
  });
}

function pageTexts(pdfPath) {
  const py = `import sys,json\nsys.modules['cryptography'] = None\nfrom pypdf import PdfReader\nprint(json.dumps([p.extract_text() or '' for p in PdfReader(sys.argv[1]).pages]))`;
  return JSON.parse(execFileSync('python3', ['-c', py, pdfPath], { encoding: 'utf8', maxBuffer: 64 << 20 }));
}

// Cache Google Fonts locally so headless Chromium renders the intended typefaces.
const fontDir = join(here, '.fonts');
if (!existsSync(join(fontDir, 'fonts.css'))) {
  mkdirSync(fontDir, { recursive: true });
  const cssUrl = 'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,600&family=Inter:wght@400;500;600;700&display=swap';
  let css = execFileSync('curl', ['-sfL', '-A', 'Mozilla/5.0 Chrome/140', cssUrl], { encoding: 'utf8' });
  let n = 0;
  css = css.replace(/url\((https:[^)]+)\)/g, (_, url) => {
    const name = `f${n++}.ttf`;
    execFileSync('curl', ['-sfL', '-o', join(fontDir, name), url]);
    return `url(${name})`;
  });
  writeFileSync(join(fontDir, 'fonts.css'), css);
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const page = await browser.newPage();

const source = readFileSync(join(here, 'body.html'), 'utf8');
const pass1 = join(here, '.body-pass.html');
writeFileSync(pass1, source.replace(/\{\{p:[^}]+\}\}/g, '00'));
await render(page, pass1, join(work, 'body1.pdf'), true);
const texts = pageTexts(join(work, 'body1.pdf'));
const pages = {};
for (const k of keys) {
  const norm = (t) => t.toLowerCase().replace(/\s+/g, '');
  const i = texts.findIndex((t) => norm(t).includes(norm(markers[k]) + '·'));
  pages[k] = i < 0 ? '—' : String(i + 1);
}
writeFileSync(pass1, source.replace(/\{\{p:([^}]+)\}\}/g, (_, k) => pages[k] ?? '—'));
await render(page, pass1, join(work, 'body.pdf'), true);
await render(page, join(here, 'cover.html'), join(work, 'cover.pdf'), false);
await browser.close();
rmSync(pass1);

execFileSync('python3', ['-c', `import sys
sys.modules['cryptography'] = None
from pypdf import PdfReader, PdfWriter
w = PdfWriter()
for f in sys.argv[1:3]:
    for p in PdfReader(f).pages: w.add_page(p)
w.add_metadata({'/Title': 'Holding the number: how quantitative researchers work, and where Velocity fits', '/Author': 'Velocity research', '/Subject': 'Desk research, September 2026'})
w.write(sys.argv[3])`, join(work, 'cover.pdf'), join(work, 'body.pdf'), out]);
rmSync(work, { recursive: true, force: true });
console.log('pages', pages, '->', out);
