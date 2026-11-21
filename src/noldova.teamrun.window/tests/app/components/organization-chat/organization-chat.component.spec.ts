/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { WindowPartTokens } from "@noldova/desktop.window";
import { Conversation, ConversationListParams, Department, DepartmentMember, MessageSendParams, MessageSendResult, MethodName, Organization, OrganizationChat,
  OrganizationTarget, TeammateIdParams } from "@noldova/teamrun.protocol";

import { OrganizationChatComponent } from "../../../../src/app/components/organization-chat/organization-chat.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { OrganizationStoreService } from "../../../../src/app/services/organization-store.service";
import { Resources } from "../../../../src/resources";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("OrganizationChatComponent", () => {
  const organization = new Organization([new Department("d1", "Design", null, "alice", 0, "c", "u")],
    [new DepartmentMember("alice", "d1"), new DepartmentMember("bob", "d1")]);
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
  const create = async (target: OrganizationTarget): Promise<void> => {
    context = SampleData.createContext();
    new TeammateFixture(context);
    context.answer(MethodName.OrganizationList, () => organization.toJson())
      .answer(MethodName.ConversationList, t => Object.isNull(ConversationListParams.fromJson(t).projectId) ? kept.map(u => u.toJson())
        : [SampleData.conversation.toJson()])
      .answer(MethodName.OrganizationChatOpen, t => {
        const id = TeammateIdParams.fromJson(t).teammateId;
        opened.push(id);
        return openAnswer(id);
      })
      .answer(MethodName.MessageSend, () => new MessageSendResult(SampleData.userMessage, []).toJson());
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: WindowPartTokens.shown, useValue: signal(true).asReadonly() },
      ChatStoreService.provider] });
    fixture = TestBed.createComponent(OrganizationChatComponent);
    fixture.componentRef.setInput("target", target);
    element().style.display = "block";
    element().style.height = "40rem";
    fixture.autoDetectChanges();
    await Wait.until(() => expect(ChatStoreService.of(context).loaded()).toBe(true));
    await Wait.until(() => expect(OrganizationStoreService.of(context).organization().departments).toHaveLength(1));
    await fixture.whenStable();
  };
  const texts = (selector: string): string[] => [...element().querySelectorAll(selector)].map(t => t.textContent?.trim() ?? "");
  const type = async (text: string): Promise<void> => {
    const box = element().querySelector<HTMLTextAreaElement>("nol-teamrun-composer textarea");
    if (Object.isNull(box))
      throw new Error("No message box.");
    box.value = text;
    box.dispatchEvent(new Event("input", { bubbles: true }));
    await fixture.whenStable();
  };

  beforeEach(() => {
    globalThis.localStorage.removeItem(Resources.keptComposerDraftsStorageKey);
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
    await create(OrganizationTarget.teammate("alice"));

    await Wait.until(() => expect(element().querySelectorAll("nol-teamrun-history-message").length).toBeGreaterThan(0));
    await type("Ready?");
    await Wait.until(() => expect(element().querySelector<HTMLButtonElement>(".nol-teamrun-composer-send")?.disabled).toBe(false));
    element().querySelector<HTMLButtonElement>(".nol-teamrun-composer-send")?.click();
    await Wait.until(() => expect(sent()).toHaveLength(1));

    expect([opened, sent()[0]?.chatId, sent()[0]?.responderTeammateId, sent()[0]?.text]).toEqual([[], "org-alice", "alice", "Ready?"]);
  });

  it("opens the teammate's Organization chat once when it has none, and the next teammate's when the choice moves", async () => {
    await create(OrganizationTarget.teammate("alice"));
    await Wait.until(() => expect(element().querySelector("nol-teamrun-composer")).not.toBeNull());

    fixture.componentRef.setInput("target", OrganizationTarget.teammate("bob"));
    await Wait.until(() => expect(opened).toEqual(["alice", "bob"]));
    await fixture.whenStable();

    expect([element().querySelectorAll("nol-teamrun-composer").length, element().querySelector("[role=alert]")]).toEqual([1, null]);
  });

  it("says why the teammate's chat couldn't open, with no composer", async () => {
    openAnswer = () => Promise.reject(new Error("There is no teammate alice."));
    await create(OrganizationTarget.teammate("alice"));

    await Wait.until(() => expect(element().querySelector("[role=alert]")?.textContent?.trim()).toBe("There is no teammate alice."));
    expect([element().querySelector("nol-teamrun-composer"), element().querySelector("nol-teamrun-history"), opened]).toEqual([null, null, ["alice"]]);
  });

  it("sends one message to each recipient's own Organization chat, answered by that recipient, lists them with their reply status, and opens one's chat", async () => {
    kept = [chatOf("alice")];
    await create(OrganizationTarget.department("d1"));
    const changes: OrganizationTarget[] = [];
    fixture.componentInstance.target.subscribe(t => changes.push(t));

    expect([element().querySelector("nol-teamrun-history"), element().querySelector(".nol-teamrun-composer-picker")?.checkVisibility(),
      texts(".nol-teamrun-organization-recipient-name"), texts(".nol-teamrun-organization-recipient-status")])
      .toEqual([null, false, ["Alice", "Bob"], ["No reply yet", "No reply yet"]]);

    await type("Status?");
    await Wait.until(() => expect(element().querySelector<HTMLButtonElement>(".nol-teamrun-composer-send")?.disabled).toBe(false));
    element().querySelector<HTMLButtonElement>(".nol-teamrun-composer-send")?.click();
    await Wait.until(() => expect(sent()).toHaveLength(2));

    expect([opened, sent().map(t => [t.chatId, t.responderTeammateId, t.text])]).toEqual([["bob"], [["org-alice", "alice", "Status?"], ["org-bob", "bob", "Status?"]]]);
    await Wait.until(() => expect(element().querySelector<HTMLTextAreaElement>("nol-teamrun-composer textarea")?.value).toBe(""));

    element().querySelectorAll<HTMLButtonElement>(".nol-teamrun-organization-recipient")[1]?.click();
    await fixture.whenStable();
    expect(changes.map(t => [t.kind, t.id])).toEqual([[OrganizationTarget.teammate("bob").kind, "bob"]]);
  });

  it("keeps a fan-out's unsent text for the same recipients across a new panel, and clears it once sent", async () => {
    await create(OrganizationTarget.department("d1"));
    await type("Draft for both");
    fixture.destroy();
    fixture = TestBed.createComponent(OrganizationChatComponent);
    fixture.componentRef.setInput("target", OrganizationTarget.department("d1"));
    fixture.autoDetectChanges();

    await Wait.until(() => expect(element().querySelector<HTMLTextAreaElement>("nol-teamrun-composer textarea")?.value).toBe("Draft for both"));
    element().querySelector<HTMLButtonElement>(".nol-teamrun-composer-send")?.click();
    await Wait.until(() => expect(sent()).toHaveLength(2));
    await Wait.until(() => expect(globalThis.localStorage.getItem(Resources.keptComposerDraftsStorageKey)).toBe("{}"));
  });
});
