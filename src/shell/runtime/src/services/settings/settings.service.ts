/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { isDeepStrictEqual } from "node:util";
import type { Writable } from "node:stream";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import {
  FailureCode,
  QualifiedName,
  SettingChange,
  SettingEntry,
  SettingKey,
  SettingLocality,
  SettingScope,
  SettingsSnapshot,
  type SettingValue,
  type SettingDefinition
} from "@noldova/teamrun-shell-protocol";

import { SettingException } from "../../exceptions/setting.exception.js";
import { Resources } from "../../resources.js";
import type { ShellDatabase } from "../database/shell-database.js";

export class SettingsService {
  private readonly database: ShellDatabase;
  private readonly diagnostics: Writable;
  private readonly definitions: ReadonlyMap<string, SettingDefinition>;
  private readonly listeners: Set<(change: SettingChange) => void> = new Set();
  private readonly reported: Set<string> = new Set();

  public constructor(database: ShellDatabase, definitions: readonly SettingDefinition[], diagnostics: Writable) {
    this.database = database;
    this.diagnostics = diagnostics;
    this.definitions = new Map(definitions.map(t => [t.name.text, t]));
  }

  public define(name: QualifiedName): SettingDefinition {
    const definition = this.definitions.get(name.text);
    if (Object.isUndefined(definition))
      throw new SettingException(Resources.formatSettingUnknown(name.text), FailureCode.NotFound);
    return definition;
  }

  public read(key: SettingKey): JsonValue {
    const definition = this.define(key.name);
    SettingsService.requireListedScope(definition, key);
    return this.resolve(definition, key)?.value ?? definition.defaultValue;
  }

  public readEntry(key: SettingKey): SettingEntry {
    const definition = this.define(key.name);
    const stored = this.resolve(definition, this.normalize(definition, key));
    return new SettingEntry(definition.name, stored?.value ?? definition.defaultValue, stored?.isOwn === true);
  }

  public readDevices(name: QualifiedName): ReadonlyMap<string, JsonValue> {
    const definition = this.define(name);
    const rows = this.database.readAll(Resources.readSettingDevicesStatement, name.text);
    return new Map(rows.flatMap(t => {
      const device = String(t[Resources.deviceColumn]);
      const value = this.accept(definition, String(t[Resources.valueColumn]), Resources.applicationScope, device);
      return Object.isUndefined(value) ? [] : [[device, value] as const];
    }));
  }

  public snapshot(device: string | null): SettingsSnapshot {
    const definitions = [...this.definitions.values()];
    return new SettingsSnapshot(definitions, definitions.map(t => {
      const stored = this.resolve(t, new SettingKey(t.name, null, device));
      return new SettingEntry(t.name, stored?.value ?? t.defaultValue, !Object.isUndefined(stored));
    }));
  }

  public write(write: SettingValue): void {
    const definition = this.define(write.key.name);
    const key = this.normalize(definition, write.key);
    if (!definition.type.accepts(write.value))
      throw new SettingException(Resources.formatSettingValueInvalid(key.name.text), FailureCode.InvalidParams);

    if (isDeepStrictEqual(write.value, definition.defaultValue) && isDeepStrictEqual(this.resolve(definition, key, true)?.value ?? definition.defaultValue, write.value)) {
      this.reset(key);
      return;
    }
    this.database.run(Resources.writeSettingStatement, ...SettingsService.columns(key), JSON.stringify(write.value));
    this.notify(new SettingChange(key, write.value, true));
  }

  public reset(key: SettingKey): void {
    const normalized = this.normalize(this.define(key.name), key);
    this.database.run(Resources.resetSettingStatement, ...SettingsService.columns(normalized));
    this.notify(new SettingChange(normalized, this.read(normalized), false));
  }

  public setScopeParent(scope: SettingScope, parent: SettingScope | null): void {
    if (Object.isNull(parent))
      this.database.run(Resources.removeScopeParentStatement, scope.name.text, scope.id);
    else
      this.database.run(Resources.writeScopeParentStatement, scope.name.text, scope.id, parent.name.text, parent.id);
  }

