/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { fileURLToPath } from "node:url";

import { SharedMcpRefusal } from "@noldova/teamrun.core";
import type { SharedMcpServerDefinition } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";
import { SharedMcpLauncher } from "./shared-mcp-launcher.js";

export class SharedMcpLaunch {
  public static readonly runAsNodeVariable: string = "ELECTRON_RUN_AS_NODE";
  public static readonly runAsNodeValue: string = "1";

  private static readonly SCRIPT: URL = new URL("./launch-shared-mcp-server.js", import.meta.url);

  public readonly program: string;
  public readonly script: string;

  public constructor(program: string = process.execPath, script: string = fileURLToPath(SharedMcpLaunch.SCRIPT)) {
    this.program = program;
    this.script = script;
  }

  public argumentsOf(command: string, args: readonly string[], variables: readonly string[]): string[] {
    return [this.script, SharedMcpLauncher.variablesOption, variables.join(SharedMcpLauncher.nameSeparator), SharedMcpLauncher.endOfOptions, command, ...args];
  }

  public environmentOf(values: Readonly<Record<string, string>>): Record<string, string> {
    return { ...values, [SharedMcpLaunch.runAsNodeVariable]: SharedMcpLaunch.runAsNodeValue };
  }

  public refusalOf(server: SharedMcpServerDefinition, provider: string): SharedMcpRefusal | null {
    const withheld = server.referencedVariables.find(t => SharedMcpLauncher.withholds(t));
    return withheld === undefined
      ? null
      : new SharedMcpRefusal(Resources.formatSharedMcpSenderTokenWithheld(provider, withheld), Resources.formatSharedMcpVariableWithheldShort(withheld));
  }
}
