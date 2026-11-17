/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComposerChoices } from "../../../src/app/models/composer-choices";
import { ComposerSettings } from "../../../src/app/models/composer-settings";

describe("ComposerChoices", () => {
  const codex = new ComposerSettings("codex", "gpt-5", "high", "a1", "bob");

  it("remembers each conversation's choice, and reads back what it writes", () => {
    const choices = new ComposerChoices().remember("c1", codex);

    expect(choices.conversations.get("c1")).toBe(codex);
    expect(ComposerChoices.fromJson(choices.toJson()).conversations.get("c1")?.equals(codex)).toBe(true);
    expect(new ComposerChoices().toJson()).toEqual({ chats: {} });
  });

  it("skips stored values it cannot read", () => {
    const read = ComposerChoices.fromJson({ defaultChoice: { kind: 1 }, chats: { c1: codex.toJson(), c2: { model: "gpt-5" }, c3: "codex" } });

    expect([...read.conversations.keys()]).toEqual(["c1"]);
    expect(ComposerChoices.fromJson({ conversations: [codex.toJson()] }).conversations.size).toBe(0);
    expect(ComposerChoices.fromJson({ conversations: "c1" }).conversations.size).toBe(0);
    expect(ComposerChoices.fromJson([]).conversations.size).toBe(0);
    expect(ComposerChoices.fromJson(null).conversations.size).toBe(0);
  });
});
