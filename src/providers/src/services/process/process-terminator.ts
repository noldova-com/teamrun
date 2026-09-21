/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, execFile } from "node:child_process";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../resources.js";

export class ProcessTerminator {
  private readonly platform: string;

  public constructor(platform: string) {
    this.platform = platform;
  }

  public terminate(child: ChildProcess): Promise<void> {
    if (Object.isUndefined(child.pid) || !Object.isNull(child.exitCode) || !Object.isNull(child.signalCode))
      return Promise.resolve();
    if (this.platform === Resources.windowsPlatform)
      return ProcessTerminator.killTree(child.pid);

    child.kill(Resources.terminateSignal);
    return Promise.resolve();
  }

  private static killTree(processId: number): Promise<void> {
    const args = [Resources.taskkillProcessIdArgument, String(processId), Resources.taskkillTreeArgument, Resources.taskkillForceArgument];
    return new Promise(resolve => execFile(Resources.taskkillExecutable, args, { windowsHide: true }, () => resolve()));
  }
}
