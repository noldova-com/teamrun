/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { SettingDefinition, SettingKind } from "@noldova/teamrun-shell-protocol";

import { DeclarationsFormatException } from "../exceptions/declarations-format.exception.js";
import { Resources } from "../resources.js";

export class ModuleDeclaration {
  public readonly id: string;
  public readonly version: string;
  public readonly displayName: string;
  public readonly description: string;
  public readonly dependencies: readonly string[];
  public readonly runtimePackage: string | null;
  public readonly contributions: ReadonlyMap<string, readonly string[]>;
  public readonly settings: readonly SettingDefinition[];

  public constructor(
    id: string,
    version: string,
    displayName: string,
    description: string,
    dependencies: readonly string[],
    runtimePackage: string | null,
    contributions: ReadonlyMap<string, readonly string[]>,
    settings: readonly SettingDefinition[] = []) {
    if (!Resources.moduleIdPattern.test(id) || id === Resources.reservedModuleId)
      throw new ArgumentException(Resources.moduleIdInvalid, Resources.idParameterName);
    if (!Resources.moduleVersionPattern.test(version))
      throw new ArgumentException(Resources.moduleVersionInvalid, Resources.versionParameterName);
    ArgumentException.throwIfNullOrWhitespace(displayName, Resources.displayNameParameterName);
    ArgumentException.throwIfNullOrWhitespace(description, Resources.descriptionParameterName);
    const foreign = settings.find(t => t.name.owner !== id);
    if (!Object.isUndefined(foreign))
      throw new ArgumentException(Resources.formatSettingOwnerInvalid(id, foreign.name.text), Resources.settingsField);
    const shellOnly = settings.find(t => t.type.kind === SettingKind.KeyBindings);
    if (!Object.isUndefined(shellOnly))
      throw new ArgumentException(Resources.formatSettingKindReserved(id, shellOnly.name.text, shellOnly.type.kind), Resources.settingsField);

    this.id = id;
    this.version = version;
    this.displayName = displayName;
    this.description = description;
    this.dependencies = [...dependencies];
    this.runtimePackage = runtimePackage;
    this.contributions = new Map([...contributions].map(([kind, names]) => [kind, [...names]]));
    this.settings = [...settings];
  }

  public static fromJson(value: unknown): ModuleDeclaration {
    if (!Object.isObject(value) || Array.isArray(value))
      throw new DeclarationsFormatException(Resources.declarationNotObject);
    const id = ModuleDeclaration.readText("id" in value ? value.id : undefined, Resources.idParameterName);
    if (!Resources.moduleIdPattern.test(id) || id === Resources.reservedModuleId)
      throw new DeclarationsFormatException(Resources.formatDeclarationField(Resources.idParameterName));
    const version = ModuleDeclaration.readText("version" in value ? value.version : undefined, Resources.versionParameterName);
    if (!Resources.moduleVersionPattern.test(version))
      throw new DeclarationsFormatException(Resources.formatDeclarationField(Resources.versionParameterName));

    const runtimePackage = "runtimePackage" in value ? value.runtimePackage : undefined;
    const contributes = "contributes" in value ? value.contributes : undefined;
    if (!Object.isObject(contributes) || Array.isArray(contributes))
      throw new DeclarationsFormatException(Resources.formatDeclarationField(Resources.contributesParameterName));
    return new ModuleDeclaration(
      id,
      version,
      ModuleDeclaration.readText("displayName" in value ? value.displayName : undefined, Resources.displayNameParameterName),
      ModuleDeclaration.readText("description" in value ? value.description : undefined, Resources.descriptionParameterName),
      ModuleDeclaration.readNames("dependencies" in value ? value.dependencies : undefined, Resources.dependenciesParameterName),
      Object.isNull(runtimePackage) ? null : ModuleDeclaration.readText(runtimePackage, Resources.runtimePackageParameterName),
      new Map(Object.entries(contributes).map(([kind, names]) => [kind, ModuleDeclaration.readNames(names, Resources.contributesParameterName)])),
      ModuleDeclaration.readSettings("settings" in value ? value.settings : []));
  }

  public listContributions(kind: string): readonly string[] {
    return this.contributions.get(kind) ?? [];
  }

  private static readSettings(value: unknown): readonly SettingDefinition[] {
    if (!Array.isArray(value))
      throw new DeclarationsFormatException(Resources.formatDeclarationField(Resources.settingsField));
    try {
      return value.map(t => SettingDefinition.fromJson(t));
    }
    catch (error) {
      throw new DeclarationsFormatException(Resources.formatDeclarationField(Resources.settingsField), new ExceptionOptions(error));
    }
  }

  private static readText(value: unknown, name: string): string {
    if (!Object.isString(value) || String.isNullOrWhitespace(value))
      throw new DeclarationsFormatException(Resources.formatDeclarationField(name));
    return value;
  }

  private static readNames(value: unknown, name: string): readonly string[] {
    if (!Array.isArray(value) || !value.every(t => Object.isString(t) && !String.isNullOrWhitespace(t)))
      throw new DeclarationsFormatException(Resources.formatDeclarationField(name));
    return value.map(t => String(t));
  }
}
