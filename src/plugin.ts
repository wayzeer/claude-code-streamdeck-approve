import streamDeck from "@elgato/streamdeck";

import { ApproveAction, DenyAction } from "./actions/decide";

streamDeck.logger.setLevel("info");
streamDeck.actions.registerAction(new ApproveAction());
streamDeck.actions.registerAction(new DenyAction());
streamDeck.connect();
