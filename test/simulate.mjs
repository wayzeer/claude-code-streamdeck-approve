// End-to-end test without Stream Deck hardware:
// a fake Stream Deck WebSocket server runs the built plugin, the real hook raises a permission
// request, and a simulated key press must come back to the hook as allow / deny.
// Uses a throwaway home folder, so your real ~/.claude is never touched.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const home = fs.mkdtempSync(path.join(os.tmpdir(), "sd-approve-test-"));
const env = { ...process.env, USERPROFILE: home, HOME: home };
const device = { id: "DEV1", name: "Test Deck", size: { columns: 5, rows: 3 }, type: 0 };
const info = { application: { font: "", language: "en", platform: "windows", platformVersion: "10", version: "7.1.0" }, plugin: { uuid: "com.wayzeer.claude-approve", version: "1.0.0.0" }, devicePixelRatio: 2, colors: {}, devices: [device] };

const wss = new WebSocketServer({ port: 0 });
const port = wss.address().port;
const images = new Map();
let socket;
const connected = new Promise((resolve) => {
	wss.on("connection", (ws) => {
		socket = ws;
		ws.on("message", (m) => {
			const msg = JSON.parse(m.toString());
			if (msg.event === "registerPlugin") resolve();
			if (msg.event === "setImage") images.set(msg.context, decodeURIComponent(msg.payload.image));
		});
	});
});

const plugin = spawn(process.execPath, [path.join(root, "com.wayzeer.claude-approve.sdPlugin/bin/plugin.js"), "-port", String(port), "-pluginUUID", "TESTUUID", "-registerEvent", "registerPlugin", "-info", JSON.stringify(info)], { env, cwd: path.join(root, "com.wayzeer.claude-approve.sdPlugin") });
plugin.stderr.on("data", (d) => process.stderr.write(d));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (o) => socket.send(JSON.stringify(o));
const appear = (action, context, column) => send({ event: "willAppear", action, context, device: device.id, payload: { controller: "Keypad", coordinates: { column, row: 0 }, isInMultiAction: false, settings: {}, state: 0 } });
const press = (action, context, column) => send({ event: "keyDown", action, context, device: device.id, payload: { coordinates: { column, row: 0 }, isInMultiAction: false, settings: {}, state: 0 } });

function raiseRequest(command) {
	const hook = spawn(process.execPath, [path.join(root, "hook/permission-hook.mjs")], { env });
	let out = "";
	hook.stdout.on("data", (d) => (out += d));
	hook.stdin.end(JSON.stringify({ session_id: "s1", cwd: path.join(home, "my-project"), hook_event_name: "PermissionRequest", tool_name: "Bash", tool_input: { command } }));
	return new Promise((resolve) => hook.on("close", () => resolve(out)));
}

let failures = 0;
const check = (ok, what) => { console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) failures++; };

try {
	await Promise.race([connected, sleep(15000).then(() => { throw new Error("plugin never registered"); })]);
	check(true, "plugin registered with Stream Deck");
	appear("com.wayzeer.claude-approve.approve", "ctx-ok", 0);
	appear("com.wayzeer.claude-approve.deny", "ctx-no", 1);
	await sleep(1200);
	check((images.get("ctx-ok") || "").includes("Approve"), "approve key drawn while idle");

	for (const [ctx, action, col, want] of [["ctx-ok", "com.wayzeer.claude-approve.approve", 0, "allow"], ["ctx-no", "com.wayzeer.claude-approve.deny", 1, "deny"]]) {
		const result = raiseRequest(`npm run deploy --${want}`);
		await sleep(1500);
		const shown = images.get(ctx) || "";
		check(shown.includes(">Bash<") && shown.includes("npm run deploy"), `${want}: key shows the waiting request`);
		press(action, ctx, col);
		const out = await Promise.race([result, sleep(5000).then(() => "")]);
		let behavior = null;
		try { behavior = JSON.parse(out).hookSpecificOutput.decision.behavior; } catch { /* no answer */ }
		check(behavior === want, `${want}: hook answered Claude Code with "${behavior}"`);
	}
} catch (err) {
	console.log("FAIL ", err.message);
	failures++;
} finally {
	plugin.kill();
	wss.close();
	fs.rmSync(home, { recursive: true, force: true });
	console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
	process.exit(failures ? 1 : 0);
}
