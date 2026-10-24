#!/usr/bin/env node
// Installs (or removes) the permission hook in your Claude Code user settings.
//
//   node hook/install.mjs              install / update
//   node hook/install.mjs --uninstall  remove it again
//
// It copies permission-hook.mjs to ~/.claude/streamdeck-approve/ and adds one
// "PermissionRequest" entry to ~/.claude/settings.json. Everything else in your settings is kept,
// and a backup is written next to the file first.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(os.homedir(), '.claude', 'streamdeck-approve');
const target = path.join(root, 'permission-hook.mjs');
const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
const uninstall = process.argv.includes('--uninstall');

const command = `node "${target.split(path.sep).join('/')}"`;
const isOurs = (h) => typeof h.command === 'string' && h.command.includes('streamdeck-approve/permission-hook.mjs');

let settings = {};
if (fs.existsSync(settingsPath)) {
  const raw = fs.readFileSync(settingsPath, 'utf8');
  fs.writeFileSync(settingsPath + '.bak-streamdeck-approve', raw);
  settings = raw.trim() ? JSON.parse(raw) : {};
}
settings.hooks ??= {};
const groups = (settings.hooks.PermissionRequest ?? [])
  .map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h) => !isOurs(h)) }))
  .filter((g) => g.hooks.length);

if (uninstall) {
  if (groups.length) settings.hooks.PermissionRequest = groups; else delete settings.hooks.PermissionRequest;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  console.log('Removed the Stream Deck permission hook from', settingsPath);
  process.exit(0);
}

fs.mkdirSync(root, { recursive: true });
fs.copyFileSync(path.join(here, 'permission-hook.mjs'), target);
groups.push({ matcher: '*', hooks: [{ type: 'command', command, timeout: 120 }] });
settings.hooks.PermissionRequest = groups;
fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
console.log('Installed the Stream Deck permission hook:');
console.log('  hook:     ', target);
console.log('  settings: ', settingsPath, '(backup: settings.json.bak-streamdeck-approve)');
console.log('New Claude Code sessions pick it up; restart running sessions to use it there.');
