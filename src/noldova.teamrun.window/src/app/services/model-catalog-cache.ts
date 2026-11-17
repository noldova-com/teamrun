/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import type { ProviderModelList } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { ModelCatalog } from "../models/model-catalog";

export class ModelCatalogCache {
  private readonly fetchModels: (kind: string, providerId: string | null, refresh: boolean, workingDirectory: string | null) => Promise<ProviderModelList>;
  private readonly cached: Map<string, ModelCatalog> = new Map();
  private readonly pending: Map<string, Promise<ModelCatalog>> = new Map();
  private readonly loads: WritableSignal<number> = signal(0);
  private readonly now: () => number;

  public constructor(fetchModels: (kind: string, providerId: string | null, refresh: boolean, workingDirectory: string | null) => Promise<ProviderModelList>, now: () => number) {
    this.fetchModels = fetchModels;
    this.now = now;
  }

  public load(kind: string, providerId: string | null, refresh: boolean = false, workingDirectory: string | null = null): Promise<ModelCatalog> {
    const key = JSON.stringify([kind, providerId, workingDirectory]);
    const cached = this.cached.get(key);
    if (!refresh && !Object.isUndefined(cached) && !cached.awaitsTurn && this.now() - cached.fetchedAt < Resources.modelCatalogLifetime)
      return Promise.resolve(cached);
    const pending = this.pending.get(key);
    if (!Object.isUndefined(pending))
      return pending;
    if (this.pending.size >= Resources.maximumModelCatalogs)
      return Promise.resolve(ModelCatalogCache.failed(cached, this.now()));
    const request = this.fetch(kind, providerId, refresh, workingDirectory, cached).then(t => {
      this.cached.delete(key);
      this.cached.set(key, t);
      if (this.cached.size > Resources.maximumModelCatalogs)
        this.cached.delete(this.cached.keys().next().value!);
      this.pending.delete(key);
      this.loads.update(u => u + 1);
      return t;
    });
    this.pending.set(key, request);
    return request;
  }

  public loadedOf(kind: string, providerId: string | null): ModelCatalog | undefined {
    this.loads();
    return this.cached.get(JSON.stringify([kind, providerId, null]));
  }

  private async fetch(kind: string, providerId: string | null, refresh: boolean, workingDirectory: string | null, cached: ModelCatalog | undefined): Promise<ModelCatalog> {
    try {
      const list = await this.fetchModels(kind, providerId, refresh, workingDirectory);
      return new ModelCatalog(list.models, this.now(), false, list.signedIn, list.empty, list.planName, list.awaitsTurn, list.modes, list.defaultMode,
        list.defaultTakesListedEfforts, list.planMode);
    }
    catch {
      return ModelCatalogCache.failed(cached, this.now());
    }
  }

  private static failed(cached: ModelCatalog | undefined, now: number): ModelCatalog {
    return new ModelCatalog(cached?.models ?? [], now, true, null, false, null, false, cached?.modes ?? [], cached?.defaultMode ?? null,
      cached?.defaultTakesListedEfforts ?? false, cached?.planMode ?? null);
  }
}
