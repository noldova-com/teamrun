/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class HangLimitFixture {
  private readonly timer: NodeJS.Timeout;
  private hasPassed: boolean = false;

  public readonly milliseconds: number;
  public readonly passed: Promise<void>;

  public constructor(milliseconds: number) {
    const { promise, resolve } = Promise.withResolvers<void>();
    this.milliseconds = milliseconds;
    this.passed = promise;
    this.timer = setInterval(() => {
      this.hasPassed = true;
      resolve();
    }, milliseconds);
  }

  public get isPassed(): boolean {
    return this.hasPassed;
  }

  public stop(): void {
    clearInterval(this.timer);
  }
}
