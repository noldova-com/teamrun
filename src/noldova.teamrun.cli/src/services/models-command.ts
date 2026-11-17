/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CliCommandResult } from "@noldova/desktop.cli";

import { Resources } from "../resources.js";
import type { CommandValues } from "./command-values.js";
import type { RuntimeClient } from "./runtime-client.js";
import { TeamRunCommand } from "./teamrun-command.js";

export class ModelsCommand extends TeamRunCommand {
  public readonly name: string = Resources.modelsCommand;

  public constructor(client: RuntimeClient) {
    super(client);
  }

  protected async runAsync(values: CommandValues, signal: AbortSignal): Promise<CliCommandResult> {
    const provider = await this.client.findProviderAsync(values.readText(Resources.providerIdValue), signal);
    const models = (await this.client.readModelsAsync(provider.kind, provider.id, signal)).models;
    return new CliCommandResult(models.map(t => t.toJson()), Resources.formatList(models.map(t => Resources.formatModel(t))));
  }
}
