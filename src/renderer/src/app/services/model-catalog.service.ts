/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, inject } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { ModelCatalog } from "../models/model-catalog";
import { Resources } from "../resources";
import { ChatStore } from "./chat-store.service";

@Injectable({ providedIn: "root" })
export class ModelCatalogService {
  private readonly store: ChatStore = inject(ChatStore);
  private readonly cached: Map<string, ModelCatalog> = new Map();
  private readonly pending: Map<string, Promise<ModelCatalog>> = new Map();

  public load(provider: string, accountId: string | null, refresh: boolean = false): Promise<ModelCatalog> {
    const key = JSON.stringify([provider, accountId]);
    const cached = this.cached.get(key);
    if (!refresh && !Object.isUndefined(cached) && Date.now() - cached.fetchedAt < Resources.modelCatalogLifetime)
      return Promise.resolve(cached);
    const pending = this.pending.get(key);
    if (!Object.isUndefined(pending))
      return pending;
    if (this.pending.size >= Resources.maximumModelCatalogs)
      return Promise.resolve(new ModelCatalog(cached?.models ?? [], Date.now(), true));
    const request = this.fetch(provider, accountId, cached).then(catalog => {
      this.cached.delete(key);
      this.cached.set(key, catalog);
      if (this.cached.size > Resources.maximumModelCatalogs)
        this.cached.delete(this.cached.keys().next().value!);
      this.pending.delete(key);
      return catalog;
    });
    this.pending.set(key, request);
    return request;
  }

  private async fetch(provider: string, accountId: string | null, cached: ModelCatalog | undefined): Promise<ModelCatalog> {
    try {
      return new ModelCatalog(await this.store.listModels(provider, accountId), Date.now(), false);
    }
    catch {
      return new ModelCatalog(cached?.models ?? [], Date.now(), true);
    }
  }
}
