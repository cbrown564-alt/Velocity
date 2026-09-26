/** Portable offline research handoff. Does not grant approval or alter session formats. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildReviewedExport, exportReviewedDeck } from './research-reviewed-deck';
import { buildExpansionExport, exportExpansionDeck } from './research-expansion-deck';

const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const FILES = ['approved-review.json', 'analysis_results.json', 'reviewed.pptx'] as const;

function adapter(review: Record<string, unknown>) {
  if (review.study_id === 'SBT-002') return { build: buildReviewedExport, render: exportReviewedDeck };
  if (['SBT-004', 'SBT-005', 'SBT-006'].includes(String(review.study_id)))
    return { build: buildExpansionExport, render: exportExpansionDeck };
  throw new Error('No reviewed-deck adapter for this study');
}

export async function createHandoff(reviewPath: string, analysisPath: string, destination: string) {
  // Copy original bytes: the handoff must not rewrite reviewer wording or evidence.
  const reviewBytes = await readFile(reviewPath);
  const analysisBytes = await readFile(analysisPath);
  const review = JSON.parse(reviewBytes.toString());
  const analysis = JSON.parse(analysisBytes.toString());
  const selected = adapter(review);
  const config = selected.build(review, analysis); // Includes approval and evidence identity checks.
  const deck = await selected.render(review, analysis);
  const contents = [reviewBytes, analysisBytes, deck];
  const receipt = {
    kind: 'velocity_research_handoff',
    schema_version: 1,
    study_id: review.study_id,
    approved_at: review.approved_at,
    created_at: new Date().toISOString(),
    files: Object.fromEntries(FILES.map((name, i) => [name, { sha256: sha(contents[i]), bytes: contents[i].length }])),
    exhibits: config.analyses.map((item) => ({ title: item.label, context: item.subtitle })),
    limits: [
      'Offline reviewed research prototype; not a Velocity workspace/session.',
      'One representative chart per approved story beat; all cited evidence and qualifications remain in slide notes.',
      'Hashes detect changes, not scientific correctness or reviewer identity. Approval is inherited, never created by this command.',
      'Keep the original review-pack progress export to continue editing in the reviewer interface.',
    ],
  };
  // Exclusive creation prevents silent replacement of a previously delivered handoff.
  await mkdir(destination);
  try {
    for (const [i, name] of FILES.entries()) await writeFile(join(destination, name), contents[i], { flag: 'wx' });
    await writeFile(join(destination, 'handoff.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
  return receipt;
}

export async function verifyHandoff(directory: string) {
  const receipt = JSON.parse(await readFile(join(directory, 'handoff.json'), 'utf8'));
  if (receipt.kind !== 'velocity_research_handoff' || receipt.schema_version !== 1)
    throw new Error('Unsupported handoff receipt');
  const bytes = await Promise.all(FILES.map((name) => readFile(join(directory, name))));
  for (const [i, name] of FILES.entries()) {
    const expected = receipt.files?.[name];
    if (!expected || expected.sha256 !== sha(bytes[i]) || expected.bytes !== bytes[i].length)
      throw new Error('Handoff file changed: ' + name);
  }
  const review = JSON.parse(bytes[0].toString());
  const analysis = JSON.parse(bytes[1].toString());
  const config = adapter(review).build(review, analysis);
  if (receipt.study_id !== review.study_id || receipt.approved_at !== review.approved_at)
    throw new Error('Handoff identity differs from approved review');
  const exhibits = config.analyses.map((item) => ({ title: item.label, context: item.subtitle }));
  if (JSON.stringify(receipt.exhibits) !== JSON.stringify(exhibits))
    throw new Error('Handoff exhibits differ from approved narrative');
  return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'create' && args.length === 3) {
    const result = await createHandoff(args[0], args[1], args[2]);
    console.log(JSON.stringify({ study: result.study_id, exhibits: result.exhibits.length, directory: args[2] }));
  } else if (command === 'verify' && args.length === 1) {
    const result = await verifyHandoff(args[0]);
    console.log(JSON.stringify({ study: result.study_id, status: 'verified', exhibits: result.exhibits.length }));
  } else {
    throw new Error(
      'Usage: tsx scripts/research-handoff.ts create APPROVED.json ANALYSIS.json NEW_DIRECTORY | verify DIRECTORY',
    );
  }
}
