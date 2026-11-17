/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { MessageAuthor, MessageSearchHit, MessageSearchResult } from "@noldova/teamrun.protocol";

@TestClass
export class MessageSearchResultTests {
  private static readonly json: object = {
    hits: [
      { chatId: "chat-1", projectId: "prj-1", chatTitle: "Fix toMiles", messageId: "msg-3", sequence: 3, author: "Provider", senderName: null, teammateName: "Builder",
        providerId: "prv-1", providerKind: "claude", snippet: "…the terminal opens…", createdAt: "t2" },
      { chatId: "chat-2", projectId: null, chatTitle: "", messageId: "msg-1", sequence: 0, author: "User", senderName: "TeamRun", teammateName: null,
        providerId: null, providerKind: null, snippet: "Open a terminal", createdAt: "t1" }
    ],
    total: 14,
    capped: false
  };

  @TestMethod
  public roundTripsThroughJson(): void {
    const value = MessageSearchResult.fromJson(MessageSearchResultTests.json);

    Assert.areEqual(JSON.stringify(MessageSearchResultTests.json), JSON.stringify(value.toJson()));
    Assert.areEqual("Builder|null|14|false|true", [value.hits[0]?.teammateName, String(value.hits[1]?.teammateName), value.total, value.capped,
      value.hits[1] instanceof MessageSearchHit].join("|"));
    Assert.areEqual("Provider|prv-1|claude|User|TeamRun", [value.hits[0]?.author, value.hits[0]?.providerId, value.hits[0]?.providerKind, value.hits[1]?.author,
      value.hits[1]?.senderName].join("|"));
    Assert.isTrue(MessageSearchResult.fromJson({ hits: [], total: 1000, capped: true }).capped);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const hit = (overrides: { chatId?: string; projectId?: string; messageId?: string; sequence?: number; senderName?: string; teammateName?: string;
      providerId?: string; providerKind?: string; createdAt?: string }): MessageSearchHit =>
      new MessageSearchHit(overrides.chatId ?? "chat-1", overrides.projectId ?? null, "T", overrides.messageId ?? "msg-1", overrides.sequence ?? 0, MessageAuthor.User,
        overrides.senderName ?? null, overrides.teammateName ?? null, overrides.providerId ?? null, overrides.providerKind ?? null, "s", overrides.createdAt ?? "t");

    Assert.throws(() => hit({ chatId: " " }), ArgumentException);
    Assert.throws(() => hit({ projectId: " " }), ArgumentException);
    Assert.throws(() => hit({ messageId: " " }), ArgumentException);
    Assert.throws(() => hit({ sequence: -1 }), ArgumentOutOfRangeException);
    Assert.throws(() => hit({ senderName: " " }), ArgumentException);
    Assert.throws(() => hit({ teammateName: " " }), ArgumentException);
    Assert.throws(() => hit({ providerId: " " }), ArgumentException);
    Assert.throws(() => hit({ providerKind: " " }), ArgumentException);
    Assert.throws(() => hit({ createdAt: " " }), ArgumentException);
    Assert.throws(() => new MessageSearchResult([hit({})], 0, false), ArgumentOutOfRangeException);
    const badHits = Assert.throws(() => MessageSearchResult.fromJson({ hits: "x", total: 0 }), JsonException);
    const badHit = Assert.throws(() => MessageSearchResult.fromJson({ hits: [{ chatId: "c" }], total: 1 }), JsonException);
    const badCapped = Assert.throws(() => MessageSearchResult.fromJson({ hits: [], total: 0, capped: "no" }), JsonException);
    const badAuthor = Assert.throws(() => MessageSearchHit.fromJson({ chatId: "c", projectId: null, chatTitle: "", messageId: "m", sequence: 0, author: "Robot" }),
      JsonException);

    Assert.areEqual("$.hits|$.hits.0.projectId|$.capped|$.author", `${badHits.path}|${badHit.path}|${badCapped.path}|${badAuthor.path}`);
  }
}
