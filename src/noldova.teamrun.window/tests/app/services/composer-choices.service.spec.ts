/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { ComposerChoices } from "../../../src/app/models/composer-choices";
import { ComposerSettings } from "../../../src/app/models/composer-settings";
import { ComposerChoicesService } from "../../../src/app/services/composer-choices.service";
import { Resources } from "../../../src/resources";

describe("ComposerChoicesService", () => {
  const key = Resources.composerChoicesStorageKey;
  const codex = new ComposerSettings("codex", "gpt-5", "high", "a1", "bob");
  const stored = (): unknown => JSON.parse(localStorage.getItem(key) ?? "null");

  beforeEach(() => localStorage.removeItem(key));

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem(key);
  });

  it("starts empty when nothing is stored, and reads what an earlier window stored", () => {
    expect(TestBed.inject(ComposerChoicesService).choices().toJson()).toEqual(new ComposerChoices().toJson());

    TestBed.resetTestingModule();
    localStorage.setItem(key, JSON.stringify(new ComposerChoices(new Map([["c1", codex]])).toJson()));
    const choices = TestBed.inject(ComposerChoicesService);

    expect(choices.choiceOf("c1")?.equals(codex)).toBe(true);
    expect(choices.choiceOf("c2")).toBeNull();
  });

  it.each([["not JSON", "{"], ["an array", "[\"c1\"]"], ["null", "null"]])("starts empty when the stored choices are %s, and replaces them on a change", (_, text) => {
    localStorage.setItem(key, text);
    const choices = TestBed.inject(ComposerChoicesService);

    expect(choices.choices().toJson()).toEqual(new ComposerChoices().toJson());
    choices.remember("c1", codex);
    expect(stored()).toEqual({ chats: { c1: codex.toJson() } });
  });

  it("drops every chat's choice an earlier version stored with its provider and account keys", () => {
    const old = { provider: "codex", model: "gpt-5", effort: "high", providerAccountId: "a1", responderTeammateId: "bob" };
    localStorage.setItem(key, JSON.stringify({ [Resources.defaultChoiceField]: old, [Resources.legacyChatChoicesField]: { c1: old, c2: old } }));

    expect(TestBed.inject(ComposerChoicesService).choices().toJson()).toEqual(new ComposerChoices().toJson());
  });

  it("stores each remembered choice, and keeps the default an earlier version stored there for its move", () => {
    localStorage.setItem(key, JSON.stringify({ defaultChoice: codex.withResponder(null).toJson(), chats: {} }));
    const choices = TestBed.inject(ComposerChoicesService);

    choices.remember("c1", codex);
    choices.remember("c2", codex);

    expect(stored()).toEqual({ defaultChoice: codex.withResponder(null).toJson(), chats: { c1: codex.toJson(), c2: codex.toJson() } });
  });

  it("moves the choices an earlier version stored under conversations to chats once, keeping the rest and the new names over the earlier", () => {
    const claude = new ComposerSettings("claude", "opus", "high", "a2", null);
    localStorage.setItem(key, JSON.stringify({ defaultChoice: codex.withResponder(null).toJson(), conversations: { c1: codex.toJson(), c2: codex.toJson() },
      chats: { c2: claude.toJson() } }));
    const choices = TestBed.inject(ComposerChoicesService);

    expect(stored()).toEqual({ defaultChoice: codex.withResponder(null).toJson(), chats: { c2: claude.toJson() } });
    expect(choices.choiceOf("c2")?.equals(claude)).toBe(true);

    TestBed.resetTestingModule();
    localStorage.setItem(key, JSON.stringify({ conversations: { c1: codex.toJson() } }));
    const moved = TestBed.inject(ComposerChoicesService);

    expect(stored()).toEqual({ chats: { c1: codex.toJson() } });
    expect(moved.choiceOf("c1")?.equals(codex)).toBe(true);
    moved.remember("c3", codex);
    expect(stored()).toEqual({ chats: { c1: codex.toJson(), c3: codex.toJson() } });
  });

  it("reads the choices an earlier version stored under conversations when storage refuses their move", () => {
    localStorage.setItem(key, JSON.stringify({ conversations: { c1: codex.toJson() } }));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });

    expect(TestBed.inject(ComposerChoicesService).choiceOf("c1")?.equals(codex)).toBe(true);
    expect(stored()).toEqual({ conversations: { c1: codex.toJson() } });
  });

  it("keeps a change for this window when the storage refuses it", () => {
    const choices = TestBed.inject(ComposerChoicesService);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });

    choices.remember("c1", codex);

    expect(choices.choiceOf("c1")).toBe(codex);
    expect(stored()).toBeNull();
  });

  it("follows a change another window stores, ignores other keys, and stops once destroyed", () => {
    const choices = TestBed.inject(ComposerChoicesService);
    localStorage.setItem(key, JSON.stringify(new ComposerChoices().remember("c1", codex).toJson()));

    window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
    expect(choices.choiceOf("c1")).toBeNull();
    window.dispatchEvent(new StorageEvent("storage", { key }));
    expect(choices.choiceOf("c1")?.equals(codex)).toBe(true);

    TestBed.resetTestingModule();
    localStorage.removeItem(key);
    window.dispatchEvent(new StorageEvent("storage", { key }));
    expect(choices.choiceOf("c1")?.equals(codex)).toBe(true);
  });
});
