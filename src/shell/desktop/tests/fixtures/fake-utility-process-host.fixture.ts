/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IUtilityProcessHost } from "@noldova/teamrun-shell-desktop";

import { FakeUtilityProcess } from "./fake-utility-process.fixture.js";

export class FakeUtilityProcessHost implements IUtilityProcessHost {
  public readonly forks: { modulePath: string; args: string[]; options: { stdio: "ignore"; serviceName: string }; process: FakeUtilityProcess }[] = [];

  public fork(modulePath: string, args: string[], options: { stdio: "ignore"; serviceName: string }): FakeUtilityProcess {
    const process = new FakeUtilityProcess();
    this.forks.push({ modulePath, args, options, process });
    return process;
  }
}
