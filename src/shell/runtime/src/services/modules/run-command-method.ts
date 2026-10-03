/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { CommandRun, Failure, FailureCode } from "@noldova/teamrun-shell-protocol";

import { MethodFailureException } from "../../exceptions/method-failure.exception.js";
import type { IMethodHandler } from "../../interfaces/method-handler.js";
import { RequestContext } from "../../models/request-context.js";
import { Resources } from "../../resources.js";
import type { CommandRegistry } from "../registry/command-registry.js";

export class RunCommandMethod implements IMethodHandler {
  private readonly commands: CommandRegistry;

  public constructor(commands: CommandRegistry) {
    this.commands = commands;
  }

  public async handleAsync(context: RequestContext): Promise<JsonValue> {
    const run = CommandRun.fromJson(context.payload);
    const command = this.commands.find(run.name);
    if (Object.isUndefined(command))
      throw new MethodFailureException(new Failure(FailureCode.NotFound, Resources.formatCommandNotFound(run.name.text)));
    if (!command.info.isEnabled)
      throw new MethodFailureException(new Failure(FailureCode.Unavailable, Resources.formatCommandNotEnabled(run.name.text)));
    return command.handler.handleAsync(new RequestContext(context.client, run.commandArguments, context.signal));
  }
}
