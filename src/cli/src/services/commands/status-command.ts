/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import type { ICommand } from "../../interfaces/i-command.js";
import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import { OutputWriter } from "../output-writer.js";

export class StatusCommand implements ICommand {
  public readonly name: string = Resources.statusCommand;
  public readonly description: string = Resources.statusDescription;

  public run(context: CommandContext): Promise<number> {
    const output = new OutputWriter(context.console, context.settings.isJson);
    const lock = context.connections.readLiveLock();
    if (Object.isNull(lock)) {
      output.writeText(Resources.noRuntime, null);
      return Promise.resolve(Resources.exitFailure);
    }

    const text = Resources.formatRuntimeStatus(lock.processId, lock.endpoint.describe(), lock.productVersion, lock.protocolVersion.toString(), lock.startedAt);
    output.writeText(text, {
      processId: lock.processId,
      endpoint: lock.endpoint.toJson(),
      protocolVersion: lock.protocolVersion.toJson(),
      productVersion: lock.productVersion,
      startedAt: lock.startedAt
    });
    return Promise.resolve(Resources.exitSuccess);
  }
}
