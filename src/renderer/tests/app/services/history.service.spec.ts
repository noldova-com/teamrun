/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { Conversation, MethodName } from "@noldova/teamrun-protocol";

import { SampleData } from "../../fixtures/sample-data";
import { Resources } from "../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../src/app/services/bridge.service";
import { ChatStore } from "../../../src/app/services/chat-store.service";
import { HistoryService } from "../../../src/app/services/history.service";

describe("HistoryService", () => {
  it("retraces the conversations shown, branches on a new selection, and skips deleted ones", async () => {
    const second = new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp);
    const third = new Conversation("c3", "p1", "Third", SampleData.timestamp, SampleData.timestamp);
    const bridge = SampleData.createBridge()
      .answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson(), third.toJson()])
      .answer(MethodName.ConversationDelete, () => null);
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const history = TestBed.inject(HistoryService);
    await store.initialize();
    await store.selectConversation("c1");
    TestBed.tick();
    expect(store.selectedConversationId()).toBe("c1");
    expect(history.canGoBack()).toBe(false);
    expect(history.canGoForward()).toBe(false);

    await store.selectConversation("c2");
    TestBed.tick();
    await store.selectConversation("c3");
    TestBed.tick();
    expect(history.canGoBack()).toBe(true);

    await history.back();
    TestBed.tick();
    expect(store.selectedConversationId()).toBe("c2");
    expect(history.canGoForward()).toBe(true);
    await history.back();
    TestBed.tick();
    expect(store.selectedConversationId()).toBe("c1");
    expect(history.canGoBack()).toBe(false);
    await history.back();
    expect(store.selectedConversationId()).toBe("c1");

    await history.forward();
    TestBed.tick();
    expect(store.selectedConversationId()).toBe("c2");

    await store.selectConversation("c3");
    TestBed.tick();
    expect(history.canGoForward()).toBe(false);
    await history.back();
    TestBed.tick();
    expect(store.selectedConversationId()).toBe("c2");

    await store.deleteConversation("c1");
    TestBed.tick();
    expect(history.canGoBack()).toBe(false);
    await store.selectConversation("c3");
    TestBed.tick();
    await store.deleteConversation("c2");
    TestBed.tick();
    await history.back();
    await history.back();
    TestBed.tick();
    expect(store.selectedConversationId()).toBe("c3");
    expect(history.canGoBack()).toBe(false);
  });

  it("keeps only the latest entries", async () => {
    const many = Array.from({ length: Resources.historyLimit + 5 }, (_, i) =>
      new Conversation(`k${i}`, "p1", `K ${i}`, SampleData.timestamp, SampleData.timestamp));
    const bridge = SampleData.createBridge().answer(MethodName.ConversationList, () => many.map(t => t.toJson()));
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const history = TestBed.inject(HistoryService);
    await store.initialize();
    TestBed.tick();
    for (const conversation of many) {
      await store.selectConversation(conversation.id);
      TestBed.tick();
    }

    let steps = 0;
    while (history.canGoBack()) {
      await history.back();
      TestBed.tick();
      steps += 1;
    }
    expect(steps).toBe(Resources.historyLimit - 1);
    expect(store.selectedConversationId()).toBe(`k${many.length - Resources.historyLimit}`);
  });
});
