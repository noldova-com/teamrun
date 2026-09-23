/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";

import { Conversation, ConversationSearchHit, ConversationSearchResult, MethodName } from "@noldova/teamrun-protocol";

import { SampleData } from "../../fixtures/sample-data";
import { AppView } from "../../../src/app/enums/app-view";
import { TEAMRUN_BRIDGE } from "../../../src/app/services/bridge.service";
import { ChatStore } from "../../../src/app/services/chat-store.service";
import { NavigationService } from "../../../src/app/services/navigation.service";
import { SearchLauncher } from "../../../src/app/services/search-launcher.service";

describe("SearchLauncher", () => {
  it("opens the dialog and shows the chosen conversation", async () => {
    const other = new Conversation("c2", "p1", "Login flow", SampleData.timestamp, SampleData.timestamp);
    const bridge = SampleData.createBridge()
      .answer(MethodName.ConversationList, () => [SampleData.conversation.toJson(), other.toJson()])
      .answer(MethodName.ConversationSearch, () => new ConversationSearchResult([]).toJson());
    TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: bridge }] });
    const store = TestBed.inject(ChatStore);
    const navigation = TestBed.inject(NavigationService);
    const launcher = TestBed.inject(SearchLauncher);
    await store.initialize();
    navigation.openSettings();

    launcher.open();
    const dialogs = TestBed.inject(MatDialog);
    expect(dialogs.openDialogs.length).toBe(1);
    dialogs.openDialogs[0]!.close(new ConversationSearchHit("c2", "p1", "Login flow", "m7", "…login…", SampleData.timestamp));
    await vi.waitFor(() => expect(store.selectedConversationId()).toBe("c2"));
    expect(navigation.view()).toBe(AppView.Chat);
    await vi.waitFor(() => expect(store.focusMessageId()).toBe("m7"));

    launcher.open();
    dialogs.openDialogs[0]!.close();
    await vi.waitFor(() => expect(dialogs.openDialogs.length).toBe(0));
    expect(store.selectedConversationId()).toBe("c2");
    store.dispose();
  });
});
