/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { SettingOption } from "@noldova/desktop.protocol";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { AuthStatus, EventName, type Provider } from "@noldova/teamrun.protocol";

import type { ModelCatalog } from "../models/model-catalog";
import { Resources } from "../../resources";
import type { ChatStoreService } from "./chat-store.service";

export class TitleModelOptions {
  private readonly catalogs: Map<string, ModelCatalog> = new Map();
  private readonly loading: Set<string> = new Set();
  private readonly stale: Set<string> = new Set();
  private readonly context: IWindowPartContext;
  private readonly store: ChatStoreService;
  private released: boolean = false;

  private constructor(context: IWindowPartContext, store: ChatStoreService) {
    this.context = context;
    this.store = store;
  }

  public static provide(context: IWindowPartContext, store: ChatStoreService): () => void {
    const options = new TitleModelOptions(context, store);
    const stops = [
      context.provideSettingOptions(Resources.titleModelSetting, () => options.read()),
      ...[EventName.ProviderUpdated, EventName.ProviderSignInsChanged].map(t => context.onEvent(Resources.formatQualifiedName(t), () => options.reload()))
    ];
    return () => {
      options.released = true;
      stops.forEach(t => t());
    };
  }

  private read(): readonly SettingOption[] | null {
    const kinds = new Set(this.store.kinds().filter(t => t.namesChats).map(t => t.id));
    const providers = this.store.providers().filter(t => t.enabled && t.authStatus !== AuthStatus.LoggedOut && kinds.has(t.kind));
    for (const provider of providers)
      this.load(provider);
    const options = [new SettingOption(String.empty, Resources.titleModelSameAsChat)];
    for (const provider of providers) {
      const catalog = this.catalogs.get(provider.id);
      if (Object.isUndefined(catalog))
        return null;
      options.push(...catalog.models.map(t => new SettingOption(`${provider.id}${Resources.titleModelSeparator}${t.id}`,
        Resources.formatTitleModelOption(provider.label, catalog.isAlias(t) ? Resources.formatDefaultModel(t.displayName) : t.displayName))));
    }
    return options;
  }

  private load(provider: Provider): void {
    const kept = this.catalogs.get(provider.id);
    if (this.loading.has(provider.id) || !Object.isUndefined(kept) && !this.stale.delete(provider.id))
      return;
    this.loading.add(provider.id);
    void this.store.modelCatalogs.load(provider.kind, provider.id, kept?.failed === true).then(t => {
      if (this.released)
        return;
      this.catalogs.set(provider.id, t);
      this.loading.delete(provider.id);
      this.context.refreshSettingOptions(Resources.titleModelSetting);
    });
  }

  private reload(): void {
    for (const id of this.catalogs.keys())
      this.stale.add(id);
    this.context.refreshSettingOptions(Resources.titleModelSetting);
  }
}
