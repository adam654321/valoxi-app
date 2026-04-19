import * as fs from 'fs';
import * as path from 'path';

const SOURCE = path.resolve('attached_assets/waitlist_rows__2_.sql');
const OUTPUT = path.resolve('attached_assets/waitlist_rows_transformed.sql');

const source = fs.readFileSync(SOURCE, 'utf-8');
const sourceBytes = Buffer.byteLength(source, 'utf-8');

let transformed = source;

// 1. Strip +00 timezone suffixes from timestamp literals
const tzRegex = /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?)\+00/g;
let tzCount = 0;
transformed = transformed.replace(tzRegex, (_match, ts) => {
  tzCount++;
  return ts;
});

// 2. Replace bare ARRAY[] with ARRAY[]::text[]
//    Only replace ARRAY[] (empty arrays) that are not already cast
const arrayRegex = /ARRAY\[\](?!::text\[\])/g;
let arrayCount = 0;
transformed = transformed.replace(arrayRegex, () => {
  arrayCount++;
  return 'ARRAY[]::text[]';
});

// 3. Append ON CONFLICT (id) DO NOTHING before the final semicolon
const conflictClause = ' ON CONFLICT (id) DO NOTHING';
let conflictAppended = false;
if (transformed.trimEnd().endsWith(';')) {
  transformed = transformed.trimEnd().slice(0, -1) + conflictClause + ';\n';
  conflictAppended = true;
}

fs.writeFileSync(OUTPUT, transformed, 'utf-8');
const transformedBytes = Buffer.byteLength(transformed, 'utf-8');

// Count VALUES tuples in output (by counting UUID starts of tuples)
const tupleMatches = transformed.match(/\('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'/g);
const tupleCount = tupleMatches ? tupleMatches.length : 0;

console.log(`Source bytes:           ${sourceBytes}`);
console.log(`Transformed bytes:      ${transformedBytes}`);
console.log(`+00 suffixes stripped:  ${tzCount}  (expected: 46)`);
console.log(`ARRAY[] fixes applied:  ${arrayCount}  (expected: 1)`);
console.log(`ON CONFLICT appended:   ${conflictAppended}  (expected: true)`);
console.log(`VALUES tuples in output: ${tupleCount}  (expected: 46)`);
