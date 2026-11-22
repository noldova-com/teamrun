/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { WindowPartTokens } from "@noldova/desktop.window";
import {
  AttachmentInput, Conversation, ConversationListParams, Department, DetailKind, EventName, Message, MessageAttachment, MessageAuthor, MessagePageParams, MessageSendParams, MessageSendResult, MessageStatus,
  MethodName, Organization, OrganizationChat, OrganizationParent, OrganizationTarget, TeammateLastReply, TeammatePlacement, WaitingMessage, WaitingMessageAddParams
} from "@noldova/teamrun.protocol";

import { ComposerComponent } from "../../../../src/app/components/composer/composer.component";
import { OrganizationChatComponent } from "../../../../src/app/components/organization-chat/organization-chat.component";
import { ComposerSettings } from "../../../../src/app/models/composer-settings";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { OrganizationCatalog } from "../../../../src/app/services/organization-catalog";
import { OrganizationScope } from "../../../../src/app/services/organization-scope";
import { OrganizationStoreService } from "../../../../src/app/services/organization-store.service";
import { Resources } from "../../../../src/resources";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { Required } from "../../../fixtures/required.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("OrganizationChatComponent", () => {
  const design = new Department("d1", "Design", "department", OrganizationParent.person, "alice", 0, "c", "u");
  const placed = (...ids: readonly string[]): TeammatePlacement[] => ids.map((t, i) => new TeammatePlacement(t, OrganizationParent.department("d1"), i));
  const pair = SampleData.organizationOf([design], placed("alice", "bob"));
  const chatOf = (teammateId: string): Conversation => new Conversation(`org-${teammateId}`, null, `Organization · ${teammateId}`, SampleData.timestamp, SampleData.timestamp,
    false, null, null, false, null, false, [], false, false, null, new OrganizationChat("my-organization", teammateId));
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<OrganizationChatComponent>;
  let kept: readonly Conversation[];
  let opened: string[];
  let refused: readonly string[];
  let organization: Organization;
  let scope: string;
  let running: readonly Message[];
  let lastReplies: readonly TeammateLastReply[];
  let pages: ReadonlyMap<string, readonly Message[]>;
  let unreadable: readonly string[];
  let openAnswer: (teammateId: string) => JsonValue | Promise<JsonValue>;

  const element = (): HTMLElement => {
    const native: unknown = fixture.nativeElement;
    if (!(native instanceof HTMLElement))
      throw new Error("The fixture has no element.");
    return native;
  };
  const sent = (): MessageSendParams[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.MessageSend))
    .map(t => MessageSendParams.fromJson(t.parameters));
  const scopeOf = (id: string): OrganizationScope => {
    const made = new OrganizationScope();
    made.follow(signal(id));
    return made;
  };
  const create = async (target: OrganizationTarget): Promise<void> => {
    context = SampleData.createContext();
    const data = new TeammateFixture(context);
    data.teammates.push(data.reviewer);
    context.answer(MethodName.OrganizationList, () => [organization.toJson()])
      .answer(MethodName.MessageListOpen, () => running.map(t => t.toJson()))
      .answer(MethodName.TeammateLastReplyList, () => lastReplies.map(t => t.toJson()))
      .answer(MethodName.MessagePage, t => {
        const chatId = MessagePageParams.fromJson(t).chatId;
        return unreadable.includes(chatId) ? Promise.reject(new Error("Not read.")) : SampleData.page(pages.get(chatId) ?? [SampleData.userMessage], false, false).toJson();
      })
      .answer(MethodName.WaitingMessageAdd, t => {
        const params = WaitingMessageAddParams.fromJson(t);
        return new WaitingMessage(`w${context.count(MethodName.WaitingMessageAdd)}`, params.delivery, params.message, SampleData.timestamp).toJson();
      })
      .answer(MethodName.ConversationList, t => Object.isNull(ConversationListParams.fromJson(t).projectId) ? kept.map(u => u.toJson())
        : [SampleData.conversation.toJson()])
      .answer(MethodName.OrganizationChatOpen, t => {
        const id = OrganizationChat.fromJson(t).teammateId;
        opened.push(id);
        return openAnswer(id);
      })
      .answer(MethodName.AttachmentPrepare, t => {
        const input = AttachmentInput.fromJson(t);
        return new MessageAttachment(input.name, input.mediaType, 4, `D:/data/attachments/drafts/${context.count(MethodName.AttachmentPrepare)}-${input.name}`).toJson();
      })
      .answer(MethodName.MessageSend, t => refused.includes(MessageSendParams.fromJson(t).chatId) ? Promise.reject(new Error("Not sent."))
        : new MessageSendResult(SampleData.userMessage, []).toJson());
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: WindowPartTokens.shown, useValue: signal(true).asReadonly() },
      ChatStoreService.provider, { provide: OrganizationScope, useFactory: (): OrganizationScope => scopeOf(scope) }] });
    fixture = TestBed.createComponent(OrganizationChatComponent);
    fixture.componentRef.setInput("target", target);
    element().style.height = "40rem";
    fixture.autoDetectChanges();
    await Wait.until(() => expect(ChatStoreService.of(context).loaded()).toBe(true));
    await Wait.until(() => expect(OrganizationCatalog.of(context).organizations()[0]?.departments).toHaveLength(1));
    await fixture.whenStable();
  };
  const box = (): HTMLTextAreaElement | null => element().querySelector<HTMLTextAreaElement>("nol-teamrun-composer textarea");
  const queued = (): WaitingMessageAddParams[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.WaitingMessageAdd))
    .map(t => WaitingMessageAddParams.fromJson(t.parameters));
  const reply = (chatId: string, status: MessageStatus): Message => SampleData.withStatus(new Message(`${chatId}-r`, chatId, 1, MessageAuthor.Provider, null,
    MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "Working")], SampleData.provenance, SampleData.timestamp, null, SampleData.timestamp), status);
  const sendNow = async (): Promise<void> => {
    await Wait.until(() => expect(element().querySelector<HTMLButtonElement>(".nol-teamrun-composer-send")?.disabled).toBe(false));
    element().querySelector<HTMLButtonElement>(".nol-teamrun-composer-send")?.click();
  };
  const texts = (selector: string): (string | undefined)[] => [...element().querySelectorAll(selector)].map(t => t.textContent?.trim());
  const type = async (text: string): Promise<void> => {
    const box = element().querySelector<HTMLTextAreaElement>("nol-teamrun-composer textarea");
    if (Object.isNull(box))
      throw new Error("No message box.");
    box.value = text;
    box.setSelectionRange(text.length, text.length);
    box.dispatchEvent(new Event("input", { bubbles: true }));
    await fixture.whenStable();
  };

  beforeEach(() => {
    globalThis.localStorage.removeItem(Resources.keptComposerDraftsStorageKey);
    kept = [];
    opened = [];
    refused = [];
    organization = pair;
    scope = "my-organization";
    running = [];
    lastReplies = [];
    pages = new Map();
    unreadable = [];
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

  it("asks once for a teammate's chat still opening when the choice comes back to it", async () => {
    let release = (): void => undefined;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    openAnswer = async id => {
      if (id === "alice")
        await held;
      return chatOf(id).toJson();
    };
    await create(OrganizationTarget.teammate("alice"));
    await Wait.until(() => expect(opened).toEqual(["alice"]));
    fixture.componentRef.setInput("target", OrganizationTarget.teammate("bob"));
    await Wait.until(() => expect(opened).toEqual(["alice", "bob"]));
    fixture.componentRef.setInput("target", OrganizationTarget.teammate("alice"));
    await Wait.until(() => expect(texts(".nol-teamrun-organization-chat-title")).toEqual(["Chat with Alice"]));

    release();

    await Wait.until(() => expect(element().querySelector("nol-teamrun-composer")).not.toBeNull());
    expect(opened).toEqual(["alice", "bob"]);
  });

  it.each(["my-organization", "studio"])("talks to a teammate in %s only in that organization's own chat, never one kept for another organization or a deleted one", async id => {
    const own = (organizationId: string, teammateId: string): Conversation => new Conversation(`${organizationId}-${teammateId}`, null, `Organization · ${teammateId}`,
      SampleData.timestamp, SampleData.timestamp, false, null, null, false, null, false, [], false, false, null, new OrganizationChat(organizationId, teammateId));
    const others = ["my-organization", "studio", "gone"].filter(t => t !== id).map(t => own(t, "alice"));
    const openings = (): string[] => context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.OrganizationChatOpen))
      .map(t => OrganizationChat.fromJson(t.parameters).organizationId);
    scope = id;
    organization = new Organization(id, id, null, 0, SampleData.timestamp, SampleData.timestamp, [SampleData.departmentType], [design], placed("alice", "bob"));
    kept = others;
    openAnswer = teammateId => own(id, teammateId).toJson();
    await create(OrganizationTarget.teammate("alice"));
    await Wait.until(() => expect(box()).not.toBeNull());

    await type("Status?");
    await sendNow();
    await Wait.until(() => expect(sent()).toHaveLength(1));

    expect([openings(), sent().map(t => t.chatId)]).toEqual([[id], [`${id}-alice`]]);
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

  it("still sends to the other recipients when one's send fails, keeps the text and its draft, and retries only the recipient it didn't reach", async () => {
    organization = SampleData.organizationOf([design], placed("alice", "bob", "reviewer"));
    kept = [chatOf("alice"), chatOf("bob"), chatOf("reviewer")];
    refused = ["org-bob"];
    await create(OrganizationTarget.department("d1"));
    await type("Status?");
    await sendNow();
    await Wait.until(() => expect(sent()).toHaveLength(3));
    await fixture.whenStable();
    const failed = [sent().map(t => t.chatId), box()?.value, Object.values(JSON.parse(Required.of(globalThis.localStorage.getItem(Resources.keptComposerDraftsStorageKey))))];

    refused = [];
    await sendNow();
    await Wait.until(() => expect(sent()).toHaveLength(4));
    await Wait.until(() => expect(box()?.value).toBe(""));

    expect([failed, sent().slice(3).map(t => t.chatId)]).toEqual([[["org-alice", "org-bob", "org-reviewer"], "Status?", ["Status?"]], ["org-bob"]]);
  });

  it("retries a file picked in the panel only to the recipient it didn't reach, though the file is prepared again under a new path", async () => {
    organization = SampleData.organizationOf([design], placed("alice", "bob", "reviewer"));
    kept = [chatOf("alice"), chatOf("bob"), chatOf("reviewer")];
    refused = ["org-bob"];
    await create(OrganizationTarget.department("d1"));
    const picker = element().querySelector<HTMLInputElement>('nol-teamrun-composer input[type="file"]');
    if (Object.isNull(picker))
      throw new Error("The panel's composer has no file picker.");
    Object.defineProperty(picker, "files", { value: [new File(["plan"], "plan.txt", { type: "text/plain" })], configurable: true });
    picker.dispatchEvent(new Event("change"));
    await type("Status?");

    await sendNow();
    await Wait.until(() => expect(sent()).toHaveLength(3));
    await fixture.whenStable();
    refused = [];
    await sendNow();
    await Wait.until(() => expect(box()?.value).toBe(""));

    const paths = sent().map(t => t.attachments.map(u => u.path));
    expect([context.count(MethodName.AttachmentPrepare), sent().map(t => [t.chatId, t.attachments.map(u => u.name)]), paths[3]?.[0] === paths[1]?.[0]])
      .toEqual([2, [["org-alice", ["plan.txt"]], ["org-bob", ["plan.txt"]], ["org-reviewer", ["plan.txt"]], ["org-bob", ["plan.txt"]]], false]);
  });

  it("sends again to every recipient when a retry carries other attachments", async () => {
    organization = SampleData.organizationOf([design], placed("alice", "bob", "reviewer"));
    kept = [chatOf("alice"), chatOf("bob"), chatOf("reviewer")];
    refused = ["org-bob"];
    await create(OrganizationTarget.department("d1"));
    const fanOut = fixture.debugElement.query(By.directive(ComposerComponent)).injector.get(ComposerComponent).fanOut();
    if (Object.isNull(fanOut))
      throw new Error("The panel's composer sends to no one.");
    const settings = new ComposerSettings("codex", null, null, null);
    const plan = new AttachmentInput("plan.txt", "text/plain", "cGxhbg==", null);
    const notes = new AttachmentInput("notes.txt", "text/plain", "bm90ZXM=", null);

    const first = await fanOut.send("Status?", settings, [plan], ["draft-plan"]);
    refused = [];
    const other = await fanOut.send("Status?", settings, [notes], ["draft-notes"]);

    expect([first, other, sent().map(t => [t.chatId, t.attachments.map(u => u.name)])]).toEqual([false, true, [
      ["org-alice", ["plan.txt"]], ["org-bob", ["plan.txt"]], ["org-reviewer", ["plan.txt"]],
      ["org-alice", ["notes.txt"]], ["org-bob", ["notes.txt"]], ["org-reviewer", ["notes.txt"]]]]);
  });

  it("queues the message in a recipient's chat that is replying, as that chat's own composer would, and sends the others", async () => {
    kept = [chatOf("alice"), chatOf("bob")];
    running = [reply("org-alice", MessageStatus.Running)];
    await create(OrganizationTarget.department("d1"));
    await Wait.until(() => expect(texts(".nol-teamrun-organization-recipient-status")).toEqual(["Replying", "No reply yet"]));
    await type("Status?");
    await sendNow();
    await Wait.until(() => expect(queued()).toHaveLength(1));
    await Wait.until(() => expect(sent()).toHaveLength(1));

    expect([queued().map(t => [t.message.chatId, t.message.responderTeammateId, t.message.text]), sent().map(t => t.chatId)])
      .toEqual([[["org-alice", "alice", "Status?"]], ["org-bob"]]);
  });

  it("shows each recipient's reply that ended in that recipient's own chat before the panel opened, read from the chat, whatever the teammate replied elsewhere", async () => {
    organization = SampleData.organizationOf([design], placed("alice", "bob", "reviewer"));
    kept = [chatOf("alice"), chatOf("bob"), chatOf("reviewer")];
    lastReplies = [new TeammateLastReply("bob", "c1", "r2", "Elsewhere.", SampleData.timestamp)];
    pages = new Map([["org-alice", [SampleData.userMessage, reply("org-alice", MessageStatus.Completed)]],
      ["org-bob", [reply("org-bob", MessageStatus.Failed), SampleData.userMessage]]]);
    unreadable = ["org-reviewer"];
    await create(OrganizationTarget.department("d1"));

    await Wait.until(() => expect(texts(".nol-teamrun-organization-recipient-status")).toEqual(["Replied", "No reply yet", "No reply yet"]));
    expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.MessagePage)).map(t => MessagePageParams.fromJson(t.parameters).chatId).sort())
      .toEqual(["org-alice", "org-bob", "org-reviewer"]);
  });

  it("offers the mention list in a message to one chat, and none in a message to several, after the same wait", async () => {
    const typeAndSettle = async (root: HTMLElement, text: string): Promise<void> => {
      const field = root.querySelector<HTMLTextAreaElement>("textarea");
      if (Object.isNull(field))
        throw new Error("No message box.");
      field.value = text;
      field.setSelectionRange(text.length, text.length);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      await fixture.whenStable();
    };
    const shown = (): number[] => [document.querySelectorAll(".nol-mention-name").length, document.querySelectorAll("nol-mention-list").length];
    kept = [chatOf("alice"), chatOf("bob")];
    await create(OrganizationTarget.department("d1"));
    const single = TestBed.createComponent(ComposerComponent);
    single.componentRef.setInput("conversationId", SampleData.conversation.id);
    single.autoDetectChanges();
    await single.whenStable();
    const root: unknown = single.nativeElement;
    if (!(root instanceof HTMLElement))
      throw new Error("The composer has no element.");
    await typeAndSettle(root, "@");
    const toOne = shown();
    single.destroy();
    await fixture.whenStable();

    await typeAndSettle(element(), "@");

    expect([toOne.every(t => t > 0), shown()]).toEqual([true, [0, 0]]);
  });

  it.each([
    { title: "a department, its member under its leader included", target: OrganizationTarget.department("d1"), expected: "Goes to 2 teammates" },
    { title: "the leaders and your direct reports", target: OrganizationTarget.leaders, expected: "Goes to 1 teammate" },
    { title: "everyone", target: OrganizationTarget.everyone, expected: "Goes to 2 teammates" }
  ])("says before sending how many teammates a message to $title goes to", async ({ target, expected }) => {
    organization = SampleData.organizationOf([design], [new TeammatePlacement("alice", OrganizationParent.department("d1"), 0),
      new TeammatePlacement("bob", OrganizationParent.teammate("alice"), 0)]);
    await create(target);

    await Wait.until(() => expect(texts(".nol-teamrun-composer-reach")).toEqual([expected]));
    expect(sent()).toEqual([]);
  });

  it("gives the message box the count as its description, follows a change of structure, and shows none for one teammate's chat", async () => {
    await create(OrganizationTarget.department("d1"));
    const reach = (): HTMLElement | null => element().querySelector<HTMLElement>(".nol-teamrun-composer-reach");
    await Wait.until(() => expect(reach()?.textContent?.trim()).toBe("Goes to 2 teammates"));
    const described = [box()?.getAttribute("aria-describedby"), reach()?.id];
    const shown = (found: HTMLElement | null): HTMLElement => {
      if (Object.isNull(found))
        throw new Error("The count or the message box isn't shown.");
      return found;
    };
    const [line, field] = [shown(reach()), shown(box())];
    const textStart = (on: HTMLElement): number => on.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(on).borderInlineStartWidth)
      + Number.parseFloat(getComputedStyle(on).paddingInlineStart);
    expect([textStart(line) - textStart(field), line.getBoundingClientRect().bottom <= field.getBoundingClientRect().top]).toEqual([0, true]);

    context.emit(EventName.OrganizationChanged, SampleData.organizationOf([design], placed("alice")).toJson());
    await Wait.until(() => expect(reach()?.textContent?.trim()).toBe("Goes to 1 teammate"));
    fixture.componentRef.setInput("target", OrganizationTarget.teammate("alice"));
    await Wait.until(() => expect(element().querySelector(".nol-teamrun-composer-fan-out")).toBeNull());
    await Wait.until(() => expect(box()).not.toBeNull());

    expect([described[0] === described[1], described[0]?.startsWith(Resources.composerReachIdPrefix), reach(), box()?.hasAttribute("aria-describedby")])
      .toEqual([true, true, null, false]);
  });

  it("shows no reply yet for recipients whose chats exist but who never replied", async () => {
    kept = [chatOf("alice"), chatOf("bob")];
    await create(OrganizationTarget.department("d1"));

    await Wait.until(() => expect(texts(".nol-teamrun-organization-recipient-status")).toEqual(["No reply yet", "No reply yet"]));
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
