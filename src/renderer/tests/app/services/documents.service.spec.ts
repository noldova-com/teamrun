/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source prefix.
 */

import { TestBed } from "@angular/core/testing";

import { Conversation, MethodName } from "@noldova/teamrun-protocol";

import { MemoryStorage } from "../../fixtures/memory-storage";
import { SampleData } from "../../fixtures/sample-data";
import { Layout } from "../../../src/app/models/layout";
import { Resources } from "../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../src/app/services/bridge.service";
import { ChatStore } from "../../../src/app/services/chat-store.service";
import { OpenMode } from "../../../src/app/enums/open-mode";
import { DocumentsService } from "../../../src/app/services/documents.service";
import { LayoutService } from "../../../src/app/services/layout.service";

describe("DocumentsService", () => {
  it.each([
    { name: "saved tabs in their saved order", saved: ["c3", "c2"], expected: ["c3", "c2"], active: "c2" },
    { name: "all tabs closed", saved: [], expected: [], active: null },
    { name: "a deleted active conversation", saved: ["c2", "gone"], expected: ["c2"], active: "c2" },
    { name: "all saved conversations deleted", saved: ["gone"], expected: [], active: null }
  ])("restores $name without opening another conversation", async ({ saved, expected, active }) => {
    const storage = MemoryStorage.install(window);
    let previous = Layout.createDefault();
    for (const id of saved)
      previous = previous.showDocument(id);
    storage.setItem(Resources.layoutStorageKey, JSON.stringify(previous.toJson()));
    const conversations = [SampleData.conversation, ...["c2", "c3"].map(id => new Conversation(id, "p1", id, SampleData.timestamp, SampleData.timestamp))];
    const bridge = SampleData.createBridge().answer(MethodName.ConversationList, () => conversations.map(t => t.toJson()));
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const layout = TestBed.inject(LayoutService);
    const documents = TestBed.inject(DocumentsService);
    await store.initialize();
    await documents.restore();
    TestBed.tick();
    expect(layout.documents()).toEqual(expected);
    expect(layout.activeDocument()).toBe(active);
    expect(store.selectedConversationId()).toBe(active);
    expect(bridge.requests.filter(t => t.method === MethodName.MessagePage).map(t => (t.payload as { conversationId: string }).conversationId))
      .toEqual(active === null ? [] : [active]);
    store.dispose();
  });

  it("opens tabs as conversations are shown, closes tabs, and restores the active one", async () => {
    const storage = MemoryStorage.install(window);
    storage.setItem(Resources.layoutStorageKey, JSON.stringify(Layout.createDefault().showDocument("gone").showDocument("c2").toJson()));
    const second = new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp);
    const bridge = SampleData.createBridge().answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson()]);
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const layout = TestBed.inject(LayoutService);
    const documents = TestBed.inject(DocumentsService);
    TestBed.tick();
    await documents.restore();
    expect(layout.documents()).toEqual(["gone", "c2"]);

    await store.initialize();
    TestBed.tick();
    expect(layout.documents()).toEqual(["c2"]);
    expect(store.selectedConversationId()).toBeNull();

    await documents.restore();
    TestBed.tick();
    expect(store.selectedConversationId()).toBe("c2");
    expect(layout.activeDocument()).toBe("c2");

    await documents.show("c1");
    TestBed.tick();
    expect(layout.activeDocument()).toBe("c1");

    await documents.close("c1");
    TestBed.tick();
    expect(layout.documents()).toEqual(["c2"]);
    expect(store.selectedConversationId()).toBe("c2");
    await documents.close("c2");
    TestBed.tick();
    expect(layout.documents()).toEqual([]);
    expect(store.selectedConversationId()).toBeNull();

    await documents.show("c1");
    TestBed.tick();
    layout.showDocument("c2");
    await documents.close("c2");
    expect(store.selectedConversationId()).toBe("c1");
    await documents.restore();
    expect(store.selectedConversationId()).toBe("c1");
    store.dispose();
  });

  it("opens a preview tab under the double-click mode, a kept tab under the single-click mode, and keeps on demand", async () => {
    MemoryStorage.install(window);
    const second = new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp);
    const third = new Conversation("c3", "p1", "Third", SampleData.timestamp, SampleData.timestamp);
    const bridge = SampleData.createBridge().answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), second.toJson(), third.toJson()]);
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const layout = TestBed.inject(LayoutService);
    const documents = TestBed.inject(DocumentsService);
    await store.initialize();
    await documents.show("c1");
    TestBed.tick();
    expect(layout.documents()).toEqual(["c1"]);
    expect(layout.previewDocument()).toBeNull();
    const initialEntry = store.messageIndex()[0];
    documents.closeAll();
    TestBed.tick();
    await documents.show("c1");
    TestBed.tick();
    expect(store.messageIndex()[0]).not.toBe(initialEntry);

    await documents.open("c2", OpenMode.DoubleClick);
    TestBed.tick();
    expect(layout.documents()).toEqual(["c1", "c2"]);
    expect(layout.previewDocument()).toBe("c2");
    const previewEntry = store.messageIndex()[0];
    await documents.open("c3", OpenMode.DoubleClick);
    TestBed.tick();
    expect(layout.documents()).toEqual(["c1", "c3"]);
    expect(layout.previewDocument()).toBe("c3");
    await documents.keepOpen("c3");
    TestBed.tick();
    expect(layout.previewDocument()).toBeNull();
    await documents.open("c2", OpenMode.SingleClick);
    TestBed.tick();
    expect(layout.documents()).toEqual(["c1", "c3", "c2"]);
    expect(layout.previewDocument()).toBeNull();
    expect(store.messageIndex()[0]).not.toBe(previewEntry);
    store.dispose();
  });
});