  public removeScope(scope: SettingScope): void {
    this.database.transaction(() => {
      this.database.run(Resources.removeScopeValuesStatement, scope.name.text, scope.id);
      this.database.run(Resources.removeScopeParentStatement, scope.name.text, scope.id);
    });
  }

  public onChanged(listener: (change: SettingChange) => void): Disposable {
    this.listeners.add(listener);
    return { [Symbol.dispose]: () => this.listeners.delete(listener) };
  }

  private static columns(key: SettingKey): readonly [string, string, string, string] {
    return [key.name.text, key.scope?.name.text ?? Resources.applicationScope, key.scope?.id ?? Resources.applicationScope, key.device ?? Resources.sharedDevice];
  }

  private static requireListedScope(definition: SettingDefinition, key: SettingKey): void {
    if (!Object.isNull(key.scope) && !definition.isScopedBy(key.scope.name))
      throw new SettingException(Resources.formatSettingScopeNotAllowed(key.name.text, key.scope.name.text), FailureCode.InvalidParams);
  }

  private normalize(definition: SettingDefinition, key: SettingKey): SettingKey {
    SettingsService.requireListedScope(definition, key);
    if (definition.locality === SettingLocality.Shared)
      return new SettingKey(key.name, key.scope);
    if (Object.isNull(key.device))
      throw new SettingException(Resources.formatSettingNeedsDevice(key.name.text), FailureCode.InvalidParams);
    return key;
  }

  private resolve(definition: SettingDefinition, key: SettingKey, inherited: boolean = false): { readonly value: JsonValue; readonly isOwn: boolean } | undefined {
    const device = definition.locality === SettingLocality.Device ? key.device : null;
    if (definition.locality === SettingLocality.Device && Object.isNull(device))
      return undefined;
    for (const [index, scope] of this.chain(definition.locality === SettingLocality.Device ? null : key.scope).slice(inherited ? 1 : 0).entries()) {
      if (!Object.isNull(scope) && !definition.isScopedBy(scope.name))
        continue;
      const columns = SettingsService.columns(new SettingKey(definition.name, scope, device));
      const text = this.database.read(Resources.readSettingStatement, ...columns)?.[Resources.valueColumn];
      const value = Object.isString(text) ? this.accept(definition, text, Object.isNull(scope) ? Resources.applicationScope : `${scope.name.text} ${scope.id}`, columns[3]) : undefined;
      if (!Object.isUndefined(value))
        return { value, isOwn: !inherited && index === 0 };
    }
    return undefined;
  }

  private chain(scope: SettingScope | null): readonly (SettingScope | null)[] {
    const chain: SettingScope[] = [];
    let current = scope;
    while (!Object.isNull(current) && !chain.some(t => t.equals(current))) {
      chain.push(current);
      current = this.parentOf(current);
    }
    return [...chain, null];
  }

  private parentOf(scope: SettingScope): SettingScope | null {
    const row = this.database.read(Resources.readScopeParentStatement, scope.name.text, scope.id);
    return Object.isUndefined(row) ? null : new SettingScope(QualifiedName.parse(String(row[Resources.parentNameColumn])), String(row[Resources.parentIdColumn]));
  }

  private accept(definition: SettingDefinition, text: string, scope: string, device: string): JsonValue | undefined {
    const value = SettingsService.parse(text);
    if (!Object.isUndefined(value) && definition.type.accepts(value))
      return value;
    const report = `${definition.name.text}\u0000${scope}\u0000${device}`;
    if (!this.reported.has(report)) {
      this.reported.add(report);
      this.diagnostics.write(Resources.formatSettingValueIgnored(definition.name.text, scope, device));
    }
    return undefined;
  }

  private notify(change: SettingChange): void {
    for (const listener of [...this.listeners])
      listener(change);
  }

  private static parse(text: string): JsonValue | undefined {
    try {
      return JSON.parse(text) as JsonValue;
    }
    catch {
      return undefined;
    }
  }
}
