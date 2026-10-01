#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(root, '..');
const outDir = path.join(repoRoot, 'dist-plugin');
const mcpUrl = process.argv[2];

if (!mcpUrl) {
  console.error('Usage: node plugin/scripts/package.mjs https://YOUR-WORKER.workers.dev/mcp');
  process.exit(1);
}

const configure = spawnSync(
  process.execPath,
  [path.join(root, 'scripts', 'configure-mcp.mjs'), mcpUrl],
  { stdio: 'inherit' },
);
if (configure.status !== 0) process.exit(configure.status ?? 1);

const validate = spawnSync(
  process.execPath,
  [path.join(root, 'scripts', 'validate.mjs')],
  { stdio: 'inherit' },
);
if (validate.status !== 0) process.exit(validate.status ?? 1);

fs.mkdirSync(outDir, { recursive: true });
const stamp = createHash('sha256').update(mcpUrl).digest('hex').slice(0, 12);
const zipName = `dash-ledger-plugin-${stamp}.zip`;
const zipPath = path.join(outDir, zipName);

if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

const zip = spawnSync(
  'zip',
  ['-r', '-X', zipPath, 'plugin.json', 'mcp.json', 'skills', 'assets', 'README.md'],
  { cwd: root, stdio: 'inherit' },
);
if (zip.status !== 0) {
  console.error('zip failed; is the zip CLI installed?');
  process.exit(zip.status ?? 1);
}

const bytes = fs.readFileSync(zipPath);
const sha256 = createHash('sha256').update(bytes).digest('hex');
fs.writeFileSync(path.join(outDir, zipName + '.sha256'), sha256 + '  ' + zipName + '\n');
console.log('Packaged ' + zipPath);
console.log('sha256 ' + sha256);
