import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inspectPptx } from '../../scripts/report-quality/inspect-pptx.mjs';

async function writeFixturePptx() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'velocity-pptx-inspection-'));
  const pptxPath = path.join(dir, 'fixture.pptx');
  const zip = new JSZip();

  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  zip.file('ppt/presentation.xml', '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>');
  zip.file(
    'ppt/slides/slide1.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
    <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
           xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <p:cSld>
        <p:spTree>
          <p:sp>
            <p:txBody>
              <a:p>
                <a:r>
                  <a:rPr>
                    <a:latin typeface="Aptos"/>
                    <a:solidFill><a:srgbClr val="1F4E79"/></a:solidFill>
                  </a:rPr>
                  <a:t>Awareness rose by 7pts {{slide.title}}</a:t>
                </a:r>
              </a:p>
            </p:txBody>
            <a:xfrm><a:off x="0" y="0"/><a:ext cx="1500000" cy="100000"/></a:xfrm>
          </p:sp>
          <p:graphicFrame><a:graphic><a:graphicData><a:tbl><a:tr/></a:tbl></a:graphicData></a:graphic></p:graphicFrame>
        </p:spTree>
      </p:cSld>
    </p:sld>`
  );
  zip.file(
    'ppt/slides/slide2.xml',
    '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree/></p:cSld></p:sld>'
  );
  zip.file('ppt/notesSlides/notesSlide1.xml', '<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>');
  zip.file('ppt/media/image1.png', new Uint8Array([0, 1, 2, 3]));
  zip.file(
    'ppt/theme/theme1.xml',
    '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:latin typeface="Aptos"/><a:srgbClr val="FFFFFF"/></a:theme>'
  );

  await writeFile(pptxPath, await zip.generateAsync({ type: 'nodebuffer' }));
  return { dir, pptxPath };
}

describe('inspectPptx', () => {
  it('summarizes editable content, notes, media, unresolved tokens, and design counts', async () => {
    const { dir, pptxPath } = await writeFixturePptx();
    try {
      const inspection = await inspectPptx(pptxPath);

      expect(inspection.slideCount).toBe(2);
      expect(inspection.notesSlideCount).toBe(1);
      expect(inspection.mediaCount).toBe(1);
      expect(inspection.editableTextBoxCount).toBe(1);
      expect(inspection.tableCount).toBe(1);
      expect(inspection.remainingTokens).toContain('{{slide.title}}');
      expect(inspection.emptySlides).toEqual([2]);
      expect(inspection.fonts).toContain('Aptos');
      expect(inspection.colors).toEqual(expect.arrayContaining(['1F4E79']));
      expect(inspection.themeColors).toEqual(expect.arrayContaining(['FFFFFF']));
      expect(inspection.overflowWarnings[0]).toMatchObject({ slideNumber: 1 });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('handles decks with no slide XML as a blocked inspection result', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'velocity-empty-pptx-'));
    const pptxPath = path.join(dir, 'empty.pptx');
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types/>');
    await writeFile(pptxPath, await zip.generateAsync({ type: 'nodebuffer' }));

    try {
      const inspection = await inspectPptx(pptxPath);
      expect(inspection.slideCount).toBe(0);
      expect(inspection.status).toBe('blocked');
      expect(inspection.warnings).toContain('No slide XML files were found.');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
