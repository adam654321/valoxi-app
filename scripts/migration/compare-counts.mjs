// Compare two outputs of table-counts.sql + spot-checks.sql.
// Usage: node scripts/migration/compare-counts.mjs source.txt restored.txt
// Exit 0 only if every COUNT, SEQ and SPOT line matches and neither side has an extra line.
import { readFileSync } from 'node:fs';

const [, , aPath, bPath] = process.argv;
if (!aPath || !bPath) {
  console.error('usage: node compare-counts.mjs source.txt restored.txt');
  process.exit(2);
}

const NL = String.fromCharCode(10);
const load = (p) => {
  const map = new Map();
  for (const raw of readFileSync(p, 'utf8').split(NL)) {
    const line = raw.trim();
    if (!/^(COUNT|SEQ|SPOT)[|]/.test(line)) continue;
    const parts = line.split('|');
    const kind = parts[0];
    const name = parts[1];
    map.set(kind + '|' + name, parts.slice(2).join('|'));
  }
  return map;
};

const a = load(aPath);
const b = load(bPath);
const keys = [...new Set([...a.keys(), ...b.keys()])].sort();
let bad = 0;
for (const k of keys) {
  const va = a.get(k);
  const vb = b.get(k);
  if (va !== vb) {
    bad++;
    console.log('MISMATCH ' + k + '  source=' + va + '  restored=' + vb);
  }
}
const n = (kind) => keys.filter((k) => k.startsWith(kind + '|')).length;
console.log('compared COUNT=' + n('COUNT') + ' SEQ=' + n('SEQ') + ' SPOT=' + n('SPOT') + ' mismatches=' + bad);
process.exit(bad === 0 ? 0 : 1);
