import streamDeck, { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";

import { keySvg } from "../render";
import { answer, pendingRequests } from "../requests";

type Decision = "allow" | "deny";

/**
 * One class drives both keys. "Approve" and "Deny" are separate actions in the manifest so they can
 * be placed independently; each shows the oldest waiting Claude Code permission request and answers it.
 */
abstract class DecideAction extends SingletonAction {
	protected abstract readonly decision: Decision;
	private timer: NodeJS.Timeout | undefined;
	private lastSvg = new Map<string, string>();

	override onWillAppear(_ev: WillAppearEvent): void {
		this.start();
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		this.lastSvg.delete(ev.action.id);
		if (![...this.actions].length) this.stop();
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		const request = pendingRequests()[0];
		if (!request) {
			await ev.action.showAlert();
			return;
		}
		try {
			answer(request.id, this.decision);
			await ev.action.showOk();
		} catch (err) {
			streamDeck.logger.error("Could not answer the request", err);
			await ev.action.showAlert();
		}
		setTimeout(() => this.refresh(), 300);
	}

	private start(): void {
		if (this.timer) return;
		this.refresh();
		this.timer = setInterval(() => this.refresh(), 500);
	}

	private stop(): void {
		clearInterval(this.timer);
		this.timer = undefined;
	}

	private refresh(): void {
		const requests = pendingRequests();
		const blink = Math.floor(Date.now() / 700) % 2 === 0;
		for (const a of this.actions) {
			if (!a.isKey()) continue;
			const svg = keySvg(this.decision, requests[0], requests.length, blink);
			if (this.lastSvg.get(a.id) === svg) continue; // only redraw when something changed
			this.lastSvg.set(a.id, svg);
			void a.setImage(`data:image/svg+xml;charset=utf8,${svg}`);
		}
	}
}

@action({ UUID: "com.wayzeer.claude-approve.approve" })
export class ApproveAction extends DecideAction {
	protected readonly decision = "allow";
}

@action({ UUID: "com.wayzeer.claude-approve.deny" })
export class DenyAction extends DecideAction {
	protected readonly decision = "deny";
}
