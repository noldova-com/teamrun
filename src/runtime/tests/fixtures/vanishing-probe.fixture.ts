/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ProcessProbe } from "@noldova/teamrun-runtime";

export class VanishingProbe extends ProcessProbe {
  private readonly deadRuntime: number;

  public constructor(deadRuntime: number) {
    super();

    this.deadRuntime = deadRuntime;
  }

  public override isAlive(processId: number): boolean {
    return processId !== this.deadRuntime;
  }
}
