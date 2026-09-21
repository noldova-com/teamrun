/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IProcessTracker } from "@noldova/teamrun-providers";

export class RecordingProcessTracker implements IProcessTracker {
  public readonly tracked: { processId: number; executable: string }[] = [];
  public readonly untracked: number[] = [];

  public track(processId: number, executable: string): void {
    this.tracked.push({ processId, executable });
  }

  public untrack(processId: number): void {
    this.untracked.push(processId);
  }
}
