/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { MessageSender } from "@noldova/teamrun.protocol";

@TestClass
export class MessageSenderTests {
  @TestMethod
  public roundTripsThroughJson(): void {
    const sender = MessageSender.fromJson(new MessageSender("c1", "t1", "Code Reviewer").toJson());

    Assert.areEqual("c1,t1,Code Reviewer", [sender.chatId, sender.teammateId, sender.name].join(","));
  }

  @TestMethod
  public holdsAChatsDefaultTeammateWithNoTeammateId(): void {
    const sender = MessageSender.fromJson(new MessageSender("c1", null, "Claude Code").toJson());

    Assert.areEqual("c1,null,Claude Code", [sender.chatId, String(sender.teammateId), sender.name].join(","));
  }

  @TestMethod
  public holdsADefaultTeammateNamedByItsProviderUpToTheTeammateNameLengthOnOneLineAndKeepsATeammatesNameStrict(): void {
    const longest = `Codex · ${"W".repeat(92)}`;
    const refused = [`${longest}W`, "Codex ·\nWork", "Codex · Work\r", "Codex\u2028Work", "Codex\tWork", "Codex\u0085Work", "   "];

    const held = [new MessageSender("c1", null, "Codex · Work"), new MessageSender("c1", null, longest)].map(t => MessageSender.fromJson(t.toJson()).name);

    Assert.areEqual(JSON.stringify(["Codex · Work", longest]), JSON.stringify(held));
    Assert.areEqual(100, [...longest].length);
    for (const name of refused) {
      Assert.isFalse(MessageSender.allowsDefaultName(name), JSON.stringify(name));
      Assert.throws(() => new MessageSender("c1", null, name), ArgumentException);
      Assert.areEqual("$.sender.name", Assert.throws(() => MessageSender.fromJson({ chatId: "c1", teammateId: null, name }, "$.sender"), JsonException).path);
    }
    Assert.throws(() => new MessageSender("c1", "t1", "Codex · Work"), ArgumentException);
    Assert.areEqual("$.sender.name", Assert.throws(() => MessageSender.fromJson({ chatId: "c1", teammateId: "t1", name: "Codex · Work" }, "$.sender"),
      JsonException).path);
  }

  @TestMethod
  public holdsAnOutsideSenderByItsLabelUpTo40CharactersOnOneLineWithNoAtAndWritesOutsideOnlyWhenSet(): void {
    const longest = "C".repeat(40);
    const refused = [`${longest}C`, "Codex\nin api", "Codex\r", "Codex api", "Codex\tapi", "Codex\u0085api", "Codex‮ipa", "Co​dex", "@Alice", "Codex @ api", "   ", ""];

    const held = [new MessageSender("c1", null, "Codex in api", true), new MessageSender("c1", null, longest, true)].map(t => MessageSender.fromJson(t.toJson()));

    Assert.areEqual(JSON.stringify([["Codex in api", true, null], [longest, true, null]]), JSON.stringify(held.map(t => [t.name, t.outside, t.teammateId])));
    Assert.areEqual(JSON.stringify([true, false]), JSON.stringify([new MessageSender("c1", null, "Codex", true).toJson()["outside"], "outside" in new MessageSender("c1", null, "Codex").toJson()]));
    Assert.isFalse(MessageSender.fromJson({ chatId: "c1", teammateId: null, name: "Codex", outside: false }).outside);
    for (const label of refused) {
      Assert.isFalse(MessageSender.allowsOutsideLabel(label), JSON.stringify(label));
      Assert.throws(() => new MessageSender("c1", null, label, true), ArgumentException);
      Assert.areEqual("$.sender.name", Assert.throws(() => MessageSender.fromJson({ chatId: "c1", teammateId: null, name: label, outside: true }, "$.sender"),
        JsonException).path);
    }
    Assert.throws(() => new MessageSender("c1", "t1", "Alice", true), ArgumentException);
    Assert.areEqual("$.sender.teammateId", Assert.throws(() => MessageSender.fromJson({ chatId: "c1", teammateId: "t1", name: "Alice", outside: true }, "$.sender"),
      JsonException).path);
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    Assert.throws(() => new MessageSender(" ", "t1", "Alice"), ArgumentException);
    Assert.throws(() => new MessageSender("c1", " ", "Alice"), ArgumentException);
    Assert.throws(() => new MessageSender("c1", "t1", "Alice!"), ArgumentException);
    const json = new MessageSender("c1", "t1", "Alice").toJson();
    Assert.areEqual("$.sender.teammateId", Assert.throws(() => MessageSender.fromJson({ ...json, teammateId: "" }, "$.sender"), JsonException).path);
    Assert.areEqual("$.sender.name", Assert.throws(() => MessageSender.fromJson({ ...json, name: "Alice!" }, "$.sender"), JsonException).path);
  }
}
