/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CliCommandResult } from "@noldova/desktop.cli";
import { MethodName, Provider, ProviderCreateParams } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import type { CommandValues } from "./command-values.js";
import type { RuntimeClient } from "./runtime-client.js";
import { TeamRunCommand } from "./teamrun-command.js";

export class AddProviderCommand extends TeamRunCommand {
  public readonly name: string = Resources.addProviderCommand;

  public constructor(client: RuntimeClient) {
    super(client);
  }

  protected async runAsync(values: CommandValues, signal: AbortSignal): Promise<CliCommandResult> {
    const params = new ProviderCreateParams(values.readText(Resources.kindValue), values.readText(Resources.labelValue), null);
    const provider = Provider.fromJson(await this.client.requestAsync(MethodName.ProviderCreate, params.toJson(), signal));
    return new CliCommandResult(provider.toJson(), Resources.formatProviderAdded(provider));
  }
}
