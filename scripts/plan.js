#!/usr/bin/env node
// Prints a GitHub Actions matrix (JSON) that splits the requested renders into frame-range chunks.
//   node scripts/plan.js --profiles 1080p,4k,shorts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FPS = 30;
const CHUNK = { '1080p': 900, '4k': 360, shorts: 900, preview: 900, 'preview-short': 900 };   // frames per runner job
const TL = { '1080p': 'long', '4k': 'long', shorts: 'short', preview: 'long', 'preview-short': 'short' };
const i = process.argv.indexOf('--profiles');
const profiles = (i > 0 ? process.argv[i + 1] : '1080p').split(',').map((s) => s.trim()).filter(Boolean);
const include = [];
for (const p of profiles) {
  if (!CHUNK[p]) { console.error('unknown profile ' + p); process.exit(1); }
  const tl = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', `timeline_${TL[p]}.json`), 'utf8'));
  const total = Math.round(tl.total * FPS);
  const n = Math.ceil(total / CHUNK[p]);
  for (let c = 0; c < n; c++) include.push({ profile: p, chunk: c, start: c * CHUNK[p], end: Math.min(total, (c + 1) * CHUNK[p]), chunks: n });
}
process.stdout.write(JSON.stringify({ include }));
