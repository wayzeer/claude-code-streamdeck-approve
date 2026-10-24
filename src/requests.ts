import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** A permission request written by hook/permission-hook.mjs. */
export type PendingRequest = {
	id: string;
	created: number;
	expires: number;
	sessionId: string | null;
	project: string | null;
	tool: string;
	summary: string;
};

export const PENDING_DIR = path.join(os.homedir(), ".claude", "streamdeck-approve", "pending");

/** Requests still waiting for an answer, oldest first. */
export function pendingRequests(): PendingRequest[] {
	let names: string[];
	try {
		names = fs.readdirSync(PENDING_DIR).filter((n) => n.endsWith(".json"));
	} catch {
		return [];
	}
	const now = Date.now();
	const out: PendingRequest[] = [];
	for (const name of names) {
		try {
			const r = JSON.parse(fs.readFileSync(path.join(PENDING_DIR, name), "utf8")) as PendingRequest;
			if (r.expires > now) out.push(r);
		} catch {
			// half-written or just removed: skip it this round
		}
	}
	return out.sort((a, b) => a.created - b.created);
}

/** Answers a request; the hook picks this up within ~200 ms. */
export function answer(id: string, decision: "allow" | "deny"): void {
	fs.writeFileSync(path.join(PENDING_DIR, `${id}.decision`), decision);
}
