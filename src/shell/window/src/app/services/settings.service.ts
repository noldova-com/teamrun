/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, Injectable, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import {
  QualifiedName,
  SettingChange,
  SettingKey,
  SettingValue,
  SettingsQuery,
  SettingsSnapshot,
  ShellEvents,
  ShellMethods,
  type SettingDefinition,
  type SettingScope
} from "@noldova/teamrun-shell-protocol";

import { DesktopBridgeService } from "./desktop-bridge.service";

@Injectable({ providedIn: "root" })
export class SettingsService {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly definitionList: WritableSignal<readonly SettingDefinition[]> = signal([]);
  private readonly valueMap: WritableSignal<ReadonlyMap<string, JsonValue>> = signal(new Map());
  private readonly setNames: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly listeners: Set<(change: SettingChange) => void> = new Set();
  private loads: number = 0;
  private loading: number = 0;
  private received: SettingChange[] = [];

  public readonly definitions: Signal<readonly SettingDefinition[]> = this.definitionList.asReadonly();
  public readonly values: Signal<ReadonlyMap<string, JsonValue>> = this.valueMap.asReadonly();

  public constructor() {
    inject(DestroyRef).onDestroy(this.bridge.onEvent((name, payload) => {
      if (name === ShellEvents.settingsChanged.text)
        this.apply(SettingChange.fromJson(payload));
    }));
  }

  public async loadAsync(): Promise<void> {
    const load = ++this.loads;
    this.loading++;
    try {
      const snapshot = SettingsSnapshot.fromJson(await this.bridge.requestAsync(ShellMethods.settings.text, new SettingsQuery(null).toJson()));
      if (load === this.loads) {
        this.definitionList.set(snapshot.definitions);
        this.valueMap.set(new Map(snapshot.entries.map(t => [t.name.text, t.value])));
        this.setNames.set(new Set(snapshot.entries.filter(t => t.isSet).map(t => t.name.text)));
        for (const change of this.received)
          this.store(change);
      }
    }
    finally {
      if (--this.loading === 0)
        this.received = [];
    }
  }

  public value(name: string): Signal<JsonValue | undefined> {
    return computed(() => this.valueMap().get(name));
  }

  public isSet(name: string): Signal<boolean> {
    return computed(() => this.setNames().has(name));
  }

  public read(name: string): JsonValue | undefined {
    return this.valueMap().get(name);
  }

  public async setAsync(name: string, value: JsonValue, scope: SettingScope | null = null): Promise<void> {
    await this.bridge.requestAsync(ShellMethods.setSetting.text, new SettingValue(new SettingKey(QualifiedName.parse(name), scope), value).toJson());
  }

  public async resetAsync(name: string, scope: SettingScope | null = null): Promise<void> {
    await this.bridge.requestAsync(ShellMethods.resetSetting.text, new SettingKey(QualifiedName.parse(name), scope).toJson());
  }

  public onChanged(listener: (change: SettingChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private apply(change: SettingChange): void {
    if (this.loading > 0)
      this.received.push(change);
    this.store(change);
    for (const listener of [...this.listeners])
      listener(change);
  }

  private store(change: SettingChange): void {
    if (!Object.isNull(change.key.scope))
      return;
    const name = change.key.name.text;
    this.valueMap.update(t => new Map([...t, [name, change.value]]));
    this.setNames.update(t => new Set(change.isSet ? [...t, name] : [...t].filter(u => u !== name)));
  }
}
