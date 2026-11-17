/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { JsonValue } from "@noldova/context.json";
import { QualifiedName, SettingChange, SettingKey, type SettingScope } from "@noldova/desktop.protocol";
import type { IModuleSettings } from "@noldova/desktop.runtime";

export class DeclaredSettings implements IModuleSettings {
  private static readonly DEVICE_LOCALITY: string = "Device";
  private static readonly SHARED_DEVICE: string = "";

  public readonly device: string;
  private readonly declarations: ReadonlyMap<string, { readonly default: JsonValue; readonly locality: string; readonly type: { readonly minimum?: number; readonly maximum?: number } }>;
  private readonly values: Map<string, JsonValue> = new Map();
  private readonly listeners: Map<string, ((change: SettingChange) => void)[]> = new Map();

  public constructor(device: string = "device-1") {
    const file = join(dirname(fileURLToPath(import.meta.resolve("@noldova/teamrun/package.json"))), "settings.json");
    const declared = JSON.parse(readFileSync(file, "utf8")) as { settings: readonly { name: string; default: JsonValue; locality: string; type: { minimum?: number; maximum?: number } }[] };
    this.device = device;
    this.declarations = new Map(declared.settings.map(t => [t.name, t]));
  }

  public read(name: string, _scope: SettingScope | null = null, device: string | null = null): JsonValue {
    const declaration = this.declare(name);
    if (declaration.locality === DeclaredSettings.DEVICE_LOCALITY && device === null)
      return declaration.default;

    return this.values.get(this.keyOf(name, device)) ?? declaration.default;
  }

  public write(name: string, value: JsonValue, _scope: SettingScope | null = null, device: string | null = null): void {
    const declaration = this.declare(name);
    if (declaration.locality === DeclaredSettings.DEVICE_LOCALITY && device === null)
      throw new Error(`${name} is a device setting given no device.`);
    if (typeof value === "number" && (value < (declaration.type.minimum ?? value) || value > (declaration.type.maximum ?? value)))
      throw new Error(`${name} takes ${declaration.type.minimum} to ${declaration.type.maximum}, not ${value}.`);

    this.values.set(this.keyOf(name, device), value);
    for (const listener of this.listeners.get(name) ?? [])
      listener(new SettingChange(new SettingKey(QualifiedName.parse(name), null, device), value, true));
  }

  public writeFromWindow(name: string, value: JsonValue): void {
    this.write(name, value, null, this.declare(name).locality === DeclaredSettings.DEVICE_LOCALITY ? this.device : null);
  }

  public reset(name: string, _scope: SettingScope | null = null, device: string | null = null): void {
    this.values.delete(this.keyOf(name, device));
  }

  public onChanged(name: string, listener: (change: SettingChange) => void): void {
    this.listeners.set(name, [...this.listeners.get(name) ?? [], listener]);
  }

  public setScopeParent(_scope: SettingScope, _parent: SettingScope | null): void {
    throw new Error("The fixture keeps no scopes.");
  }

  public removeScope(_scope: SettingScope): void {
    throw new Error("The fixture keeps no scopes.");
  }

  private declare(name: string): { readonly default: JsonValue; readonly locality: string; readonly type: { readonly minimum?: number; readonly maximum?: number } } {
    const declaration = this.declarations.get(name);
    if (declaration === undefined)
      throw new Error(`No setting ${name} is declared.`);

    return declaration;
  }

  private keyOf(name: string, device: string | null): string {
    return `${name}\u0000${this.declare(name).locality === DeclaredSettings.DEVICE_LOCALITY ? device : DeclaredSettings.SHARED_DEVICE}`;
  }
}
