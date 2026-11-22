/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { Conversation, ConversationListParams, DetailKind, EventName, Message, MessageAuthor, MessagePageParams, MessageStatus, MethodName,
  OrganizationChat } from "@noldova/teamrun.protocol";

import { OrganizationChatsComponent } from "../../../../src/app/components/organization-chats/organization-chats.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { Resources } from "../../../../src/resources";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("OrganizationChatsComponent", () => {
  const chatOf = (teammateId: string, updatedAt: string, projectId: string | null = null): Conversation => new Conversation(`org-${teammateId}`, projectId,
    `Organization · ${teammateId}`,
    SampleData.timestamp, updatedAt, false, null, null, false, null, false, [], false, false, null, new OrganizationChat("my-organization", teammateId));
  const said = (chatId: string, sequence: number, author: MessageAuthor, text: string, status: MessageStatus = MessageStatus.Completed): Message =>
    SampleData.withStatus(new Message(`${chatId}-${sequence}`, chatId, sequence, author, null, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, text)],
      author === MessageAuthor.User ? null : SampleData.provenance, SampleData.timestamp, null, SampleData.timestamp), status);
  const lastOf: ReadonlyMap<string, Message> = new Map([["org-alice", said("org-alice", 0, MessageAuthor.User, "Status?")],
    ["org-bob", said("org-bob", 1, MessageAuthor.Provider, "Done.")]]);
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<OrganizationChatsComponent>;
  let chosen: string[];
  let aliceWorksIn: string | null;
  let unreadable: readonly string[];
  let more: readonly Conversation[];

  const element = (): HTMLElement => {
    const native: unknown = fixture.nativeElement;
    if (!(native instanceof HTMLElement))
      throw new Error("The fixture has no element.");
    return native;
  };
  const texts = (selector: string): string[] => [...element().querySelectorAll(selector)].map(t => t.textContent?.trim() ?? "");
  const rows = (): unknown[] => [texts(".nol-teamrun-organization-conversation-title"), texts(".nol-teamrun-organization-conversation-line"),
    texts(".nol-teamrun-organization-conversation-time"), texts(".nol-teamrun-organization-conversation nol-chip"), texts(".nol-teamrun-organization-unread")];
  const create = async (selectedTeammateId: string | null, lines: readonly string[] = ["Bob: Done.", "You: Status?"]): Promise<void> => {
    context = SampleData.createContext();
    new TeammateFixture(context);
    context.answer(MethodName.ConversationList, t => {
      const projectId = ConversationListParams.fromJson(t).projectId;
      const chats = [chatOf("alice", "2026-09-11T08:00:00.000Z", aliceWorksIn), chatOf("bob", "2026-09-12T08:00:00.000Z"),
        new Conversation("free", null, "Free", SampleData.timestamp, "2026-09-13T08:00:00.000Z"), ...more];
      return [...Object.isNull(projectId) ? [] : [SampleData.conversation], ...chats.filter(u => u.projectId === projectId)].map(u => u.toJson());
    })
      .answer(MethodName.MessagePage, t => {
        const conversationId = MessagePageParams.fromJson(t).conversationId;
        if (unreadable.includes(conversationId))
          return Promise.reject(new Error("Not read."));
        const last = lastOf.get(conversationId);
        return SampleData.page(Object.isUndefined(last) ? [] : [last], false, false).toJson();
      });
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, ChatStoreService.provider] });
    fixture = TestBed.createComponent(OrganizationChatsComponent);
    fixture.componentRef.setInput("selectedTeammateId", selectedTeammateId);
    fixture.componentInstance.chosen.subscribe(t => chosen.push(t));
    fixture.autoDetectChanges();
    await Wait.until(() => expect(texts(".nol-teamrun-organization-conversation-line")).toEqual(lines));
  };

  beforeEach(() => {
    chosen = [];
    aliceWorksIn = null;
    unreadable = [];
    more = [];
  });

  afterEach(() => ChatStoreService.release(context));

  it("reads a chat's last message again when the chats are read again after its read failed", async () => {
    unreadable = ["org-alice"];
    await create(null, ["Bob: Done.", ""]);
    unreadable = [];

    context.emit(EventName.StateInvalidated, null);

    await Wait.until(() => expect(texts(".nol-teamrun-organization-conversation-line")).toEqual(["Bob: Done.", "You: Status?"]));
  });

  it("names a removed teammate's chat, shows no line for an empty chat, and counts no reply that ends outside the Organization chats", async () => {
    more = [chatOf("carol", "2026-09-10T08:00:00.000Z")];
    await create(null, ["Bob: Done.", "You: Status?", ""]);
    const elsewhere = said("free", 0, MessageAuthor.Provider, "Elsewhere", MessageStatus.Running);
    const carol = said("org-carol", 0, MessageAuthor.Provider, "Hi", MessageStatus.Running);

    context.emit(EventName.MessageCreated, elsewhere.toJson());
    context.emit(EventName.MessageCreated, carol.toJson());
    context.emit(EventName.MessageUpdated, SampleData.withStatus(elsewhere, MessageStatus.Completed).toJson());
    context.emit(EventName.MessageUpdated, SampleData.withStatus(carol, MessageStatus.Completed).toJson());
    await Wait.until(() => expect(texts(".nol-teamrun-organization-unread")).toEqual(["1 unread"]));

    expect([texts(".nol-teamrun-organization-conversation-title"), texts(".nol-teamrun-organization-conversation-line")]).toEqual([
      ["Bob", "Alice", Resources.organizationRemovedTeammate],
      ["Bob: Done.", "You: Status?", Resources.formatOrganizationLastLine(Resources.organizationRemovedTeammate, "Hi")]]);
  });

  it("lists each Organization chat, the newest first, with its teammate and who said its last message, and chooses a chat's teammate", async () => {
    await create(null);

    expect(rows()).toEqual([["Bob", "Alice"], ["Bob: Done.", "You: Status?"], expect.any(Array), [], ["All read"]]);
    expect([context.count(MethodName.MessagePage), element().querySelector("[aria-current]")]).toEqual([2, null]);
    element().querySelectorAll<HTMLButtonElement>(".nol-teamrun-organization-conversation")[1]?.click();
    expect(chosen).toEqual(["alice"]);
  });

  it("lists a teammate's Organization chat that was moved into a project", async () => {
    aliceWorksIn = SampleData.project.id;
    await create("alice");

    expect([texts(".nol-teamrun-organization-conversation-title"), texts("[aria-current] .nol-teamrun-organization-conversation-title")]).toEqual([["Bob", "Alice"], ["Alice"]]);
  });

  it("shows a running reply's status, counts a reply that ends in a chat not chosen as unread with its text, and clears it once that chat is chosen", async () => {
    await create("alice");
    const running = said("org-bob", 2, MessageAuthor.Provider, "Working", MessageStatus.Running);
    const mine = said("org-alice", 1, MessageAuthor.Provider, "Fine", MessageStatus.Running);

    context.emit(EventName.MessageCreated, running.toJson());
    context.emit(EventName.MessageCreated, mine.toJson());
    await Wait.until(() => expect(texts(".nol-teamrun-organization-conversation-time")).toEqual(["Replying", "Replying"]));
    context.emit(EventName.MessageUpdated, SampleData.withStatus(running, MessageStatus.Completed).toJson());
    context.emit(EventName.MessageUpdated, SampleData.withStatus(mine, MessageStatus.Completed).toJson());
    await Wait.until(() => expect(texts(".nol-teamrun-organization-unread")).toEqual(["1 unread"]));

    expect([texts(".nol-teamrun-organization-conversation-line"), texts(".nol-teamrun-organization-conversation nol-chip"),
      element().querySelector("[aria-current]")?.textContent?.includes("Alice")]).toEqual([["Bob: Working", "Alice: Fine"], ["1"], true]);
    fixture.componentRef.setInput("selectedTeammateId", "bob");
    await Wait.until(() => expect(texts(".nol-teamrun-organization-unread")).toEqual(["All read"]));
    expect(texts(".nol-teamrun-organization-conversation nol-chip")).toEqual([]);
  });
});
