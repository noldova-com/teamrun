/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ProcessProbe {
  public isAlive(processId: number): boolean {
    try {
      process.kill(processId, 0);
      return true;
    }
    catch {
      return false;
    }
  }
}
