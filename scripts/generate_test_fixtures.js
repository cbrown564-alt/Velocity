
import { writeFileSync, mkdirSync, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../tests/golden/fixtures');

try {
    mkdirSync(FIXTURES_DIR, { recursive: true });
} catch (e) { }

// 1. weighted_crosstab.csv
const weightedCrosstab = [
    'id,gender,weight',
    '1,Male,0.5',
    '2,Male,0.5',
    '3,Female,1.5',
    '4,Female,1.5',
    '5,Male,1.0',
].join('\n');
writeFileSync(join(FIXTURES_DIR, 'weighted_crosstab.csv'), weightedCrosstab);

// 2. significance_test.csv
const sigTestData = ['id,group,response'];
for (let i = 1; i <= 100; i++) sigTestData.push(`${i},A,Yes`);
for (let i = 101; i <= 200; i++) sigTestData.push(`${i},B,No`);
// Add some noise
for (let i = 201; i <= 210; i++) sigTestData.push(`${i},A,No`);
for (let i = 211; i <= 220; i++) sigTestData.push(`${i},B,Yes`);
writeFileSync(join(FIXTURES_DIR, 'significance_test.csv'), sigTestData.join('\n'));

// 3. grid_expansion.csv
const gridExpansion = [
    'id,q1_1,q1_2,q1_3',
    '1,1,2,3',
    '2,2,3,1',
    '3,3,1,2',
    '4,1,1,1',
    '5,5,5,5',
].join('\n');
writeFileSync(join(FIXTURES_DIR, 'grid_expansion.csv'), gridExpansion);

// 4. filtered_query.csv
const filteredQuery = [
    'id,city,salary',
    '1,NY,5000',
    '2,NY,6000',
    '3,SF,7000',
    '4,SF,8000',
    '5,CHI,4000',
].join('\n');
writeFileSync(join(FIXTURES_DIR, 'filtered_query.csv'), filteredQuery);

// 5. empty_cells.csv
const emptyCells = [
    'id,varA,varB',
    '1,A1,B1',
    '2,A1,B1',
    '3,A2,B2',
    '4,A2,B2',
].join('\n');
writeFileSync(join(FIXTURES_DIR, 'empty_cells.csv'), emptyCells);

// 6. all_missing_column.csv
const allMissing = [
    'id,valid_var,missing_var',
    '1,A,',
    '2,B,',
    '3,A,',
].join('\n');
writeFileSync(join(FIXTURES_DIR, 'all_missing_column.csv'), allMissing);

// 7. large_perf_baseline.csv (100k rows, 50 variables)
console.log('Generating large_perf_baseline.csv...');
const stream = createWriteStream(join(FIXTURES_DIR, 'large_perf_baseline.csv'));
const headers = ['id'];
for (let i = 1; i <= 50; i++) headers.push(`v${i}`);
stream.write(headers.join(',') + '\n');
for (let i = 1; i <= 100000; i++) {
    const row = [i];
    for (let j = 1; j <= 50; j++) {
        // Deterministic "random" value
        row.push(((i * j) % 5) + 1);
    }
    stream.write(row.join(',') + '\n');
    if (i % 25000 === 0) console.log(`  ${i} rows...`);
}
stream.end();
console.log('Done.');
