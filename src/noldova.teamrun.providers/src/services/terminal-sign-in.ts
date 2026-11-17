/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";

import "@noldova/context.core";

import { ProviderSignInCommand } from "@noldova/teamrun.protocol";

import type { ProcessCommand } from "../models/process-command.js";
import { Resources } from "../resources.js";

export class TerminalSignIn {
  public static of(command: ProcessCommand | null, signInCommand: string | null, environment: NodeJS.ProcessEnv): ProviderSignInCommand | null {
    if (Object.isNull(command) || Object.isNull(signInCommand))
      return null;
    const launcher = signInCommand.split(Resources.acpTerminalWordSeparator, 1).join(String.empty);
    const folder = dirname(command.executable);
    if (!Resources.terminalLauncherExtensions.some(t => existsSync(join(folder, `${launcher}${t}`))))
      return null;
    const name = Object.keys(environment).find(t => t.toUpperCase() === Resources.acpPathVariable) ?? Resources.acpPathVariable;
    return new ProviderSignInCommand(signInCommand, { [name]: [folder, environment[name] ?? String.empty].filter(t => t.length > 0).join(delimiter) });
  }
}
