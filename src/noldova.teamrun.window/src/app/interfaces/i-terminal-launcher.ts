/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPartContext } from "@noldova/desktop.window";
import type { LaunchedTerminal, TerminalLaunch } from "@noldova/terminal.window";

export interface ITerminalLauncher {
  openAsync(context: IWindowPartContext, request: TerminalLaunch): Promise<LaunchedTerminal>;
}
