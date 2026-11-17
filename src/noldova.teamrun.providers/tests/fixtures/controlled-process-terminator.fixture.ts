/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ChildProcess } from "node:child_process";
import { ProcessTerminator } from "@noldova/teamrun.providers";

export class ControlledProcessTerminator extends ProcessTerminator {
  private readonly firstCall: PromiseWithResolvers<void> = Promise.withResolvers<void>();

  public ignores: boolean = false;
  public failures: number = 0;
  public calls: number = 0;

  public get called(): Promise<void> {
    return this.firstCall.promise;
  }

  public override async terminate(child: ChildProcess): Promise<void> {
    this.calls++;
    this.firstCall.resolve();
    if (this.failures > 0) {
      this.failures--;
      throw new Error("Fixture termination failure");
    }
    if (!this.ignores)
      await super.terminate(child);
  }
}
