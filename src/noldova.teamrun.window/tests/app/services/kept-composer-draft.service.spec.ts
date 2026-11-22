/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ComposerDraft } from "../../../src/app/models/composer-draft";
import { KeptComposerDraftService } from "../../../src/app/services/kept-composer-draft.service";
import { Resources } from "../../../src/resources";

describe("KeptComposerDraftService", () => {
  const key = Resources.keptComposerDraftsStorageKey;
  const textOf = async (drafts: KeptComposerDraftService, id: string): Promise<string | null> => (await drafts.restore(id))?.text ?? null;

  beforeEach(() => {
    localStorage.removeItem(key);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem(key);
  });

  it("keeps each recipient set's text and drops one without touching the others", async () => {
    const drafts = new KeptComposerDraftService();
    drafts.schedule(new ComposerDraft("a+b", "For both", []));
    drafts.schedule(new ComposerDraft("c", "For one", []));
    drafts.drop("a+b");
    drafts.drop("gone");

    expect([await textOf(drafts, "a+b"), await textOf(drafts, "c"), JSON.parse(localStorage.getItem(key) ?? "null")]).toEqual([null, "For one", { c: "For one" }]);
  });

  it("restores no draft from stored text that isn't JSON, and replaces it on the next change", async () => {
    localStorage.setItem(key, "{not json");
    const drafts = new KeptComposerDraftService();

    expect(await textOf(drafts, "a+b")).toBeNull();
    drafts.schedule(new ComposerDraft("a+b", "Fresh", []));
    expect(localStorage.getItem(key)).toBe(JSON.stringify({ "a+b": "Fresh" }));
  });

  it("skips stored values that aren't text, and a stored value that isn't an object", async () => {
    const drafts = new KeptComposerDraftService();
    localStorage.setItem(key, JSON.stringify({ "a+b": 3, c: "Kept", d: null }));
    const kept = [await textOf(drafts, "a+b"), await textOf(drafts, "c"), await textOf(drafts, "d")];
    localStorage.setItem(key, JSON.stringify(["Not", "drafts"]));

    expect([kept, await textOf(drafts, "0")]).toEqual([[null, "Kept", null], null]);
  });

  it("has nothing stale to watch and nothing left to save, since each change is kept at once", async () => {
    const drafts = new KeptComposerDraftService();
    drafts.schedule(new ComposerDraft("c", "Kept", []));

    expect([drafts.onStale()(), await drafts.save(), await drafts.flush(), await textOf(drafts, "c")]).toEqual([undefined, undefined, true, "Kept"]);
  });

  it("goes on when the storage refuses a change", async () => {
    const drafts = new KeptComposerDraftService();
    drafts.schedule(new ComposerDraft("c", "Earlier", []));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });

    expect(() => drafts.schedule(new ComposerDraft("c", "Later", []))).not.toThrow();
    expect(() => drafts.drop("c")).not.toThrow();
    expect(await textOf(drafts, "c")).toBe("Earlier");
  });
});
