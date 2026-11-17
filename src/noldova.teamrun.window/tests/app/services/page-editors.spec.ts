/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, signal, type WritableSignal } from "@angular/core";

import "@noldova/context.core";
import { DetailKind, Message, MessageDetail, MessageStatus, type Provider, type ProviderKind } from "@noldova/teamrun.protocol";

import { ConversationHistorySource } from "../../../src/app/models/conversation-history-source";
import { PageEditors } from "../../../src/app/services/page-editors";
import { SampleData } from "../../fixtures/sample-data.fixture";
import { SamplePages } from "../../fixtures/sample-pages.fixture";

describe("PageEditors", () => {
  const edit = (sequence: number, toolUseId: string, pageId: string): MessageDetail => new MessageDetail(sequence, DetailKind.Note, "Edit a page",
    { tool: "mcp__teamrun__teamrun_edit_page", toolUseId, input: { page_id: pageId, base_version: 1 } }, SampleData.timestamp);
  const failed = (sequence: number, toolUseId: string): MessageDetail =>
    new MessageDetail(sequence, DetailKind.Note, "The page has a newer version, v2.", { toolUseId, isError: true }, SampleData.timestamp);
  const reply = (id: string, sequence: number, teammate: string, details: readonly MessageDetail[], conversationId: string = "c1"): Message =>
    new Message(id, conversationId, sequence, SampleData.reply.author, "m1", MessageStatus.Running, details, SampleData.reply.provenance, SampleData.timestamp,
      SampleData.timestamp, null, [], teammate.toLowerCase(), teammate);
  let shown: WritableSignal<string | null>;
  let workingReplies: WritableSignal<readonly Message[]>;
  let history: ConversationHistorySource;
  let editors: Signal<ReadonlyMap<string, string>>;

  const create = (held: readonly Message[], working: readonly Message[]): void => {
    shown = signal("c1");
    workingReplies = signal(working);
    history = new ConversationHistorySource(SampleData.page([SampleData.userMessage, ...held], false, false), () => Promise.resolve([]));
    editors = PageEditors.of({
      shownConversationId: shown,
      historyOf: (chatId: string | null): ConversationHistorySource | null => chatId === "c1" ? history : null,
      workingReplies,
      kinds: signal<readonly ProviderKind[]>([]),
      providers: signal<readonly Provider[]>([]),
      isReplyAuthorUnavailable: (): boolean => false
    });
  };

  it("names who is editing each page from the shown chat's running replies, the latest reply's teammate last, and drops an edit once it ends or fails", () => {
    const edited = new MessageDetail(3, DetailKind.Note, JSON.stringify(SamplePages.page("p3", "Welcome email", 2).toJson()), { toolUseId: "u5" }, SampleData.timestamp);
    const first = reply("m2", 1, "Opus", [edit(0, "u1", "p1"), edit(1, "u2", "p2"), edit(2, "u5", "p3"), edited]);
    const second = reply("m3", 2, "Sol", [edit(0, "u3", "p1"), new MessageDetail(1, DetailKind.Command, "> ls", { tool: "Bash" }, SampleData.timestamp)]);
    create([first, second], [second, reply("m9", 0, "Nova", [edit(0, "u4", "p4")], "c2"), first]);

    const running = [...editors()];
    history.upsert(first.withDetails([...first.details, failed(4, "u2")]));

    expect([running, [...editors()]]).toEqual([[["p1", "Sol"], ["p2", "Opus"]], [["p1", "Sol"]]]);
  });

  it("reads a running reply from what it was told when the chat's history doesn't hold it, and names no one once the reply stops", () => {
    create([], [reply("m5", 5, "Opus", [edit(0, "u1", "p1")])]);

    const named = [...editors()];
    workingReplies.set([]);

    expect([named, [...editors()]]).toEqual([[["p1", "Opus"]], []]);
  });

  it("names no one while no chat is shown or its history isn't loaded", () => {
    create([], [reply("m2", 1, "Opus", [edit(0, "u1", "p1")])]);

    shown.set(null);
    const none = [...editors()];
    shown.set("c2");

    expect([none, [...editors()]]).toEqual([[], []]);
  });
});
