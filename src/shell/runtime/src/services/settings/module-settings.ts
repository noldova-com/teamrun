/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { QualifiedName, type SettingChange, SettingKey, SettingValue, type SettingScope } from "@noldova/teamrun-shell-protocol";

import { RegistrationException } from "../../exceptions/registration.exception.js";
import type { IModuleSettings } from "../../interfaces/i-module-settings.js";
import type { ModuleDeclaration } from "../../models/module-declaration.js";
import { Resources } from "../../resources.js";
import type { SettingsService } from "./settings.service.js";

export class ModuleSettings implements IModuleSettings {
  private readonly declaration: ModuleDeclaration;
  private readonly settings: SettingsService;
  private readonly registrations: Disposable[];

  public constructor(declaration: ModuleDeclaration, settings: SettingsService, registrations: Disposable[]) {
    this.declaration = declaration;
    this.settings = settings;
    this.registrations = registrations;
  }

  public read(name: string, scope: SettingScope | null = null, device: string | null = null): JsonValue {
    return this.settings.read(new SettingKey(this.requireReadable(name), scope, device));
  }

  public write(name: string, value: JsonValue, scope: SettingScope | null = null, device: string | null = null): void {
    this.settings.write(new SettingValue(new SettingKey(this.requireOwn(name), scope, device), value));
  }

  public reset(name: string, scope: SettingScope | null = null, device: string | null = null): void {
    this.settings.reset(new SettingKey(this.requireOwn(name), scope, device));
  }

  public onChanged(name: string, listener: (change: SettingChange) => void): void {
    const watched = this.requireReadable(name);
    this.registrations.push(this.settings.onChanged(t => {
      if (t.key.name.text === watched.text)
        listener(t);
    }));
  }

  public setScopeParent(scope: SettingScope, parent: SettingScope | null): void {
    this.requireOwnScope(scope);
    if (!Object.isNull(parent) && !this.isOwnOrDependency(parent.name))
      throw new RegistrationException(Resources.formatSettingScopeNotOwned(this.declaration.id, parent.name.text));
    this.settings.setScopeParent(scope, parent);
  }

  public removeScope(scope: SettingScope): void {
    this.requireOwnScope(scope);
    this.settings.removeScope(scope);
  }

  private requireReadable(name: string): QualifiedName {
    const qualified = QualifiedName.parse(name);
    if (!qualified.isShell && !this.isOwnOrDependency(qualified))
      throw new RegistrationException(Resources.formatSettingNotReadable(this.declaration.id, name));
    this.settings.define(qualified);
    return qualified;
  }

  private requireOwn(name: string): QualifiedName {
    if (!this.declaration.listContributions(Resources.settingsKind).includes(name))
      throw new RegistrationException(Resources.formatSettingNotWritable(this.declaration.id, name));
    return QualifiedName.parse(name);
  }

  private requireOwnScope(scope: SettingScope): void {
    if (!this.declaration.listContributions(Resources.settingScopesKind).includes(scope.name.text))
      throw new RegistrationException(Resources.formatSettingScopeNotOwned(this.declaration.id, scope.name.text));
  }

  private isOwnOrDependency(name: QualifiedName): boolean {
    return name.owner === this.declaration.id || this.declaration.dependencies.includes(name.owner);
  }
}
