/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
export interface IOrphanSweep {
  endOrphaned(processId: number, isRunning: () => boolean, threadIds: readonly string[], stop: () => Promise<void>): Promise<readonly number[]>;
}
