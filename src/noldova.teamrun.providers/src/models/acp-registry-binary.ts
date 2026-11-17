/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import "@noldova/context.core";
import type { JsonObject, JsonReader } from "@noldova/context.json";

import { AcpRegistryException } from "../exceptions/acp-registry.exception.js";
import { Resources } from "../resources.js";
import { AcpRegistryPackage } from "./acp-registry-package.js";
import { ProcessCommand } from "./process-command.js";

export class AcpRegistryBinary {
  public readonly archive: string;
  public readonly command: readonly string[];
  public readonly arguments: readonly string[];
  public readonly environment: Readonly<Record<string, string>>;
  public readonly sha256: string | null;

  public constructor(archive: string, command: readonly string[], args: readonly string[], environment: Readonly<Record<string, string>>, sha256: string | null) {
    this.archive = archive;
    this.command = [...command];
    this.arguments = [...args];
    this.environment = { ...environment };
    this.sha256 = sha256;
  }

  public get isZip(): boolean {
    return this.archivePath.endsWith(Resources.acpArchiveZipExtension);
  }

  public get isRaw(): boolean {
    return !this.isZip && !Resources.acpArchiveTarExtensions.some(t => this.archivePath.endsWith(t));
  }

  private get archivePath(): string {
    return new URL(this.archive).pathname.toLowerCase();
  }

  public static fromJson(reader: JsonReader): AcpRegistryBinary {
    const archive = reader.readNonBlankString(Resources.acpRegistryArchiveField);
    if (!Resources.acpRegistryArchivePattern.test(archive))
      throw new AcpRegistryException(Resources.formatAcpRegistryArchiveInvalid(archive));
    const command = reader.readNonBlankString(Resources.acpRegistryCommandField);
    const segments = command.split(Resources.acpRegistryPathSeparators).filter(t => t !== Resources.acpRegistryCurrentFolder && t.length > 0);
    if (segments.length === 0 || segments.includes(Resources.acpRegistryParentFolder) || Resources.acpRegistryRootedPattern.test(command))
      throw new AcpRegistryException(Resources.formatAcpRegistryCommandInvalid(command));
    const sha256 = reader.readOptionalString(Resources.acpRegistrySha256Field)?.toLowerCase() ?? null;
    if (!Object.isNull(sha256) && !Resources.sha256Pattern.test(sha256))
      throw new AcpRegistryException(Resources.formatAcpRegistrySha256Invalid(sha256));
    return new AcpRegistryBinary(archive, segments, AcpRegistryPackage.argumentsOf(reader), AcpRegistryPackage.environmentOf(reader), sha256);
  }

  public toJson(): JsonObject {
    return { [Resources.acpRegistryArchiveField]: this.archive, [Resources.acpRegistryCommandField]: this.command.join(Resources.acpNpmScopeSeparator),
      [Resources.acpRegistryArgumentsField]: [...this.arguments], [Resources.acpRegistryEnvironmentField]: { ...this.environment },
      ...Object.isNull(this.sha256) ? {} : { [Resources.acpRegistrySha256Field]: this.sha256 } };
  }

  public commandIn(folder: string): ProcessCommand {
    return new ProcessCommand(join(folder, ...this.command), this.arguments);
  }
}
