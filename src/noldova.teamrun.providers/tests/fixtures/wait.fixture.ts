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

  public static async until(condition: () => boolean, failure: string, timeout: number = Wait.TIMEOUT): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!condition()) {
      if (Date.now() > deadline)
        throw new Error(failure);
      await new Promise(resolve => setTimeout(resolve, Wait.POLL_INTERVAL));
    }
  }

  public static async untilOrSettled(condition: () => boolean, work: Promise<unknown>): Promise<void> {
    let settled = false;
    void work.then(() => { settled = true; }, () => { settled = true; });
    while (!condition() && !settled)
      await Wait.delay(Wait.POLL_INTERVAL);
  }

  public static delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }
}
