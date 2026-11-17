/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed } from "@angular/core";

import { ProviderMode, ProviderModel, ProviderModelList } from "@noldova/teamrun.protocol";

import { ModelCatalogCache } from "../../../src/app/services/model-catalog-cache";
import { Resources } from "../../../src/resources";

describe("ModelCatalogCache", () => {
  const clock = (): number => 0;

  it("caches separately by kind and provider, refreshes explicitly, and expires on its own clock", async () => {
    let now = 0;
    const fetchModels = vi.fn(async (kind: string, provider: string | null, _refresh: boolean) =>
      new ProviderModelList([new ProviderModel(`${kind}/${provider}`, "Choice", "", [], true, null, null)], provider === "b" ? false : null));
    const cache = new ModelCatalogCache(fetchModels, () => now);

    expect((await cache.load("codex", "a")).models[0]?.id).toBe("codex/a");
    await cache.load("codex", "a");
    expect((await cache.load("codex", "b")).signedIn).toBe(false);
    expect((await cache.load("codex", "a")).signedIn).toBeNull();
    await cache.load("claude", "a");
    expect(fetchModels).toHaveBeenCalledTimes(3);
    await cache.load("codex", "a", true);
    expect(fetchModels).toHaveBeenCalledTimes(4);
    expect(fetchModels.mock.calls.map(t => t[2])).toEqual([false, false, false, true]);
    now = Resources.modelCatalogLifetime - 1;
    expect((await cache.load("codex", "a")).fetchedAt).toBe(0);
    expect(fetchModels).toHaveBeenCalledTimes(4);
    now = Resources.modelCatalogLifetime;
    expect((await cache.load("codex", "a")).fetchedAt).toBe(Resources.modelCatalogLifetime);
    expect(fetchModels).toHaveBeenCalledTimes(5);
  });

  it("keeps a list for each folder apart, and asks for it with its folder", async () => {
    const fetchModels = vi.fn((_kind: string, _providerId: string | null, _refresh: boolean, _workingDirectory: string | null) => Promise.resolve(new ProviderModelList([], null)));
    const cache = new ModelCatalogCache(fetchModels, () => 0);

    await cache.load("codex", "a", false, "/one");
    await cache.load("codex", "a", false, "/two");
    await cache.load("codex", "a");
    await cache.load("codex", "a", false, "/one");

    expect(fetchModels.mock.calls.map(t => t[3])).toEqual(["/one", "/two", null]);
  });

  it("gives a catalog already loaded without its folder, reading it again once another loads, and never lists models itself", async () => {
    const fetchModels = vi.fn(async (kind: string) => new ProviderModelList([new ProviderModel(`${kind}-1`, "One", "", [], true, null, null)], null));
    const cache = new ModelCatalogCache(fetchModels, clock);
    const shown = computed(() => cache.loadedOf("codex", "a")?.models[0]?.id ?? null);

    const before = shown();
    await cache.load("codex", "a", false, "/one");
    const inFolder = shown();
    await cache.load("codex", "a");

    expect([before, inFolder, shown(), cache.loadedOf("codex", "b"), fetchModels.mock.calls.length]).toEqual([null, null, "codex-1", undefined, 2]);
  });

  it("carries a list that came back empty into its catalog", async () => {
    const cache = new ModelCatalogCache(async () => new ProviderModelList([], true, true), () => 1);

    const catalog = await cache.load("copilot", "a");

    expect([catalog.empty, catalog.failed, catalog.signedIn, catalog.models.length]).toEqual([true, false, true, 0]);
  });

  it("carries a list that awaits the provider's first turn into its catalog, and lists again at the next load until one names the models", async () => {
    const fetchModels = vi.fn(async (_kind: string, _provider: string | null, _refresh: boolean): Promise<ProviderModelList> =>
      new ProviderModelList([], true, false, null, true));
    const cache = new ModelCatalogCache(fetchModels, () => 1);

    const awaiting = await cache.load("antigravity", "a");
    fetchModels.mockResolvedValue(new ProviderModelList([new ProviderModel("gemini-pro", "Gemini Pro", "", [], true, null, true)], true));
    const listed = await cache.load("antigravity", "a");
    await cache.load("antigravity", "a");

    expect([awaiting.awaitsTurn, awaiting.unlisted, awaiting.failed, awaiting.signedIn]).toEqual([true, false, false, true]);
    expect(listed.models.map(t => t.id)).toEqual(["gemini-pro"]);
    expect(listed.awaitsTurn).toBe(false);
    expect(fetchModels).toHaveBeenCalledTimes(2);
    expect(fetchModels.mock.calls.map(t => t[2])).toEqual([false, false]);
  });

  it("carries the plan that limits the models into its catalog", async () => {
    const cache = new ModelCatalogCache(async () => new ProviderModelList([], true, false, "Copilot Free"), () => 1);

    const catalog = await cache.load("copilot", "a");

    expect([catalog.planName, catalog.unlisted, catalog.failed]).toEqual(["Copilot Free", false, false]);
  });

  it("carries the provider's modes, its default mode and whether its default takes the listed levels into its catalog", async () => {
    const modes = [new ProviderMode("auto", "Default"), new ProviderMode("full-access", "Full Access", null, true)];
    const cache = new ModelCatalogCache(async () => new ProviderModelList([], true, false, null, false, modes, "auto", true), () => 1);

    const catalog = await cache.load("codex", "a");

    expect([catalog.modes.map(t => t.id), catalog.defaultMode, catalog.defaultTakesListedEfforts]).toEqual([["auto", "full-access"], "auto", true]);
  });

  it("carries the provider's plan mode into its catalog, and keeps it after a refresh fails", async () => {
    const fetchModels = vi.fn(async (): Promise<ProviderModelList> => new ProviderModelList([], true, false, null, false,
      [new ProviderMode("auto", "Default"), new ProviderMode("plan", "Plan", null, false, true)], "auto", false, "plan"));
    const cache = new ModelCatalogCache(fetchModels, clock);
    const original = await cache.load("claude", null);
    fetchModels.mockRejectedValue(new Error("offline"));

    const failed = await cache.load("claude", null, true);
    const other = await cache.load("claude", "other");

    expect([original.planMode, failed.failed, failed.planMode, other.planMode]).toEqual(["plan", true, "plan", null]);
  });

  it("keeps the previous catalog of a provider after a refresh fails", async () => {
    const fetchModels = vi.fn(async (): Promise<ProviderModelList> => new ProviderModelList([new ProviderModel("gpt-5", "GPT-5", "", [], true, null, true)], false, false,
      null, false, [new ProviderMode("auto", "Default")], "auto", true));
    const cache = new ModelCatalogCache(fetchModels, clock);
    const original = await cache.load("codex", null);
    fetchModels.mockRejectedValue(new Error("offline"));

    const failed = await cache.load("codex", null, true);
    const other = await cache.load("codex", "other");

    expect(failed.failed).toBe(true);
    expect(failed.models).toEqual(original.models);
    expect(original.signedIn).toBe(false);
    expect(failed.signedIn).toBeNull();
    expect([failed.modes, failed.defaultMode, failed.defaultTakesListedEfforts]).toEqual([original.modes, "auto", true]);
    expect(other.failed).toBe(true);
    expect([other.models, other.modes, other.defaultMode, other.defaultTakesListedEfforts]).toEqual([[], [], null, false]);
  });

  it("coalesces requests and bounds pending requests and kept catalogs", async () => {
    let complete!: (list: ProviderModelList) => void;
    const pending = new Promise<ProviderModelList>(resolve => complete = resolve);
    const fetchModels = vi.fn((): Promise<ProviderModelList> => pending);
    const cache = new ModelCatalogCache(fetchModels, clock);
    const first = cache.load("codex", "0");
    expect(cache.load("codex", "0", true)).toBe(first);
    const requests = [first];
    for (let index = 1; index < Resources.maximumModelCatalogs; index++)
      requests.push(cache.load("codex", String(index)));

    expect((await cache.load("codex", "overflow")).failed).toBe(true);
    expect(fetchModels).toHaveBeenCalledTimes(Resources.maximumModelCatalogs);
    complete(new ProviderModelList([], null));
    await Promise.all(requests);
    await cache.load("codex", "overflow");
    await cache.load("codex", "0");
    expect(fetchModels).toHaveBeenCalledTimes(Resources.maximumModelCatalogs + 2);
  });
});
