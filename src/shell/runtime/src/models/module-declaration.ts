/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { DeclarationsFormatException } from "../exceptions/declarations-format.exception.js";
import { Resources } from "../resources.js";

export class ModuleDeclaration {
  public readonly id: string;
  public readonly displayName: string;
  public readonly dependencies: readonly string[];
  public readonly runtimePackage: string | null;
  public readonly contributions: ReadonlyMap<string, readonly string[]>;

  public constructor(
    id: string,
    displayName: string,
    dependencies: readonly string[],
    runtimePackage: string | null,
    contributions: ReadonlyMap<string, readonly string[]>) {
    if (!Resources.moduleIdPattern.test(id) || id === Resources.reservedModuleId)
      throw new ArgumentException(Resources.moduleIdInvalid, Resources.idParameterName);
    ArgumentException.throwIfNullOrWhitespace(displayName, Resources.displayNameParameterName);

    this.id = id;
    this.displayName = displayName;
    this.dependencies = [...dependencies];
    this.runtimePackage = runtimePackage;
    this.contributions = new Map([...contributions].map(([kind, names]) => [kind, [...names]]));
  }

  public static fromJson(value: unknown): ModuleDeclaration {
    if (!Object.isObject(value) || Array.isArray(value))
      throw new DeclarationsFormatException(Resources.declarationNotObject);
    const id = ModuleDeclaration.readText("id" in value ? value.id : undefined, Resources.idParameterName);
    if (!Resources.moduleIdPattern.test(id) || id === Resources.reservedModuleId)
      throw new DeclarationsFormatException(Resources.formatDeclarationField(Resources.idParameterName));

    const runtimePackage = "runtimePackage" in value ? value.runtimePackage : undefined;
    const contributes = "contributes" in value ? value.contributes : undefined;
    if (!Object.isObject(contributes) || Array.isArray(contributes))
      throw new DeclarationsFormatException(Resources.formatDeclarationField(Resources.contributesParameterName));
    return new ModuleDeclaration(
      id,
      ModuleDeclaration.readText("displayName" in value ? value.displayName : undefined, Resources.displayNameParameterName),
      ModuleDeclaration.readNames("dependencies" in value ? value.dependencies : undefined, Resources.dependenciesParameterName),
      Object.isNull(runtimePackage) ? null : ModuleDeclaration.readText(runtimePackage, Resources.runtimePackageParameterName),
      new Map(Object.entries(contributes).map(([kind, names]) => [kind, ModuleDeclaration.readNames(names, Resources.contributesParameterName)])));
  }

  public listContributions(kind: string): readonly string[] {
    return this.contributions.get(kind) ?? [];
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
