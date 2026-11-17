/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import type { IStoredRun } from "./i-stored-run";

export interface IKeptRuns {
  listAsync(owner: string): Promise<readonly IStoredRun[]>;
  save(owner: string, run: IStoredRun): void;
}
