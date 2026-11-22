/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";

import { EventName, Message, MessageAuthor, MessageSendAbandonedPayload, MessageSender, MessageSendingPayload, MessageStatus } from "@noldova/teamrun.protocol";

import { OrganizationFlowService } from "../../../src/app/services/organization-flow.service";
import { Resources } from "../../../src/resources";
import { FakeClock } from "../../fixtures/fake-clock.fixture";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../fixtures/sample-data.fixture";

describe("OrganizationFlowService", () => {
  const at = SampleData.timestamp;
  const asked = new Message("m1", "c1", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, at, null, at);
  const sent = new Message("m2", "c2", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, at, null, at, [], null, null, [],
    new MessageSender("c3", "grok", "Grok"));
  const open = [MessageStatus.Pending, MessageStatus.Running, MessageStatus.AwaitingApproval];
  const replyOf = (id: string, to: Message, teammateId: string, status: MessageStatus): Message =>
    new Message(id, to.chatId, 1, MessageAuthor.Provider, to.id, status, [], SampleData.provenance, at, status === MessageStatus.Pending ? null : at,
      open.includes(status) ? null : at, [], teammateId, teammateId);
  const reduced = signal(false);
  let context: FakeWindowPartContext;
  let clock: FakeClock;
  let service: OrganizationFlowService;
  const send = (...messages: readonly Message[]): void => {
    for (const message of messages)
      context.emit(EventName.MessageUpdated, message.toJson());
  };
  const shown = (): string[] => service.flows().map(t => `${t.id} ${t.fromKey}>${t.toKey} ${t.stage}`);
  const receivers = new Map([["c2", "opus"], ["c3", "grok"]]);
  const receiverOf = (chatId: string): string | null => receivers.get(chatId) ?? null;
  const sending = (sendId: string, toChatId: string): void =>
    context.emit(EventName.MessageSending, new MessageSendingPayload(sendId, "c3", "grok", toChatId).toJson());

  beforeEach(() => {
    reduced.set(false);
    context = new FakeWindowPartContext();
    clock = new FakeClock(0);
    service = OrganizationFlowService.of(context, reduced, clock, receiverOf);
  });

  afterEach(() => {
    OrganizationFlowService.release(context);
  });

  it("shows the person's message writing until its teammate starts, then sent, and the answer writing until it completes", () => {
    context.emit(EventName.MessageCreated, asked.toJson());
    send(replyOf("r1", asked, "opus", MessageStatus.Pending));
    const waiting = shown();
    send(replyOf("r1", asked, "opus", MessageStatus.Running));
    const started = shown();
    service.arrive("r1:in");
    service.arrive("r1:out");
    const arrived = shown();
    service.finish("r1:in");
    send(replyOf("r1", asked, "opus", MessageStatus.Running), replyOf("r1", asked, "opus", MessageStatus.Completed),
      replyOf("r1", asked, "opus", MessageStatus.Completed));

    expect([waiting, started, arrived]).toEqual([["r1:in person>opus Writing"], ["r1:in person>opus Sent", "r1:out opus>person Writing"],
      ["r1:in person>opus Arrived", "r1:out opus>person Writing"]]);
    expect(shown()).toEqual(["r1:out opus>person Sent"]);
  });

  it("sends a teammate's message to another teammate at once, once, and leaves a moving flow when asked to finish it", () => {
    send(sent, replyOf("r2", sent, "opus", MessageStatus.Pending));
    const first = shown();
    service.finish("r2:in");
    const kept = shown();
    service.arrive("r2:in");
    service.finish("r2:in");
    send(replyOf("r2", sent, "opus", MessageStatus.Pending));

    expect([first, kept, shown()]).toEqual([["r2:in grok>opus Sent"], ["r2:in grok>opus Sent"], []]);
  });

  it("shows a teammate's send writing from its start to the chat's teammate, then sent once its message arrives, with no second pulse from the reply", () => {
    sending("send-1", "c2");
    const writing = shown();
    context.emit(EventName.MessageCreated, sent.toJson());
    const delivered = shown();
    send(replyOf("r2", sent, "opus", MessageStatus.Pending), replyOf("r2", sent, "opus", MessageStatus.Running));

    expect([writing, delivered]).toEqual([["send:send-1 grok>opus Writing"], ["send:send-1 grok>opus Sent"]]);
    expect(shown()).toEqual(["send:send-1 grok>opus Sent", "r2:out opus>grok Writing"]);
  });

  it("settles a teammate's send only on its own message to its chat, not on another sender's message there or its message to another chat", () => {
    const elsewhere = new Message("m3", "c4", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, at, null, at, [], null, null, [],
      new MessageSender("c3", "grok", "Grok"));
    const byPerson = new Message("m4", "c2", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, at, null, at);
    sending("send-1", "c2");
    context.emit(EventName.MessageCreated, elsewhere.toJson());
    context.emit(EventName.MessageCreated, byPerson.toJson());
    const waiting = shown().filter(t => t.startsWith("send:"));
    context.emit(EventName.MessageCreated, sent.toJson());

    expect([waiting, shown().filter(t => t.startsWith("send:"))]).toEqual([["send:send-1 grok>opus Writing"], ["send:send-1 grok>opus Sent"]]);
  });

  it("ends a teammate's send nobody draws once its pulse and glow, or its fade, would have ended", () => {
    sending("send-6", "c2");
    sending("send-7", "c2");
    context.emit(EventName.MessageCreated, sent.toJson());
    context.emit(EventName.MessageSendAbandoned, new MessageSendAbandonedPayload("send-7").toJson());
    clock.advance(Resources.organizationFlowFadeDuration);
    const faded = shown();
    clock.advance(Resources.organizationFlowPulseDuration + Resources.organizationFlowGlowDuration);

    expect([faded, shown()]).toEqual([["send:send-6 grok>opus Sent"], []]);
  });

  it("fades a send its teammate abandons, and shows none to a chat without a teammate, to the sender itself, for an unknown send or while hidden", () => {
    sending("send-2", "c2");
    context.emit(EventName.MessageSendAbandoned, new MessageSendAbandonedPayload("send-2").toJson());
    context.emit(EventName.MessageSendAbandoned, new MessageSendAbandonedPayload("send-2").toJson());
    context.emit(EventName.MessageSendAbandoned, new MessageSendAbandonedPayload("never").toJson());
    sending("send-3", "c9");
    sending("send-4", "c3");
    reduced.set(true);
    sending("send-5", "c2");
    reduced.set(false);

    expect(shown()).toEqual(["send:send-2 grok>opus Abandoned"]);
  });

  it("fades an answer its teammate stops writing, whether it failed, was cancelled or was interrupted", () => {
    const ended = [MessageStatus.Failed, MessageStatus.Cancelled, MessageStatus.Interrupted].map((t, i) => replyOf(`r${i}`, asked, "opus", t));
    send(asked, ...ended.map(t => replyOf(t.id, asked, "opus", MessageStatus.Running)), ...ended);
    const faded = shown().filter(t => t.includes(":out"));
    for (const id of ["r0:out", "r1:out", "r2:out"])
      service.finish(id);

    expect(faded).toEqual(["r0:out opus>person Abandoned", "r1:out opus>person Abandoned", "r2:out opus>person Abandoned"]);
    expect(shown().filter(t => t.includes(":out"))).toEqual([]);
  });

  it("ends a flow nobody draws once its pulse and glow, or its fade, would have ended, keeps one still being written, and leaves no ending once released", () => {
    const sentFor = Resources.organizationFlowPulseDuration + Resources.organizationFlowGlowDuration;
    send(asked, replyOf("r1", asked, "opus", MessageStatus.Running), replyOf("r2", asked, "grok", MessageStatus.Running));
    clock.advance(sentFor - 1);
    const before = shown();
    clock.advance(1);
    const after = shown();
    send(replyOf("r1", asked, "opus", MessageStatus.Completed), replyOf("r2", asked, "grok", MessageStatus.Failed));
    clock.advance(Resources.organizationFlowFadeDuration);
    const faded = shown();
    clock.advance(sentFor);
    const ended = shown();
    send(replyOf("r3", asked, "opus", MessageStatus.Running));
    OrganizationFlowService.release(context);

    expect(before).toEqual(["r1:in person>opus Sent", "r1:out opus>person Writing", "r2:in person>grok Sent", "r2:out grok>person Writing"]);
    expect([after, faded, ended, clock.remaining]).toEqual([["r1:out opus>person Writing", "r2:out grok>person Writing"], ["r1:out opus>person Sent"], [], []]);
  });

  it("ends a flow that is sent again only after its later pulse and glow, cancelling its first ending", () => {
    const sentFor = Resources.organizationFlowPulseDuration + Resources.organizationFlowGlowDuration;
    send(asked, replyOf("r1", asked, "opus", MessageStatus.Running));
    clock.advance(1000);
    send(replyOf("r1", asked, "opus", MessageStatus.Completed));
    clock.advance(1000);
    send(replyOf("r1", asked, "opus", MessageStatus.Running), replyOf("r1", asked, "opus", MessageStatus.Completed));
    clock.advance(sentFor - 1000);
    const kept = shown();
    const left = clock.remaining;
    clock.advance(1000);

    expect([kept, left, shown()]).toEqual([["r1:out opus>person Sent"], [1000], []]);
  });

  it("keeps at most its limit of flows, dropping the oldest", () => {
    send(asked, ...Array.from({ length: Resources.organizationFlowRemembered / 2 + 1 }, (_, i) => replyOf(`r${i}`, asked, "opus", MessageStatus.Running)));

    expect([shown().length, shown().at(0)]).toEqual([Resources.organizationFlowRemembered, "r1:in person>opus Sent"]);
  });

  it("shows several teammates answering one message at once", () => {
    send(asked, replyOf("r1", asked, "opus", MessageStatus.Running), replyOf("r2", asked, "grok", MessageStatus.Running));

    expect(shown()).toEqual(["r1:in person>opus Sent", "r1:out opus>person Writing", "r2:in person>grok Sent", "r2:out grok>person Writing"]);
  });

  it("shows nothing for a reply to a message it never saw, a teammate's reply to itself, an outside sender or a note", () => {
    const outside = new Message("m3", "c2", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, at, null, at, [], null, null, [],
      new MessageSender("c3", null, "Outside"));
    const own = new Message("m4", "c2", 0, MessageAuthor.Provider, null, MessageStatus.Completed, [], SampleData.provenance, at, at, at, [], "opus", "Opus");
    const note = new Message("m5", "c2", 0, MessageAuthor.TeamRun, "m1", MessageStatus.Completed, [], null, at, null, at);
    send(outside, own, asked, replyOf("r1", sent, "opus", MessageStatus.Running), replyOf("r2", outside, "opus", MessageStatus.Running),
      replyOf("r3", own, "opus", MessageStatus.Running), note, replyOf("r4", note, "grok", MessageStatus.Running),
      new Message("r5", "c1", 1, MessageAuthor.Provider, "m1", MessageStatus.Running, [], SampleData.provenance, at, at, null));

    expect(shown()).toEqual([]);
  });

  it("shows no flow while its setting is off or motion is reduced, and drops the flows it showed", () => {
    send(asked, replyOf("r1", asked, "opus", MessageStatus.Running));
    reduced.set(true);
    const still = shown();
    send(replyOf("r1", asked, "opus", MessageStatus.Completed), replyOf("r2", asked, "grok", MessageStatus.Running));
    reduced.set(false);
    const back = shown();
    context.changeSetting(Resources.organizationMessageFlowSetting, false);
    const off = shown();
    send(replyOf("r3", asked, "grok", MessageStatus.Running));
    const offAgain = shown();
    context.changeSetting(Resources.organizationMessageFlowSetting, true);
    send(replyOf("r4", asked, "grok", MessageStatus.Running));

    expect([still, back, off, offAgain]).toEqual([[], [], [], []]);
    expect(shown()).toEqual(["r4:in person>grok Sent", "r4:out grok>person Writing"]);
  });

  it("gives each window the same service until it is released", () => {
    const other = new FakeWindowPartContext();

    expect(OrganizationFlowService.of(context, reduced, clock, receiverOf)).toBe(service);
    expect(OrganizationFlowService.of(other, reduced, clock, receiverOf)).not.toBe(service);
    OrganizationFlowService.release(other);
  });

  it("forgets the oldest messages past its limit and stops listening once released", () => {
    const many = Array.from({ length: Resources.organizationFlowRemembered + 1 }, (_, i) =>
      new Message(`q${i}`, "c1", i, MessageAuthor.User, null, MessageStatus.Completed, [], null, at, null, at));
    send(...many, replyOf("r0", many.at(0) ?? asked, "opus", MessageStatus.Running), replyOf("r1", many.at(-1) ?? asked, "opus", MessageStatus.Running));
    const remembered = shown();
    const watched = context.watchedSettings;
    OrganizationFlowService.release(context);
    send(replyOf("r2", asked, "opus", MessageStatus.Running));

    expect([remembered, watched, context.watchedSettings]).toEqual([["r1:in person>opus Sent", "r1:out opus>person Writing"],
      [Resources.organizationMessageFlowSetting], []]);
    expect(OrganizationFlowService.of(context, reduced, clock, receiverOf)).not.toBe(service);
  });
});
