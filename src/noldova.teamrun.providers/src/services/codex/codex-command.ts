/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import type { TurnRequest } from "@noldova/teamrun.core";

import { Resources } from "../../resources.js";
import { AcpCommands } from "../acp/acp-commands.js";

export class CodexCommand {
  public readonly name: string;
  public readonly argument: string;

  private constructor(name: string, argument: string) {
    this.name = name;
    this.argument = argument;
  }

  public static of(request: TurnRequest): CodexCommand | null {
    const command = request.compacts ? null : request.command;
    if (Object.isNull(command))
      return null;
    const name = AcpCommands.nameOf(command);
    return Resources.codexAppServerCommandNames.includes(name)
      ? new CodexCommand(name, command.slice(Resources.acpCommandPrefix.length + name.length).trim()) : null;
  }

  public get shown(): string {
    return Resources.acpCommandPrefix + this.name;
  }

  public get isReview(): boolean {
    return this.name === Resources.codexReviewCommand;
  }

  public get reviewTarget(): JsonObject {
    return this.argument.length === 0 ? { [Resources.typeField]: Resources.reviewUncommittedTarget }
      : { [Resources.typeField]: Resources.reviewCustomTarget, [Resources.reviewInstructionsField]: this.argument };
  }
}
