/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonReader } from "@noldova/context.json";

import { AcpRegistryException } from "../exceptions/acp-registry.exception.js";
import { Resources } from "../resources.js";

export class AcpRegistryPackage {
  public readonly name: string;
  public readonly arguments: readonly string[];
  public readonly environment: Readonly<Record<string, string>>;

  public constructor(name: string, args: readonly string[], environment: Readonly<Record<string, string>>) {
    this.name = name;
    this.arguments = [...args];
    this.environment = { ...environment };
  }

  public get isExactNpmPackage(): boolean {
    return this.name.length <= Resources.acpNpmPackageMaxLength && Resources.acpNpmPackagePattern.test(this.name);
  }

  public get npmPackageName(): string {
    return this.name.slice(0, this.name.lastIndexOf(Resources.acpNpmVersionSeparator));
  }

  public get npmVersion(): string {
    return this.name.slice(this.name.lastIndexOf(Resources.acpNpmVersionSeparator) + 1);
  }

  public static fromJson(reader: JsonReader): AcpRegistryPackage {
    return new AcpRegistryPackage(reader.readNonBlankString(Resources.acpRegistryPackageField), AcpRegistryPackage.argumentsOf(reader),
      AcpRegistryPackage.environmentOf(reader));
  }

  public toJson(): JsonObject {
    return { [Resources.acpRegistryPackageField]: this.name, [Resources.acpRegistryArgumentsField]: [...this.arguments], [Resources.acpRegistryEnvironmentField]: { ...this.environment } };
  }

  public static argumentsOf(reader: JsonReader): readonly string[] {
    return reader.hasField(Resources.acpRegistryArgumentsField) ? reader.readStringArray(Resources.acpRegistryArgumentsField) : [];
  }

  public static environmentOf(reader: JsonReader): Readonly<Record<string, string>> {
    if (!reader.hasField(Resources.acpRegistryEnvironmentField))
      return {};
    const entries = Object.entries(reader.readObject(Resources.acpRegistryEnvironmentField).toJson());
    const invalid = entries.find(([name, value]) => !Resources.acpRegistryVariablePattern.test(name) || typeof value !== "string");
    if (!Object.isUndefined(invalid))
      throw new AcpRegistryException(Resources.formatAcpRegistryVariableInvalid(invalid[0]));
    return Object.fromEntries(entries as [string, string][]);
  }
}
