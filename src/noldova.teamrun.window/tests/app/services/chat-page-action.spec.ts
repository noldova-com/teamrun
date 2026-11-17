/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { TopBarActionState, TopBarSide } from "@noldova/desktop.window";

import { ChatPageAction } from "../../../src/app/services/chat-page-action";
import { ChatStoreService } from "../../../src/app/services/chat-store.service";
import { SampleData } from "../../fixtures/sample-data.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("ChatPageAction", () => {
  const offered = new TopBarActionState("language", "Open the chat's Browser page", "teamrun.openChatPage");
  const unavailable = new TopBarActionState("language", "Open a chat to open its Browser page", "teamrun.openChatPage");

  it("puts the chat's Browser page at the top bar's end, saying why it can't open while no chat shows, and follows the chat on screen until released", async () => {
    const context = SampleData.createContext();
    const store = ChatStoreService.of(context);
    await Wait.until(() => expect(store.loaded()).toBe(true));
    ChatPageAction.register(context, store);
    const [action] = context.registeredTopBarActions;

    expect([action?.name, action?.side, action?.state()]).toEqual(["teamrun.chatPage", TopBarSide.End, unavailable]);
    await store.conversationInView("c1");
    expect(action?.state()).toEqual(offered);
    store.conversationOutOfView("c1");
    expect(action?.state()).toEqual(unavailable);

    ChatPageAction.release(context);
    await store.conversationInView("c1");
    expect(action?.state()).toEqual(unavailable);
  });

  it("takes the state of a chat already on screen when it registers", async () => {
    const context = SampleData.createContext();
    const store = ChatStoreService.of(context);
    await Wait.until(() => expect(store.loaded()).toBe(true));
    await store.conversationInView("c1");

    ChatPageAction.register(context, store);

    expect(context.registeredTopBarActions.map(t => t.state())).toEqual([offered]);
    ChatPageAction.release(context);
  });
});
