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

import "@noldova/context.core";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import { QualifiedName, SettingChange, SettingKey, type SettingScope } from "@noldova/desktop.protocol";
import type { IModuleSettings } from "@noldova/desktop.runtime";

import { SettingDeclaration } from "./setting-declaration.fixture.js";

export class DeclaredSettings implements IModuleSettings {
  private static readonly DEVICE_LOCALITY: string = "Device";
  private static readonly SHARED_DEVICE: string = "";
  private static readonly UPDATE_CHECKS: SettingDeclaration = new SettingDeclaration("desktop.updateChecks", "Automatic", DeclaredSettings.DEVICE_LOCALITY);

  public readonly device: string;
  public readonly isDeviceKnown: boolean = true;
  private readonly declarations: ReadonlyMap<string, SettingDeclaration>;
  private readonly values: Map<string, JsonValue> = new Map();
  private readonly listeners: Map<string, ((change: SettingChange) => void)[]> = new Map();

  public constructor(device: string = "device-1") {
    const file = join(dirname(fileURLToPath(import.meta.resolve("@noldova/teamrun/package.json"))), "settings.json");
    const declared = JsonReader.parse(readFileSync(file, "utf8"), file).readObjectArray("settings").map(t => SettingDeclaration.fromJson(t));
    this.device = device;
    this.declarations = new Map([...declared, DeclaredSettings.UPDATE_CHECKS].map(t => [t.name, t]));
  }

  public read(name: string, _scope: SettingScope | null = null, device: string | null = null): JsonValue {
    const declaration = this.declare(name);
    if (declaration.locality === DeclaredSettings.DEVICE_LOCALITY && Object.isNull(device))
      return declaration.defaultValue;

    return this.values.get(this.keyOf(name, device)) ?? declaration.defaultValue;
  }

  public write(name: string, value: JsonValue, _scope: SettingScope | null = null, device: string | null = null): void {
    const declaration = this.declare(name);
    if (declaration.locality === DeclaredSettings.DEVICE_LOCALITY && Object.isNull(device))
      throw new Error(`${name} is a device setting given no device.`);
    if (declaration.refuses(value))
      throw new Error(`${name} takes ${declaration.minimum} to ${declaration.maximum}, not ${value}.`);

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

  public onDeviceKnown(_listener: () => void): void {
    throw new Error("The fixture knows its device from the start.");
  }

  public setScopeParent(_scope: SettingScope, _parent: SettingScope | null): void {
    throw new Error("The fixture keeps no scopes.");
  }

  public removeScope(_scope: SettingScope): void {
    throw new Error("The fixture keeps no scopes.");
  }

  private declare(name: string): SettingDeclaration {
    const declaration = this.declarations.get(name);
    if (Object.isUndefined(declaration))
      throw new Error(`No setting ${name} is declared.`);

    return declaration;
  }

  private keyOf(name: string, device: string | null): string {
    return `${name}\u0000${this.declare(name).locality === DeclaredSettings.DEVICE_LOCALITY ? device : DeclaredSettings.SHARED_DEVICE}`;
  }
}
