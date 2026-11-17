/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ContextUsage, Message, MessageAuthor, MessageStatus, Provenance, ReplyUsage, TeammateUsage } from "@noldova/teamrun.protocol";

import { ChatContext } from "../../../src/app/models/chat-context";
import { SampleData } from "../../fixtures/sample-data.fixture";

describe("ChatContext", () => {
  const full = new ContextUsage(90, 100, 95);
  const reply = (id: string, startedAt: string | null, usage: ReplyUsage | null, teammateId: string | null = "ada"): Message =>
    new Message(id, "c1", 1, MessageAuthor.Provider, "m1", MessageStatus.Completed, [],
      new Provenance("a1", SampleData.provenance.requested, SampleData.provenance.observed, "s1", false, null, null, usage), SampleData.timestamp, startedAt, SampleData.timestamp, [],
      teammateId, teammateId);
  const of = (id: string, startedAt: string | null, used: number, teammateId: string | null = "ada"): ChatContext =>
    new ChatContext("c1", teammateId, id, startedAt, new ContextUsage(used, 100, null), "a1");

  it("reads a reply's context with its chat, teammate, start and provider", () => {
    expect(ChatContext.ofMessage(reply("m2", "2026-10-22T08:00:00.000Z", new ReplyUsage(1, 2, null, full))))
      .toEqual(new ChatContext("c1", "ada", "m2", "2026-10-22T08:00:00.000Z", full, "a1"));
    expect(ChatContext.ofTeammate(new TeammateUsage("ada", "c1", "m2", null, null, new ReplyUsage(null, null, null, full)), "a2"))
      .toEqual(new ChatContext("c1", "ada", "m2", null, full, "a2"));
  });

  it("reads nothing from a message or teammate whose provider sent no context", () => {
    expect(ChatContext.ofMessage(SampleData.userMessage)).toBeNull();
    expect(ChatContext.ofMessage(reply("m2", null, null))).toBeNull();
    expect(ChatContext.ofMessage(reply("m2", null, new ReplyUsage(1, 2, null, null)))).toBeNull();
    expect(ChatContext.ofTeammate(new TeammateUsage("ada", "c1", "m2", null, null, new ReplyUsage(1, 2, 0.1, null)), "a1")).toBeNull();
  });

  it("keeps one context per chat and teammate, from the reply that started last, and updates the same reply in place", () => {
    const first = of("m2", "2026-10-22T08:00:00.000Z", 10);
    const later = of("m4", "2026-10-22T09:00:00.000Z", 40);
    const other = of("m3", "2026-10-22T07:00:00.000Z", 5, null);

    expect(ChatContext.merge([], null)).toEqual([]);
    expect(ChatContext.merge([first, other], later)).toEqual([other, later]);
    expect(ChatContext.merge([later], first)).toEqual([later]);
    expect(ChatContext.merge([later], of("m4", "2026-10-22T09:00:00.000Z", 60))).toEqual([of("m4", "2026-10-22T09:00:00.000Z", 60)]);
    expect(ChatContext.merge([of("m5", null, 1)], first)).toEqual([first]);
    expect(ChatContext.merge([first], of("m6", null, 2))).toEqual([first]);
  });
});
