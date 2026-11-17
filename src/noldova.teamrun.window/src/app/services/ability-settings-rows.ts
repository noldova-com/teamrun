/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type IWindowPartContext, SettingsRow } from "@noldova/desktop.window";
import { ProviderAbilities, type ProviderKind } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { AbilityGroup } from "../models/ability-group";
import type { ChatStoreService } from "./chat-store.service";

export class AbilitySettingsRows {
  private static readonly rows: WeakMap<IWindowPartContext, AbilitySettingsRows> = new WeakMap();

  private readonly context: IWindowPartContext;
  private readonly store: ChatStoreService;
  private readonly stop: () => void;
  private chosenId: string | null = null;

  private constructor(context: IWindowPartContext, store: ChatStoreService) {
    this.context = context;
    this.store = store;
    this.stop = store.onKindsChanged(() => this.give());
    this.give();
  }

  public get chosen(): string | null {
    return this.chosenId;
  }

  public static register(context: IWindowPartContext, store: ChatStoreService): void {
    AbilitySettingsRows.rows.set(context, new AbilitySettingsRows(context, store));
  }

  public static of(context: IWindowPartContext): AbilitySettingsRows | null {
    return AbilitySettingsRows.rows.get(context) ?? null;
  }

  public static release(context: IWindowPartContext): void {
    AbilitySettingsRows.rows.get(context)?.stop();
    AbilitySettingsRows.rows.delete(context);
  }

  public static kindOf(kinds: readonly ProviderKind[], chosen: string | null): ProviderKind | undefined {
    const shown = kinds.filter(t => !Object.isNull(t.abilities));
    return shown.find(t => t.id === chosen) ?? shown[0];
  }

  public choose(kind: string): void {
    this.chosenId = kind;
    this.give();
  }

  private give(): void {
    const abilities = AbilitySettingsRows.kindOf(this.store.kinds(), this.chosenId)?.abilities ?? null;
    this.context.setSettingsRows(Resources.abilitiesPageName, Object.isNull(abilities) ? [] : AbilityGroup.all.flatMap(t => t.abilities.map(u =>
      new SettingsRow(Resources.formatAbilitySettingId(u), ProviderAbilities.names[u], Resources.formatAbilitySettingDescription(t.title, abilities.cellOf(u).answerLabel)))));
  }
}
