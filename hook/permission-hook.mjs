#!/usr/bin/env node
// Claude Code "PermissionRequest" hook for the Stream Deck approve/deny plugin.
//
// When Claude Code is about to ask you for permission, this hook writes the request to
//   ~/.claude/streamdeck-approve/pending/<id>.json
// and waits for the Stream Deck plugin to write <id>.decision ("allow" or "deny").
// If nobody presses a key within the wait time, the hook exits silently and Claude Code
// shows its normal permission prompt, so nothing ever gets stuck.
//
// No dependencies: Node.js 18+ only.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const ROOT = path.join(os.homedir(), '.claude', 'streamdeck-approve');
const PENDING = path.join(ROOT, 'pending');

function readConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8')); } catch { return {}; }
}
const config = readConfig();
const WAIT_MS = Math.max(5, Number(process.env.STREAMDECK_APPROVE_WAIT_SECONDS || config.waitSeconds || 45)) * 1000;

// A one-line description of what the tool wants to do, for the key's small screen.
export function summarize(input = {}) {
  const pick = input.command ?? input.file_path ?? input.path ?? input.url ?? input.pattern ?? input.description ?? input.prompt ?? '';
  const text = typeof pick === 'string' ? pick : JSON.stringify(pick);
  return text.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function respond(decision) {
  if (decision === 'allow' || decision === 'deny') {
    const out = { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: decision } } };
    if (decision === 'deny') out.hookSpecificOutput.decision.message = 'Denied from the Stream Deck.';
    process.stdout.write(JSON.stringify(out));
  }
  process.exit(0);
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let event;
  try { event = JSON.parse(raw); } catch { respond(null); return; }

  const id = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const base = path.join(PENDING, id);
  const request = {
    id,
    created: Date.now(),
    expires: Date.now() + WAIT_MS,
    sessionId: event.session_id ?? null,
    project: event.cwd ? path.basename(event.cwd) : null,
    tool: event.tool_name ?? 'unknown',
    summary: summarize(event.tool_input),
  };
  try {
    fs.mkdirSync(PENDING, { recursive: true });
    fs.writeFileSync(base + '.json', JSON.stringify(request));
  } catch { respond(null); return; }

  const cleanup = () => { for (const f of [base + '.json', base + '.decision']) { try { fs.unlinkSync(f); } catch { /* already gone */ } } };
  const timer = setInterval(() => {
    let decision = null;
    try { decision = fs.readFileSync(base + '.decision', 'utf8').trim(); } catch { /* not answered yet */ }
    if (decision || Date.now() > request.expires) {
      clearInterval(timer);
      cleanup();
      respond(decision);
    }
  }, 200);
});
