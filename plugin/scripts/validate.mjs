import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const args = new Set(process.argv.slice(2));
const sourceOnly = args.has('--source-only');

function fail(message) {
  console.error('ERROR: ' + message);
  process.exitCode = 1;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  } catch (error) {
    fail(file + ' is not valid JSON: ' + error.message);
    return null;
  }
}

const manifest = readJson('plugin.json');
const mcp = readJson('mcp.json');
const skill = path.join(root, 'skills', 'dash-ledger', 'SKILL.md');

if (!manifest) process.exit(1);
if (manifest.$schema !== 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json') {
  fail('plugin.json must use the Agent Plugins 1.0.0 schema.');
}
if (manifest.name !== 'dash-ledger') fail('plugin name must remain dash-ledger.');
if (!fs.existsSync(skill)) fail('Dash Ledger SKILL.md is missing.');

if (!mcp) process.exit(1);
if (mcp.$schema !== 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json') {
  fail('mcp.json must use the Agent Plugins MCP schema.');
}
const server = mcp.mcpServers?.['dash-ledger'];
if (!server || server.type !== 'streamable-http') {
  fail('dash-ledger MCP must use streamable-http.');
}
if (typeof server?.url !== 'string') {
  fail('dash-ledger MCP URL is missing.');
} else {
  let parsed;
  try {
    parsed = new URL(server.url);
  } catch {
    fail('dash-ledger MCP URL is not a URL.');
  }
  if (parsed && parsed.protocol !== 'https:') fail('dash-ledger MCP URL must use HTTPS.');
  if (!sourceOnly && parsed?.hostname.endsWith('.invalid')) {
    fail('replace the reserved .invalid MCP URL before packaging or upload.');
  }
}

const skillText = fs.existsSync(skill) ? fs.readFileSync(skill, 'utf8') : '';
if (!/^---\nname: dash-ledger\ndescription:/m.test(skillText)) {
  fail('SKILL.md frontmatter must declare dash-ledger with a description.');
}
if (skillText.includes('TODO') || skillText.includes('[TODO')) {
  fail('SKILL.md still contains a placeholder.');
}

if (!process.exitCode) {
  console.log(sourceOnly ? 'Plugin source validation PASS' : 'Plugin package validation PASS');
}
