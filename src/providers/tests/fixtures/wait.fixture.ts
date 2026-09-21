/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Wait {
  private static readonly POLL_INTERVAL: number = 10;
  private static readonly TIMEOUT: number = 5000;

  public static async until(condition: () => boolean): Promise<void> {
    const deadline = Date.now() + Wait.TIMEOUT;
    while (!condition()) {
      if (Date.now() > deadline)
        throw new Error("The condition did not become true in time.");
      await new Promise(resolve => setTimeout(resolve, Wait.POLL_INTERVAL));
    }
  }

  public static delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }
}
