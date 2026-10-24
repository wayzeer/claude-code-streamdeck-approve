# Claude Code Approve — for Elgato Stream Deck

Approve or deny [Claude Code](https://docs.claude.com/en/docs/claude-code) permission prompts from a Stream Deck key.

When Claude Code wants to run something that needs your OK, the **Approve** and **Deny** keys light up with what it wants to do, for example `Bash · npm run deploy`. Press one and Claude carries on. If you don't press anything, the normal prompt appears in Claude Code after a short wait (45 seconds by default), so nothing ever gets stuck.

Works on **Windows**, tested on Windows 11 with Stream Deck 7.6. It should also work on macOS; reports welcome.

## How it works

```
Claude Code ──PermissionRequest hook──▶ ~/.claude/streamdeck-approve/pending/<id>.json
                                                │
                    Stream Deck plugin shows it on the Approve / Deny keys
                                                │
                       key press ──▶ <id>.decision ("allow" / "deny")
                                                │
Claude Code ◀── hook answers allow / deny ◀─────┘   (no press in time → normal prompt)
```

- **The hook** (`hook/permission-hook.mjs`) is a dependency-free Node script registered as a Claude Code [`PermissionRequest` hook](https://docs.claude.com/en/docs/claude-code/hooks). It writes the request to a local folder and waits for an answer.
- **The plugin** (`com.wayzeer.claude-approve.sdPlugin`) is built with Elgato's official [Stream Deck SDK](https://github.com/elgatosf/streamdeck). It watches that folder, draws the request on the keys and writes your answer back.
- Nothing leaves your machine. There's no network, no server and no account.

## Requirements

- Stream Deck app **7.1 or newer**, which runs the plugin on its own bundled Node.js.
- Claude Code with hooks, and **Node.js 18+** on your PATH (Claude Code already needs it).

## Install

1. **Plugin:** download `com.wayzeer.claude-approve.streamDeckPlugin` from [Releases](../../releases) and double-click it. In Stream Deck, drag **Approve** and **Deny** from the "Claude Code Approve" category onto two keys.
2. **Hook:** clone or download this repo, then run:
   ```bash
   node hook/install.mjs
   ```
   This copies the hook to `~/.claude/streamdeck-approve/` and adds one `PermissionRequest` entry to `~/.claude/settings.json`. It keeps everything else in your settings and writes a backup first. New Claude Code sessions use it right away; restart running sessions to pick it up.

To remove the hook: `node hook/install.mjs --uninstall`

## Settings

How long the hook waits for a key press before falling back to the normal prompt:

- `~/.claude/streamdeck-approve/config.json` → `{ "waitSeconds": 45 }`, or
- the environment variable `STREAMDECK_APPROVE_WAIT_SECONDS`.

The hook's own timeout in `settings.json` is 120 s, so keep `waitSeconds` below that.

## Good to know

- The hook only runs when Claude Code would actually **ask** you. In modes that approve on their own (bypass, auto-accept), there's nothing to approve.
- With several requests waiting, the keys show the oldest one and a "+N more" count.
- Pressing a key when nothing is waiting shows Stream Deck's ⚠ alert.

## Build from source

```bash
npm install
npm run build      # bundles src/ into the .sdPlugin folder
npm test           # end-to-end test against a simulated Stream Deck (no hardware needed)
npm run validate   # Elgato's manifest validator
npm run pack       # writes dist/com.wayzeer.claude-approve.streamDeckPlugin
```

For development, `npx streamdeck link com.wayzeer.claude-approve.sdPlugin` installs the folder into Stream Deck, and `npm run watch` rebuilds and restarts the plugin on every change.

## License

MIT
