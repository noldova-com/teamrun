/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IRestartProcesses {
  waitForExit(processId: number): Promise<void>;
  reopen(dataDirectory: string): Promise<void>;
}
