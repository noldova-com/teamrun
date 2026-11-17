/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ChangeSignal {
  private static readonly waits: (() => void)[] = [];

  public static notify(): void {
    for (const wake of ChangeSignal.waits.splice(0))
      wake();
  }

  public static async after<T>(work: Promise<T>): Promise<T> {
    ChangeSignal.notify();
    try {
      return await work;
    }
    finally {
      ChangeSignal.notify();
    }
  }

  public static next(): Promise<void> {
    return new Promise(resolve => ChangeSignal.waits.push(resolve));
  }
}
