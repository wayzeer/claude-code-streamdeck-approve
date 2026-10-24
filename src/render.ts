import type { PendingRequest } from "./requests";

// 144x144 key art as SVG. Stream Deck renders SVG with Qt (SVG Tiny subset), so this sticks to
// shapes, gradients, opacity and text: no filters, masks, clipPath or CSS.

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function wrap(text: string, max: number, lines: number): string[] {
	const words = text.replace(/\s+/g, " ").trim().split(" ");
	const out: string[] = [];
	let cur = "";
	for (const w of words) {
		if ((cur + " " + w).trim().length <= max) cur = (cur + " " + w).trim();
		else {
			if (cur) out.push(cur);
			cur = w.length > max ? w.slice(0, max - 1) + "…" : w;
		}
		if (out.length === lines) break;
	}
	if (out.length < lines && cur) out.push(cur);
	return out.slice(0, lines);
}

const THEME = {
	allow: { accent: "#4FD1A5", deep: "#0E3B2E", label: "Approve", mark: "M48 74 l16 16 l32 -34" },
	deny: { accent: "#F4604F", deep: "#3F1410", label: "Deny", mark: "M52 52 l40 40 M92 52 l-40 40" },
};

/** Tool names like "mcp__github__create_issue" become "create_issue". */
const shortTool = (tool: string) => tool.replace(/^mcp__[^_]+__/, "").slice(0, 16);

export function keySvg(decision: "allow" | "deny", request: PendingRequest | undefined, waiting: number, blink: boolean): string {
	const t = THEME[decision];
	const open =
		`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"><defs>` +
		`<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B1F28"/><stop offset="1" stop-color="#0A0C10"/></linearGradient>` +
		`<radialGradient id="glow" cx="0.85" cy="0.1" r="0.9"><stop offset="0" stop-color="${t.accent}" stop-opacity="${request ? 0.35 : 0.08}"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient>` +
		`</defs><rect width="144" height="144" rx="18" fill="url(#bg)"/><rect width="144" height="144" rx="18" fill="url(#glow)"/>` +
		`<rect x="0.5" y="0.5" width="143" height="143" rx="18" fill="none" stroke="#FFFFFF" stroke-opacity="0.08"/>`;

	if (!request) {
		// Idle: a quiet outline of the mark and the label.
		return (
			open +
			`<path d="${t.mark}" fill="none" stroke="${t.accent}" stroke-opacity="0.35" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>` +
			`<text x="72" y="128" font-family="Segoe UI, Helvetica, Arial" font-size="16" font-weight="700" fill="#6C7383" text-anchor="middle">${t.label}</text></svg>`
		);
	}

	const secs = Math.max(0, Math.round((request.expires - Date.now()) / 1000));
	const lines = wrap(request.summary || "", 16, 3);
	return (
		open +
		`<rect x="10" y="10" width="${t.label.length * 9 + 26}" height="22" rx="11" fill="${t.accent}" fill-opacity="0.16"/>` +
		`<circle cx="21" cy="21" r="4" fill="${t.accent}" opacity="${blink ? 1 : 0.4}"/>` +
		`<text x="30" y="26" font-family="Segoe UI, Helvetica, Arial" font-size="13" font-weight="700" fill="${t.accent}">${t.label}</text>` +
		`<text x="134" y="26" font-family="Segoe UI, Helvetica, Arial" font-size="12" font-weight="600" fill="#A7AEBC" text-anchor="end">${secs}s</text>` +
		`<text x="12" y="56" font-family="Segoe UI, Helvetica, Arial" font-size="18" font-weight="700" fill="#F4F5F7">${esc(shortTool(request.tool))}</text>` +
		lines.map((l, i) => `<text x="12" y="${78 + i * 17}" font-family="Segoe UI, Helvetica, Arial" font-size="13" fill="#C9CED8">${esc(l)}</text>`).join("") +
		(waiting > 1 ? `<text x="134" y="134" font-family="Segoe UI, Helvetica, Arial" font-size="12" font-weight="700" fill="#A7AEBC" text-anchor="end">+${waiting - 1} more</text>` : "") +
		`</svg>`
	);
}
