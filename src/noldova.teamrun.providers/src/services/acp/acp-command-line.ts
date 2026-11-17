/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { AgentLaunchException } from "../../exceptions/agent-launch.exception.js";
import { ProcessCommand } from "../../models/process-command.js";
import { Resources } from "../../resources.js";
import { SharedMcpLauncher } from "../mcp/shared-mcp-launcher.js";

export class AcpCommandLine {
  public static of(platform: string, environment: NodeJS.ProcessEnv, variables: Readonly<Record<string, string>>, command: string, args: readonly string[]): ProcessCommand {
    const values = Object.fromEntries(Object.entries({ ...environment, ...variables }).filter((t): t is [string, string] => !Object.isUndefined(t[1])));
    const launched = new SharedMcpLauncher(platform, environment, String.empty, String.empty).commandOf(command, args, values);
    if (launched.verbatim && args.some(t => Resources.acpLineBreakPattern.test(t)))
      throw new AgentLaunchException(Resources.formatAcpArgumentLineBreak(command));
    return new ProcessCommand(launched.command, launched.args, null, launched.verbatim);
  }
}
