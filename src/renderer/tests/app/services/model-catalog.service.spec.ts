/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { ProviderModel } from "@noldova/teamrun-protocol";

import { SampleData } from "../../fixtures/sample-data";
import { Resources } from "../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../src/app/services/bridge.service";
import { ChatStore } from "../../../src/app/services/chat-store.service";
import { ModelCatalogService } from "../../../src/app/services/model-catalog.service";

describe("ModelCatalogService", () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] }));
  afterEach(() => vi.restoreAllMocks());

  it("caches separately by provider and account, refreshes explicitly, and expires", async () => {
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const store = TestBed.inject(ChatStore);
    const spy = vi.spyOn(store, "listModels").mockImplementation(async (provider, account) => [new ProviderModel(`${provider}/${account}`, "Choice", "", [], true, null, null)]);
    const service = TestBed.inject(ModelCatalogService);
    expect((await service.load("codex", "a")).models[0]?.id).toBe("codex/a");
    await service.load("codex", "a");
    await service.load("codex", "b");
    await service.load("claude", "a");
    expect(spy).toHaveBeenCalledTimes(3);
    await service.load("codex", "a", true);
    expect(spy).toHaveBeenCalledTimes(4);
    now = Resources.modelCatalogLifetime + 1;
    await service.load("codex", "a");
    expect(spy).toHaveBeenCalledTimes(5);
  });

  it("retains the previous account catalog after a refresh fails", async () => {
    const service = TestBed.inject(ModelCatalogService);
    const original = await service.load("codex", null);
    vi.spyOn(TestBed.inject(ChatStore), "listModels").mockRejectedValue(new Error("offline"));
    const failed = await service.load("codex", null, true);
    expect(failed.failed).toBe(true);
    expect(failed.models).toEqual(original.models);
    const other = await service.load("codex", "other");
    expect(other.failed).toBe(true);
    expect(other.models).toEqual([]);
  });

  it("coalesces requests and bounds pending requests and retained catalogs", async () => {
    let complete!: (models: readonly ProviderModel[]) => void;
    const pending = new Promise<readonly ProviderModel[]>(resolve => complete = resolve);
    const spy = vi.spyOn(TestBed.inject(ChatStore), "listModels").mockReturnValue(pending);
    const service = TestBed.inject(ModelCatalogService);
    const first = service.load("codex", "0");
    expect(service.load("codex", "0", true)).toBe(first);
    const requests = [first];
    for (let index = 1; index < Resources.maximumModelCatalogs; index++)
      requests.push(service.load("codex", String(index)));
    expect((await service.load("codex", "overflow")).failed).toBe(true);
    expect(spy).toHaveBeenCalledTimes(Resources.maximumModelCatalogs);
    complete([]);
    await Promise.all(requests);
    await service.load("codex", "overflow");
    await service.load("codex", "0");
    expect(spy).toHaveBeenCalledTimes(Resources.maximumModelCatalogs + 2);
  });
});
