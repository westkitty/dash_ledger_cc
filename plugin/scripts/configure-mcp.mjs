import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const raw = process.argv[2] || process.env.DASH_LEDGER_MCP_URL || '';

if (!raw) {
  console.error('Usage: node plugin/scripts/configure-mcp.mjs https://YOUR-WORKER.workers.dev/mcp');
  process.exit(2);
}

const url = new URL(raw);
if (url.protocol !== 'https:') throw new Error('MCP URL must use HTTPS.');
if (!url.pathname.endsWith('/mcp')) throw new Error('MCP URL must end in /mcp');
if (url.hostname.endsWith('.invalid')) throw new Error('Refusing reserved .invalid endpoint.');

const target = path.join(root, 'mcp.json');
const doc = JSON.parse(fs.readFileSync(target, 'utf8'));
doc.mcpServers['dash-ledger'].url = url.toString();
fs.writeFileSync(target, JSON.stringify(doc, null, 2) + '\n');
console.log('Configured ' + target + ' -> ' + url.toString());
