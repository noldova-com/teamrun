/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Message, MessageAuthor, MessageStatus, ObservedSettings, Provenance, RequestedSettings } from "@noldova/teamrun.protocol";

import { ChatThread } from "../../../src/app/models/chat-thread";
import { SampleData } from "../../fixtures/sample-data.fixture";

describe("ChatThread", () => {
  const reply = (provenance: Provenance): Message =>
    new Message("r1", "c1", 4, MessageAuthor.Provider, "m1", MessageStatus.Completed, [], provenance, SampleData.timestamp, SampleData.timestamp, SampleData.timestamp, [], "ada", "ada");
  const asked = new Message("m1", "c1", 3, MessageAuthor.User, null, MessageStatus.Completed, [], null, SampleData.timestamp, null, SampleData.timestamp);
  const provenance = (session: string | null, model: string | null): Provenance =>
    new Provenance("a1", new RequestedSettings("codex", null, null), new ObservedSettings("codex", model, "high", null), session, false);
  const of = (sequence: number, model: string, teammateId: string | null = "ada", kind: string = "codex", providerId: string | null = "a1"): ChatThread =>
    new ChatThread("c1", teammateId, sequence, kind, providerId, model, null);

  it("reads the model and effort a reply on a thread reported, with its chat, teammate and provider", () => {
    expect(ChatThread.ofMessage(reply(provenance("s1", "gpt-a")))).toEqual(new ChatThread("c1", "ada", 4, "codex", "a1", "gpt-a", "high"));
  });

  it("reads nothing from a message with no provider's word, no thread or no reported model", () => {
    expect([asked, reply(provenance(null, "gpt-a")), reply(provenance("s1", null))].map(t => ChatThread.ofMessage(t))).toEqual([null, null, null]);
  });

  it("keeps the latest of each teammate, kind and provider in a chat, and ignores an older one or none", () => {
    const first = of(2, "gpt-a");
    const others = [of(1, "gpt-b", null), of(1, "gpt-c", "ada", "other"), of(1, "gpt-d", "ada", "codex", "a2")];
    const all = others.reduce<readonly ChatThread[]>((merged, t) => ChatThread.merge(merged, t), [first]);

    expect(all).toEqual([first, ...others]);
    expect(ChatThread.merge(all, of(1, "older"))).toBe(all);
    expect(ChatThread.merge(all, null)).toBe(all);
    expect(ChatThread.merge(all, of(3, "newer"))).toEqual([...others, of(3, "newer")]);
  });
});
