/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { UpdateProcess } from "@noldova/teamrun-shell-protocol";
import type { ProcessPresence } from "@noldova/teamrun-shell-runtime";

export class FakeProcessPresence implements Pick<ProcessPresence, "stampAsync" | "isRunningAsync"> {
  public readonly running: Set<number> = new Set();
  public readonly checked: number[] = [];
  public isStamping: boolean = true;
  public failure: unknown = null;
  public onCheck?: (process: UpdateProcess) => void;

  public stampAsync(processes: readonly (readonly [number, string])[]): Promise<readonly UpdateProcess[]> {
    return Promise.resolve(this.isStamping ? processes.map(([processId, role]) => new UpdateProcess(processId, 1500, 1501, role)) : []);
  }

  public isRunningAsync(process: UpdateProcess): Promise<boolean> {
    this.checked.push(process.processId);
    this.onCheck?.(process);
    return Object.isNull(this.failure) ? Promise.resolve(this.running.has(process.processId)) : Promise.reject(this.failure);
  }
}
