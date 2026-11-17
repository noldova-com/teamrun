/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/context.json";
import type { CliCommandResult, ICliCommandHandler } from "@noldova/desktop.cli";

import { CommandValues } from "./command-values.js";
import type { RuntimeClient } from "./runtime-client.js";

export abstract class TeamRunCommand implements ICliCommandHandler {
  protected readonly client: RuntimeClient;

  public abstract readonly name: string;

  protected constructor(client: RuntimeClient) {
    this.client = client;
  }

  public handleAsync(values: Readonly<Record<string, JsonValue>>, signal: AbortSignal): Promise<CliCommandResult> {
    return this.runAsync(new CommandValues(values), signal);
  }

  protected abstract runAsync(values: CommandValues, signal: AbortSignal): Promise<CliCommandResult>;

  protected static reported(values: Readonly<Record<string, JsonValue | undefined>>): JsonObject {
    return Object.fromEntries(Object.entries(values).filter((t): t is [string, JsonValue] => !Object.isNullOrUndefined(t[1])));
  }
}
