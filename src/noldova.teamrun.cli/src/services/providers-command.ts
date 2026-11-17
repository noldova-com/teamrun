/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";
import { CliCommandResult } from "@noldova/desktop.cli";
import { MethodName, PlanUsage, Provider } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import type { CommandValues } from "./command-values.js";
import type { RuntimeClient } from "./runtime-client.js";
import { TeamRunCommand } from "./teamrun-command.js";

export class ProvidersCommand extends TeamRunCommand {
  public readonly name: string = Resources.providersCommand;

  public constructor(client: RuntimeClient) {
    super(client);
  }

  protected async runAsync(_values: CommandValues, signal: AbortSignal): Promise<CliCommandResult> {
    const providers = await this.client.listAsync(MethodName.ProviderList, null, signal, t => Provider.fromJson(t));
    const plans = await this.client.listAsync(MethodName.PlanUsageList, null, signal, t => PlanUsage.fromJson(t));
    const rows: JsonObject[] = [];
    const lines: string[] = [];
    for (const provider of providers) {
      const windows = plans.find(t => t.providerId === provider.id && t.kind === provider.kind)?.windows ?? [];
      rows.push({ ...provider.toJson(), [Resources.planWindowsField]: windows.map(t => ProvidersCommand.reported(t.toJson())) });
      lines.push(Resources.formatProvider(provider));
      if (windows.length > 0)
        lines.push(Resources.formatPlanWindows(windows));
    }
    return new CliCommandResult(rows, Resources.formatList(lines));
  }
}
