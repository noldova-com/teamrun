/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";

import type { IMethodHandler } from "../../interfaces/i-method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import type { CommandRegistry } from "../registry/command-registry.js";

export class CommandsMethod implements IMethodHandler {
  private readonly commands: CommandRegistry;

  public constructor(commands: CommandRegistry) {
    this.commands = commands;
  }

  public async handleAsync(_context: RequestContext): Promise<JsonValue> {
    return this.commands.list.toJson();
  }
}
