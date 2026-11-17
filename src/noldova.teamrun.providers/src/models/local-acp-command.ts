/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonObject, JsonReader } from "@noldova/context.json";
import { SharedMcpSecret } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import { AcpCommandLine } from "../services/acp/acp-command-line.js";
import { GeneralAcpAgent } from "../services/acp/general-acp-agent.js";
import { AcpRegistryAgent } from "./acp-registry-agent.js";
import { AcpRegistryPackage } from "./acp-registry-package.js";
import type { ProcessCommand } from "./process-command.js";

export class LocalAcpCommand {
  public readonly id: string;
  public readonly name: string;
  public readonly command: string;
  public readonly arguments: readonly string[];
  public readonly secrets: readonly SharedMcpSecret[];

  public constructor(id: string, name: string, command: string, args: readonly string[] = [], secrets: readonly SharedMcpSecret[] = []) {
    if (!AcpRegistryAgent.isUsableId(id))
      throw new ArgumentException(Resources.formatLocalAcpIdInvalid(id), Resources.idField);
    ArgumentException.throwIfNullOrWhitespace(name, Resources.nameField);
    ArgumentException.throwIfNullOrWhitespace(command, Resources.acpRegistryCommandField);

    this.id = id;
    this.name = name.trim();
    this.command = command.trim();
    this.arguments = [...args];
    this.secrets = [...secrets];
  }

  public get kindId(): string {
    return `${Resources.localAcpKindPrefix}${this.id}`;
  }

  public static fromJson(reader: JsonReader): LocalAcpCommand {
    const secrets = reader.hasField(Resources.acpLocalSecretsField) ? reader.readObjectArray(Resources.acpLocalSecretsField).map(t => SharedMcpSecret.fromJson(t.toJson())) : [];
    return new LocalAcpCommand(reader.readNonBlankString(Resources.idField), reader.readNonBlankString(Resources.nameField),
      reader.readNonBlankString(Resources.acpRegistryCommandField), AcpRegistryPackage.argumentsOf(reader), secrets);
  }

  public toJson(): JsonObject {
    return { [Resources.idField]: this.id, [Resources.nameField]: this.name, [Resources.acpRegistryCommandField]: this.command,
      [Resources.acpRegistryArgumentsField]: [...this.arguments], [Resources.acpLocalSecretsField]: this.secrets.map(t => t.toJson()) };
  }

  public toAgent(values: Readonly<Record<string, string>> | (() => Readonly<Record<string, string>>), environment: NodeJS.ProcessEnv, homeDirectory: string,
    platform: string = process.platform): GeneralAcpAgent {
    return new GeneralAcpAgent(this.kindId, this.name, null, values, environment, homeDirectory,
      () => this.commandFor(platform, environment, typeof values === "function" ? {} : values), () => this.arguments.length === 0 ? this.command : null);
  }

  public commandFor(platform: string, environment: NodeJS.ProcessEnv, values: Readonly<Record<string, string>> = {}): ProcessCommand {
    return AcpCommandLine.of(platform, environment, values, this.command, this.arguments);
  }
}
