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
import { Department, DepartmentMember, DetailKind, EventName, Message, MessageAuthor, MessageDetail, MessageIdParams, MessageStatus, MethodName, Organization,
  OrganizationMessage, OrganizationMessageSendParams, OrganizationRecipient, OrganizationRecipientState, OrganizationTarget } from "@noldova/teamrun.protocol";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { userEvent } from "vitest/browser";

import { OrganizationMessagesComponent } from "../../../../src/app/components/organization-messages/organization-messages.component";
import { OrganizationMessagesShape } from "../../../../src/app/enums/organization-messages-shape";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { OrganizationMessagesStoreService } from "../../../../src/app/services/organization-messages-store.service";
import { OrganizationStoreService } from "../../../../src/app/services/organization-store.service";
import { TimeFormatService } from "../../../../src/app/services/time-format.service";
import { Resources } from "../../../../src/resources";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import type { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("OrganizationMessagesComponent", () => {
  const design = OrganizationTarget.department("d1");
  const toAlice = OrganizationTarget.teammate("alice");
  const organization = new Organization([new Department("d1", "Design", null, "alice", 0, "c", "u"), new Department("d2", "Docs", null, null, 1, "c", "u")],
    [new DepartmentMember("alice", "d1"), new DepartmentMember("bob", "d1"), new DepartmentMember("offline", "d2")]);
  const recipient = (teammateId: string, name: string, state: OrganizationRecipientState, messageId: string | null = null, reason: string | null = null) =>
    new OrganizationRecipient(teammateId, name, state, Object.isNull(messageId) ? null : `chat-${teammateId}`, messageId, reason);
  const aliceMessage = new OrganizationMessage("o1", toAlice, "Ready?", "2026-11-20T09:00:00.000Z",
    [recipient("alice", "Alice", OrganizationRecipientState.Started, "s1")]);
  const designMessage = new OrganizationMessage("o3", design, "Ship it", "2026-11-20T09:10:00.000Z",
    [recipient("bob", "Bob", OrganizationRecipientState.Stopped), recipient("alice", "Alice", OrganizationRecipientState.Removed)]);
  const everyoneMessage = new OrganizationMessage("o2", OrganizationTarget.everyone, "Status?", "2026-11-20T09:30:00.000Z", [
    recipient("alice", "Alice", OrganizationRecipientState.Started, "s2"), recipient("bob", "Bob", OrganizationRecipientState.Queued),
    recipient("offline", "Offline", OrganizationRecipientState.Failed, null, "Signed out")]);
  const reply = (id: string, inReplyTo: string, teammateId: string, name: string, status: MessageStatus, text: string, createdAt: string): Message =>
    new Message(id, `chat-${teammateId}`, 1, MessageAuthor.Provider, inReplyTo, status, [new MessageDetail(0, DetailKind.Text, text, null, createdAt)],
      SampleData.provenance, createdAt, status === MessageStatus.Pending ? null : createdAt,
      [MessageStatus.Pending, MessageStatus.Running, MessageStatus.AwaitingApproval].includes(status) ? null : createdAt, [], teammateId, name);
  const aliceReply = reply("r1", "s1", "alice", "Alice", MessageStatus.Completed, "Hi from Alice", "2026-11-20T09:05:00.000Z");
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<OrganizationMessagesComponent>;
  let messages: readonly OrganizationMessage[];
  let replies: Record<string, readonly Message[]>;
  let sendAnswer: (parameters: JsonValue) => JsonValue | Promise<JsonValue>;
  let stopAnswer: (parameters: JsonValue) => JsonValue | Promise<JsonValue>;
  const changes: (OrganizationTarget | null)[] = [];

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const all = (selector: string): HTMLElement[] => [...element().querySelectorAll<HTMLElement>(selector)];
  const one = <T extends HTMLElement = HTMLElement>(selector: string, parent: HTMLElement = element()): T => {
    const found = parent.querySelector<T>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  };
  const row = (index: number): HTMLElement => {
    const found = all(".nol-teamrun-organization-conversation")[index];
    if (Object.isUndefined(found))
      throw new Error(`No conversation ${index}.`);
    return found;
  };
  const texts = (selector: string): string[] => all(selector).map(t => t.textContent?.trim() ?? "");
  const input = (): HTMLInputElement => one<HTMLInputElement>(".nol-teamrun-organization-input");
  const sendButton = (): HTMLButtonElement => one<HTMLButtonElement>(".nol-teamrun-organization-send");
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const create = async (target: OrganizationTarget | null, shape: OrganizationMessagesShape = OrganizationMessagesShape.Inbox,
    configure: (context: FakeWindowPartContext) => void = () => undefined): Promise<void> => {
    context = SampleData.createContext();
    const data = new TeammateFixture(context);
    data.teammates = [data.bob, data.alice, data.unavailable];
    context.answer(MethodName.OrganizationList, () => organization.toJson())
      .answer(MethodName.OrganizationMessageList, () => messages.map(t => t.toJson()))
      .answer(MethodName.OrganizationMessageReplyList, t => (replies[MessageIdParams.fromJson(t).messageId] ?? []).map(u => u.toJson()))
      .answer(MethodName.OrganizationMessageSend, t => sendAnswer(t))
      .answer(MethodName.OrganizationMessageStop, t => stopAnswer(t));
    configure(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, ChatStoreService.provider] });
    fixture = TestBed.createComponent(OrganizationMessagesComponent);
    fixture.componentRef.setInput("target", target);
    fixture.componentRef.setInput("shape", shape);
    fixture.componentInstance.target.subscribe(t => changes.push(t));
    element().style.height = "40rem";
    fixture.autoDetectChanges();
    await Wait.until(() => expect(ChatStoreService.of(context).teammates()).toHaveLength(3));
    await Wait.until(() => expect(OrganizationStoreService.of(context).organization().departments).toHaveLength(1));
    await settle();
  };

  beforeEach(() => {
    messages = [aliceMessage, designMessage, everyoneMessage];
    replies = { o1: [aliceReply], o2: [reply("r2", "s2", "alice", "Alice", MessageStatus.Running, "Working", "2026-11-20T09:31:00.000Z")] };
    sendAnswer = () => aliceMessage.toJson();
    stopAnswer = () => everyoneMessage.toJson();
    changes.length = 0;
  });

  afterEach(async () => {
    await fixture?.whenStable();
    OrganizationMessagesStoreService.release(context);
    OrganizationStoreService.release(context);
    ChatStoreService.release(context);
  });

  it("has an inbox shape and a thread shape", () => {
    expect(Object.values(OrganizationMessagesShape)).toEqual(["Inbox", "Thread"]);
  });

  it("lists each conversation, the latest first, with its title, time and last line, and opens one on a click", async () => {
    await create(null);
    const times = TestBed.inject(TimeFormatService);

    await Wait.until(() => expect(texts(".nol-teamrun-organization-conversation-line")).toEqual(["You: Status?", "You: Ship it", "Alice: Hi from Alice"]));
    expect(texts(".nol-teamrun-organization-conversation-title")).toEqual(["Everyone", "Design", "Alice"]);
    expect(texts(".nol-teamrun-organization-conversation-time")).toEqual([times.shortDateTime(everyoneMessage.createdAt),
      times.shortDateTime(designMessage.createdAt), times.shortDateTime(aliceReply.createdAt)]);
    expect(texts(".nol-teamrun-organization-group-icon")).toEqual([Resources.organizationGroupIcon, Resources.organizationDepartmentIcon]);
    expect(all(".nol-teamrun-organization-conversation nol-teamrun-teammate-avatar")).toHaveLength(1);
    expect(one(".nol-teamrun-organization-unread").textContent?.trim()).toBe(Resources.organizationAllRead);
    expect(texts(".nol-teamrun-organization-empty")).toEqual([Resources.organizationChooseTarget]);
    expect(input().disabled).toBe(true);
    expect(all("nol-select, .nol-teamrun-organization-count")).toHaveLength(0);

    await userEvent.click(row(1));
    await settle();

    expect(changes.at(-1)?.equals(design)).toBe(true);
    expect(row(1).getAttribute("aria-current")).toBe("true");
    expect(one(".nol-teamrun-organization-thread-title").textContent?.trim()).toBe("Design");
  });

  it.each([
    [OrganizationMessagesShape.Inbox, [Resources.organizationNoMessages, Resources.organizationInboxEmpty]],
    [OrganizationMessagesShape.Thread, [Resources.organizationThreadEmpty]]
  ])("says when no message was sent yet in the %s shape's words", async (shape, shown) => {
    messages = [];
    await create(toAlice, shape);

    expect(texts(".nol-teamrun-organization-empty")).toEqual(shown);
    expect(input().placeholder).toBe(Resources.formatOrganizationPlaceholder("Alice"));
  });

  it.each([
    ["a teammate with a role", toAlice, "Alice", "Review"],
    ["a teammate without one", OrganizationTarget.teammate("bob"), "Bob", Resources.organizationTeammateNote],
    ["a removed teammate never written to", OrganizationTarget.teammate("ghost"), Resources.organizationRemovedTeammate, Resources.organizationTeammateNote],
    ["a department", design, "Design", Resources.formatOrganizationDepartmentNote("Alice", ["Bob"])],
    ["a department without a leader", OrganizationTarget.department("d2"), "Docs", Resources.formatOrganizationDepartmentNote(null, ["Offline"])],
    ["a deleted department", OrganizationTarget.department("gone"), Resources.organizationDeletedDepartment, Resources.formatOrganizationDepartmentNote(null, [])],
    ["every leader", OrganizationTarget.leaders, Resources.organizationLeadersTitle, Resources.formatOrganizationLeadersNote(["Alice"])],
    ["everyone", OrganizationTarget.everyone, Resources.organizationEveryoneTitle, Resources.formatOrganizationEveryoneNote(["Bob", "Alice", "Offline"])]
  ])("names %s in the thread's head, with the teammates a message reaches in its note", async (_, target, title, note) => {
    await create(target);
    await Wait.until(() => expect(texts(".nol-teamrun-organization-conversation-title")).toHaveLength(3));

    expect(one(".nol-teamrun-organization-thread-title").textContent?.trim()).toBe(title);
    expect(one(".nol-teamrun-organization-thread-note").textContent?.trim()).toBe(note);
    expect(all(".nol-teamrun-organization-thread-icon")).toHaveLength(0);
  });

  it("names a removed teammate's conversation by the name its message kept", async () => {
    messages = [new OrganizationMessage("o7", OrganizationTarget.teammate("gone"), "Hello", "2026-11-20T08:00:00.000Z",
      [recipient("gone", "Gina", OrganizationRecipientState.Removed)])];
    await create(OrganizationTarget.teammate("gone"));

    expect(texts(".nol-teamrun-organization-conversation-title")).toEqual(["Gina"]);
    expect(one(".nol-teamrun-organization-thread-title").textContent?.trim()).toBe("Gina");
    expect(texts(".nol-teamrun-organization-delivery-line")).toEqual([Resources.formatOrganizationRecipients(OrganizationRecipientState.Removed, ["Gina"])]);
  });

  it("sends the trimmed text on Enter, clears the field, and keeps Send off while the text is blank or nobody would get it", async () => {
    sendAnswer = t => new OrganizationMessage("o9", OrganizationMessageSendParams.fromJson(t).target, "Hello", "2026-11-20T10:00:00.000Z",
      [recipient("alice", "Alice", OrganizationRecipientState.Queued)]).toJson();
    await create(OrganizationTarget.leaders);
    expect(sendButton().disabled).toBe(true);

    await userEvent.type(input(), "  ");
    await settle();
    expect(sendButton().disabled).toBe(true);
    await userEvent.type(input(), "Hello {Enter}");
    await Wait.until(() => expect(input().value).toBe(""));

    expect(context.parametersOf(MethodName.OrganizationMessageSend)).toEqual(new OrganizationMessageSendParams(OrganizationTarget.leaders, "Hello").toJson());
    expect(texts(".nol-teamrun-organization-entry .nol-teamrun-organization-delivery-line"))
      .toEqual([Resources.formatOrganizationRecipients(OrganizationRecipientState.Queued, ["Alice"])]);

    fixture.componentRef.setInput("target", OrganizationTarget.department("gone"));
    await userEvent.type(input(), "Again");
    await settle();
    expect(sendButton().disabled).toBe(true);
    one(".nol-teamrun-organization-composer").dispatchEvent(new Event("submit"));
    await settle();
    expect(context.count(MethodName.OrganizationMessageSend)).toBe(1);
  });

  it("keeps text typed while a send was on its way, and clears only the text it sent", async () => {
    const answer = new DeferredResponse();
    sendAnswer = () => answer.promise;
    await create(toAlice);

    await userEvent.type(input(), "Hello{Enter}");
    await Wait.until(() => expect(context.count(MethodName.OrganizationMessageSend)).toBe(1));
    await userEvent.type(input(), " again");
    answer.resolve(aliceMessage.toJson());
    await Wait.until(() => expect(sendButton().disabled).toBe(false));

    expect(input().value).toBe("Hello again");
  });

  it("stops a message while its send is still on its way, and shows it stopped once the send answers", async () => {
    const answer = new DeferredResponse();
    const queued = new OrganizationMessage("o9", OrganizationTarget.leaders, "Hello", "2026-11-20T10:00:00.000Z", [recipient("alice", "Alice", OrganizationRecipientState.Queued)]);
    const stopped = queued.withRecipient(recipient("alice", "Alice", OrganizationRecipientState.Stopped));
    sendAnswer = () => answer.promise;
    stopAnswer = () => stopped.toJson();
    await create(OrganizationTarget.leaders);

    await userEvent.type(input(), "Hello{Enter}");
    context.emit(EventName.OrganizationMessageUpdated, queued.toJson());
    await settle();
    await userEvent.click(one(".nol-teamrun-organization-stop"));
    await Wait.until(() => expect(all(".nol-teamrun-organization-stop")).toHaveLength(0));
    answer.resolve(stopped.toJson());
    await Wait.until(() => expect(input().value).toBe(""));

    expect(context.parametersOf(MethodName.OrganizationMessageStop)).toEqual(new MessageIdParams("o9").toJson());
    expect(texts(".nol-teamrun-organization-delivery-line")).toEqual([Resources.formatOrganizationRecipients(OrganizationRecipientState.Stopped, ["Alice"])]);
  });

  it("offers Stop while a recipient's reply hasn't started", async () => {
    messages = [new OrganizationMessage("o2", OrganizationTarget.everyone, "Status?", "2026-11-20T09:30:00.000Z", [recipient("bob", "Bob", OrganizationRecipientState.Started, "s4")])];
    replies = { o2: [reply("r3", "s4", "bob", "Bob", MessageStatus.Pending, "", "2026-11-20T09:31:00.000Z")] };
    await create(OrganizationTarget.everyone);

    await Wait.until(() => expect(all(".nol-teamrun-organization-stop")).toHaveLength(1));
    context.emit(EventName.MessageUpdated, reply("r3", "s4", "bob", "Bob", MessageStatus.Running, "On it", "2026-11-20T09:31:00.000Z").toJson());
    await settle();

    expect(all(".nol-teamrun-organization-stop")).toHaveLength(0);
  });

  it.each([
    ["an error", (): Promise<JsonValue> => Promise.reject(new Error("runtime down"))],
    ["a string", (): Promise<JsonValue> => Promise.reject("runtime down")]
  ])("keeps the text and says why when a send fails with %s", async (_, answer) => {
    sendAnswer = answer;
    await create(toAlice);

    await userEvent.type(input(), "Hello{Enter}");

    await Wait.until(() => expect(one(".nol-teamrun-organization-error").textContent?.trim()).toBe(Resources.formatOrganizationSendFailed("runtime down")));
    expect(input().value).toBe("Hello");
    expect(sendButton().disabled).toBe(false);
  });

  it("says whom each message reached, stopped, lost or failed, and why, and stops the ones still waiting", async () => {
    await create(OrganizationTarget.everyone);

    expect(texts(".nol-teamrun-organization-delivery-line")).toEqual([
      Resources.formatOrganizationRecipients(OrganizationRecipientState.Started, ["Alice"]),
      Resources.formatOrganizationRecipients(OrganizationRecipientState.Queued, ["Bob"]),
      Resources.formatOrganizationRecipients(OrganizationRecipientState.Failed, ["Offline"])]);
    expect(texts(".nol-teamrun-organization-failure")).toEqual([Resources.formatOrganizationFailure("Offline", "Signed out")]);
    stopAnswer = () => everyoneMessage.withRecipient(recipient("bob", "Bob", OrganizationRecipientState.Stopped)).toJson();

    await userEvent.click(one(".nol-teamrun-organization-stop"));

    await Wait.until(() => expect(all(".nol-teamrun-organization-stop")).toHaveLength(0));
    expect(context.parametersOf(MethodName.OrganizationMessageStop)).toEqual(new MessageIdParams("o2").toJson());
    expect(texts(".nol-teamrun-organization-delivery-line")).toContain(Resources.formatOrganizationRecipients(OrganizationRecipientState.Stopped, ["Bob"]));
  });

  it.each([
    ["an error", (): Promise<JsonValue> => Promise.reject(new Error("refused"))],
    ["a string", (): Promise<JsonValue> => Promise.reject("refused")]
  ])("says why a stop failed with %s", async (_, answer) => {
    stopAnswer = answer;
    await create(OrganizationTarget.everyone);

    await userEvent.click(one(".nol-teamrun-organization-stop"));

    await Wait.until(() => expect(one(".nol-teamrun-organization-error").textContent?.trim()).toBe(Resources.formatOrganizationStopFailed("refused")));
  });

  it("shows each reply under its message, and who is still replying until each reply ends", async () => {
    const at = (id: string): string => id === "r2" ? "2026-11-20T09:31:00.000Z" : "2026-11-20T09:32:00.000Z";
    const update = async (id: string, status: MessageStatus, text: string = ""): Promise<void> => {
      context.emit(EventName.MessageUpdated, reply(id, id === "r2" ? "s2" : "s4", id === "r2" ? "alice" : "bob", id === "r2" ? "Alice" : "Bob", status, text, at(id)).toJson());
      await settle();
    };
    replies = { o2: [reply("r2", "s2", "alice", "Alice", MessageStatus.Pending, "", at("r2")), reply("r3", "s4", "bob", "Bob", MessageStatus.AwaitingApproval, "", at("r3"))] };
    messages = [everyoneMessage.withRecipient(recipient("bob", "Bob", OrganizationRecipientState.Started, "s4"))];
    await create(OrganizationTarget.everyone);
    await Wait.until(() => expect(one(".nol-teamrun-organization-replying").textContent?.trim()).toBe(Resources.formatOrganizationReplying(["Alice", "Bob"])));

    expect(all(".nol-teamrun-organization-entry nol-message")).toHaveLength(1);
    await update("r2", MessageStatus.Running, "Working");
    expect(all(".nol-teamrun-organization-entry nol-message")).toHaveLength(1);
    expect(texts(".nol-teamrun-organization-conversation-line")).toEqual(["You: Status?"]);
    await update("r3", MessageStatus.Cancelled);
    expect(one(".nol-teamrun-organization-replying").textContent?.trim()).toBe(Resources.formatOrganizationReplying(["Alice"]));
    expect(all(".nol-teamrun-organization-entry nol-message")).toHaveLength(2);
    await update("r3", MessageStatus.Interrupted);
    await update("r3", MessageStatus.Failed);
    await update("r2", MessageStatus.Completed, "All good");

    expect(all(".nol-teamrun-organization-replying")).toHaveLength(0);
    expect(all(".nol-teamrun-organization-entry nol-message")).toHaveLength(3);
    expect(texts(".nol-teamrun-organization-entry nol-message")[1]).toContain("All good");
    expect(texts(".nol-teamrun-organization-conversation-line")).toEqual(["Alice: All good"]);
  });

  it("counts a reply to another conversation as unread until that conversation opens", async () => {
    await create(toAlice);

    context.emit(EventName.MessageUpdated, reply("r2", "s2", "alice", "Alice", MessageStatus.Completed, "Done", "2026-11-20T09:40:00.000Z").toJson());
    context.emit(EventName.MessageUpdated, reply("r5", "s1", "alice", "Alice", MessageStatus.Completed, "Again", "2026-11-20T09:41:00.000Z").toJson());
    await settle();

    expect(one(".nol-teamrun-organization-unread").textContent?.trim()).toBe(Resources.formatOrganizationUnread(1));
    expect(all(".nol-teamrun-organization-conversation nol-chip")).toHaveLength(1);
    await userEvent.click(row(0));
    await settle();

    expect(one(".nol-teamrun-organization-unread").textContent?.trim()).toBe(Resources.organizationAllRead);
    expect(all(".nol-teamrun-organization-conversation nol-chip")).toHaveLength(0);
  });

  it.each([
    ["a teammate", toAlice, Resources.formatOrganizationChat("Alice"), Resources.formatOrganizationOnlyNote("Alice")],
    ["a department", design, Resources.formatOrganizationChat("Design"), Resources.formatOrganizationDepartmentNote("Alice", ["Bob"])],
    ["every leader", OrganizationTarget.leaders, Resources.organizationLeadersChat, Resources.formatOrganizationLeadersNote(["Alice"])],
    ["everyone", OrganizationTarget.everyone, Resources.formatOrganizationChat(Resources.organizationEveryoneTitle),
      Resources.formatOrganizationEveryoneNote(["Bob", "Alice", "Offline"])]
  ])("names the chat with %s in the thread shape's head", async (_, target, title, note) => {
    await create(target, OrganizationMessagesShape.Thread);

    expect(one(".nol-teamrun-organization-thread-title").textContent?.trim()).toBe(title);
    expect(one(".nol-teamrun-organization-thread-note").textContent?.trim()).toBe(note);
    expect(one(".nol-teamrun-organization-thread-wrap").getAttribute("aria-label")).toBe(title);
  });

  it("shows only the thread and its field in the thread shape", async () => {
    await create(toAlice, OrganizationMessagesShape.Thread);

    await Wait.until(() => expect(texts(".nol-teamrun-organization-entry nol-message")[1]).toContain("Hi from Alice"));
    expect(all(".nol-teamrun-organization-conversations, .nol-teamrun-organization-inbox-head")).toHaveLength(0);
    expect(one(".nol-teamrun-organization-thread-icon").textContent?.trim()).toBe(Resources.organizationGroupIcon);
  });

  it.each([
    ["messages", MethodName.OrganizationMessageList, ".nol-teamrun-organization-thread-wrap > .nol-teamrun-organization-error"],
    ["replies", MethodName.OrganizationMessageReplyList, ".nol-teamrun-organization-entry > .nol-teamrun-organization-error"]
  ])("says why the %s couldn't be read, where they would show", async (_, method, selector) => {
    await create(OrganizationTarget.everyone, OrganizationMessagesShape.Inbox, t => t.fail(method, "runtime down"));

    await Wait.until(() => expect(one(selector).textContent?.trim()).toBe("runtime down"));
  });

  describe.each([
    { look: "light", mode: ThemeMode.Light },
    { look: "dark", mode: ThemeMode.Dark }
  ])("in $look", ({ mode }) => {
    const box = (target: Element): DOMRect => target.getBoundingClientRect();
    const rem = (value: number): number => value * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    it("fills its host, puts the unread count at the head's end, rounds the group icons and keeps the field and the filled Send on one line at the bottom", async () => {
      await create(OrganizationTarget.everyone);
      const host = box(element());
      const head = box(one(".nol-teamrun-organization-inbox-head"));
      const title = box(one(".nol-teamrun-organization-inbox-title"));
      const unread = box(one(".nol-teamrun-organization-unread"));
      const list = box(one(".nol-teamrun-organization-conversations"));
      const first = row(0);
      const icon = one(".nol-teamrun-organization-conversation .nol-teamrun-organization-group-icon");
      const avatar = box(one(".nol-teamrun-organization-conversation nol-teamrun-teammate-avatar nol-avatar"));
      const wrap = box(one(".nol-teamrun-organization-thread-wrap"));
      const field = box(input());
      const send = box(sendButton());

      AppearanceFixture.expectPixels(host.height, rem(40));
      AppearanceFixture.expectPixels(title.left - head.left, AppearanceFixture.measureLook("space-3"));
      AppearanceFixture.expectPixels(head.right - unread.right, AppearanceFixture.measureLook("space-3"));
      AppearanceFixture.expectPixels(unread.top + unread.height / 2, title.top + title.height / 2);
      expect(list.height).toBeLessThanOrEqual(host.height * 0.4 + 1);
      AppearanceFixture.expectPixels(box(first).left - list.left, AppearanceFixture.measureLook("space-1"));
      AppearanceFixture.expectPixels(box(icon).left - box(first).left, AppearanceFixture.measureLook("space-2"));
      AppearanceFixture.expectPixels(box(icon).width, AppearanceFixture.measureLook("avatar"));
      AppearanceFixture.expectPixels(box(icon).height, AppearanceFixture.measureLook("avatar"));
      AppearanceFixture.expectPixels(avatar.width, AppearanceFixture.measureLook("avatar"));
      expect(getComputedStyle(icon).borderRadius).toBe("50%");
      expect(getComputedStyle(icon).backgroundColor).toBe(getComputedStyle(first).backgroundColor);
      AppearanceFixture.expectPixels(wrap.bottom, host.bottom);
      AppearanceFixture.expectPixels(wrap.bottom - field.bottom, AppearanceFixture.measureLook("space-3"));
      AppearanceFixture.expectPixels(field.left - wrap.left, AppearanceFixture.measureLook("space-3"));
      AppearanceFixture.expectPixels(wrap.right - send.right, AppearanceFixture.measureLook("space-3"));
      AppearanceFixture.expectPixels(send.left - field.right, AppearanceFixture.measureLook("space-2"));
      AppearanceFixture.expectPixels(send.width, AppearanceFixture.measureLook("button-height"));
      AppearanceFixture.expectPixels(send.height, AppearanceFixture.measureLook("button-height"));
      AppearanceFixture.expectPixels(field.top + field.height / 2, send.top + send.height / 2);
      expect(getComputedStyle(first).backgroundColor).not.toBe(getComputedStyle(row(1)).backgroundColor);
    });

    it("puts the thread's title and note on one line, each message's avatar beside its text, and the spacing between a message and its delivery", async () => {
      await create(toAlice);
      await Wait.until(() => expect(all(".nol-teamrun-organization-entry nol-message")).toHaveLength(2));
      const title = box(one(".nol-teamrun-organization-thread-title"));
      const note = box(one(".nol-teamrun-organization-thread-note"));
      const sent = one(".nol-teamrun-organization-entry nol-message");
      const delivery = box(one(".nol-teamrun-organization-delivery"));

      AppearanceFixture.expectPixels(note.left - title.right, AppearanceFixture.measureLook("space-2"));
      expect(note.top).toBeLessThan(title.bottom);
      AppearanceFixture.expectPixels(delivery.top - box(sent).bottom, AppearanceFixture.measureLook("space-3"));
      for (const message of all(".nol-teamrun-organization-entry nol-message")) {
        const avatar = box(one(".nol-message-avatar", message));
        const content = box(one(".nol-message-content", message));
        expect(avatar.right).toBeLessThan(content.left);
        expect(content.top).toBeLessThan(avatar.bottom);
      }
    });

    it("puts the group icon before the title and the note at the head's end in the thread shape", async () => {
      await create(OrganizationTarget.everyone, OrganizationMessagesShape.Thread);
      const wrap = box(one(".nol-teamrun-organization-thread-wrap"));
      const icon = box(one(".nol-teamrun-organization-thread-icon"));
      const title = box(one(".nol-teamrun-organization-thread-title"));
      const note = box(one(".nol-teamrun-organization-thread-note"));

      AppearanceFixture.expectPixels(icon.left - wrap.left, AppearanceFixture.measureLook("space-3"));
      AppearanceFixture.expectPixels(title.left - icon.right, AppearanceFixture.measureLook("space-2"));
      AppearanceFixture.expectPixels(wrap.right - note.right, AppearanceFixture.measureLook("space-3"));
      AppearanceFixture.expectPixels(icon.width, AppearanceFixture.measureLook("icon"));
      AppearanceFixture.expectPixels(note.top + note.height / 2, title.top + title.height / 2);
      await Wait.until(() => expect(all(".nol-teamrun-organization-thread > .nol-teamrun-organization-replying")).toHaveLength(1));
      const thread = box(one(".nol-teamrun-organization-thread"));
      const replying = box(one(".nol-teamrun-organization-replying"));
      expect(replying.top).toBeGreaterThanOrEqual(thread.top);
      expect(replying.bottom).toBeLessThanOrEqual(thread.bottom);

      element().style.height = "8rem";
      await settle();

      AppearanceFixture.expectPixels(box(one(".nol-teamrun-organization-thread")).height, AppearanceFixture.measureLook("space-6") * 4);
    });
  });
});
