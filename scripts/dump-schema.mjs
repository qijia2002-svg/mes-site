import { query } from './lib/d1.mjs';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rows = query(
  "SELECT sql FROM sqlite_master WHERE type='table' AND name IN " +
    "('chapters','questions','sql_exercises','micro_practices','node_resources','flow_nodes','flowcharts','flow_edges','topics')",
);
const sql = rows.map((r) => r.sql).join(';\n') + ';\n';
writeFileSync(resolve(ROOT, 'tmp/schema_full.sql'), sql);
console.log('wrote', rows.length, 'table DDLs to tmp/schema_full.sql');
