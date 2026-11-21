/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { WindowPartTokens } from "@noldova/desktop.window";
import { Conversation, ConversationListParams, MessageSendParams, MessageSendResult, MethodName, Organization, OrganizationChat,
  TeammateIdParams } from "@noldova/teamrun.protocol";

import { OrganizationChatComponent } from "../../../../src/app/components/organization-chat/organization-chat.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { OrganizationStoreService } from "../../../../src/app/services/organization-store.service";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("OrganizationChatComponent", () => {
  const chatOf = (teammateId: string): Conversation => new Conversation(`org-${teammateId}`, null, `Organization · ${teammateId}`, SampleData.timestamp, SampleData.timestamp,
    false, null, null, false, null, false, [], false, false, null, new OrganizationChat("my-organization", teammateId));
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<OrganizationChatComponent>;
  let kept: readonly Conversation[];
  let opened: string[];
  let openAnswer: (teammateId: string) => JsonValue | Promise<JsonValue>;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const sent = (): MessageSendParams[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.MessageSend))
    .map(t => MessageSendParams.fromJson(t.parameters));
  const create = async (teammateId: string): Promise<void> => {
    context = SampleData.createContext();
    new TeammateFixture(context);
    context.answer(MethodName.OrganizationList, () => Organization.empty.toJson())
      .answer(MethodName.ConversationList, t => Object.isNull(ConversationListParams.fromJson(t).projectId) ? kept.map(u => u.toJson())
        : [SampleData.conversation.toJson()])
      .answer(MethodName.OrganizationChatOpen, t => {
        const id = TeammateIdParams.fromJson(t).teammateId;
        opened.push(id);
        return openAnswer(id);
      })
      .answer(MethodName.MessageSend, () => new MessageSendResult(SampleData.userMessage, []).toJson());
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, ChatStoreService.provider] });
    fixture = TestBed.createComponent(OrganizationChatComponent);
    fixture.componentRef.setInput("teammateId", teammateId);
    element().style.display = "block";
    element().style.height = "40rem";
    fixture.autoDetectChanges();
    await Wait.until(() => expect(ChatStoreService.of(context).loaded()).toBe(true));
    await fixture.whenStable();
  };
  const type = async (text: string): Promise<void> => {
    const box = element().querySelector<HTMLTextAreaElement>("nol-teamrun-composer textarea");
    if (Object.isNull(box))
      throw new Error("No message box.");
    box.value = text;
    box.dispatchEvent(new Event("input", { bubbles: true }));
    await fixture.whenStable();
  };

  beforeEach(() => {
    kept = [];
    opened = [];
    openAnswer = id => chatOf(id).toJson();
  });

  afterEach(async () => {
    await fixture?.whenStable();
    OrganizationStoreService.release(context);
    ChatStoreService.release(context);
  });

  it("shows the teammate's own Organization chat with the chat's history and a composer answered by that teammate, opening none", async () => {
    kept = [chatOf("alice")];
    await create("alice");

    await Wait.until(() => expect(element().querySelectorAll("nol-teamrun-history-message").length).toBeGreaterThan(0));
    await type("Ready?");
    await Wait.until(() => expect(element().querySelector<HTMLButtonElement>(".nol-teamrun-composer-send")?.disabled).toBe(false));
    element().querySelector<HTMLButtonElement>(".nol-teamrun-composer-send")?.click();
    await Wait.until(() => expect(sent()).toHaveLength(1));

    expect([opened, sent()[0]?.chatId, sent()[0]?.responderTeammateId, sent()[0]?.text]).toEqual([[], "org-alice", "alice", "Ready?"]);
  });

  it("opens the teammate's Organization chat once when it has none, and the next teammate's when the choice moves", async () => {
    await create("alice");
    await Wait.until(() => expect(element().querySelector("nol-teamrun-composer")).not.toBeNull());

    fixture.componentRef.setInput("teammateId", "bob");
    await Wait.until(() => expect(opened).toEqual(["alice", "bob"]));
    await fixture.whenStable();

    expect([element().querySelectorAll("nol-teamrun-composer").length, element().querySelector("[role=alert]")]).toEqual([1, null]);
  });

  it("says why the teammate's chat couldn't open, with no composer", async () => {
    openAnswer = () => Promise.reject(new Error("There is no teammate alice."));
    await create("alice");

    await Wait.until(() => expect(element().querySelector("[role=alert]")?.textContent?.trim()).toBe("There is no teammate alice."));
    expect([element().querySelector("nol-teamrun-composer"), element().querySelector("nol-teamrun-history"), opened]).toEqual([null, null, ["alice"]]);
  });
});
