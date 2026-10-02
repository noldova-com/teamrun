/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IDesktopProcess } from "@noldova/teamrun-shell-desktop";

export class FakeDesktopProcess implements IDesktopProcess {
  public readonly argv: readonly string[];
  public readonly env: NodeJS.ProcessEnv;
  public readonly platform: string;
  public readonly execPath: string = "/electron/electron";
  public readonly homeFolder: string;
  public readonly started: string[] = [];

  public constructor(platform: string, argv: readonly string[] = [], env: NodeJS.ProcessEnv = {}, homeFolder: string = "/home/person") {
    this.platform = platform;
    this.argv = argv;
    this.env = env;
    this.homeFolder = homeFolder;
  }

  public startDetached(executablePath: string): void {
    this.started.push(executablePath);
  }
}
