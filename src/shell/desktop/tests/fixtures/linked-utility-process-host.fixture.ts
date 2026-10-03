/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IUtilityProcessHost } from "@noldova/teamrun-shell-desktop";
import type { IProcessStarter } from "@noldova/teamrun-shell-runtime";

import { LinkedUtilityProcess } from "./linked-utility-process.fixture.js";

export class LinkedUtilityProcessHost implements IUtilityProcessHost {
  private readonly starter: IProcessStarter;

  public constructor(starter: IProcessStarter) {
    this.starter = starter;
  }

  public fork(): LinkedUtilityProcess {
    return new LinkedUtilityProcess(this.starter);
  }
}
