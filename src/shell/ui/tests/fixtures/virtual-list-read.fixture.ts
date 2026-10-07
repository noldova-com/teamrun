/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class VirtualListReadFixture {
  private resolver: (items: readonly string[]) => void = () => undefined;
  private rejecter: (error: unknown) => void = () => undefined;

  public readonly start: number;
  public readonly end: number;
  public readonly abort: AbortSignal;
  public readonly promise: Promise<readonly string[]>;
  public isSettled: boolean = false;

  public constructor(start: number, end: number, abort: AbortSignal) {
    this.start = start;
    this.end = end;
    this.abort = abort;
    this.promise = new Promise<readonly string[]>((resolve, reject) => {
      this.resolver = resolve;
      this.rejecter = reject;
    });
  }

  public async answerAsync(items?: readonly string[]): Promise<void> {
    this.isSettled = true;
    this.resolver(items ?? Array.from({ length: this.end - this.start }, (_, t) => `item ${this.start + t}`));
    await this.promise;
  }

  public async refuseAsync(error: unknown): Promise<void> {
    this.isSettled = true;
    this.rejecter(error);
    await this.promise.catch(() => undefined);
  }
}
