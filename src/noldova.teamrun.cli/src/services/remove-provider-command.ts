/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CliCommandResult } from "@noldova/desktop.cli";
import { MethodName, ProviderIdParams } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import type { CommandValues } from "./command-values.js";
import type { RuntimeClient } from "./runtime-client.js";
import { TeamRunCommand } from "./teamrun-command.js";

export class RemoveProviderCommand extends TeamRunCommand {
  public readonly name: string = Resources.removeProviderCommand;

  public constructor(client: RuntimeClient) {
    super(client);
  }

  protected async runAsync(values: CommandValues, signal: AbortSignal): Promise<CliCommandResult> {
    const providerId = values.readText(Resources.providerIdValue);
    await this.client.requestAsync(MethodName.ProviderDelete, new ProviderIdParams(providerId).toJson(), signal);
    return new CliCommandResult(null, Resources.formatProviderRemoved(providerId));
  }
}
