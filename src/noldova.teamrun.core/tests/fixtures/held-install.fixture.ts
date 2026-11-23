/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class HeldInstall {
  public readonly promise: Promise<string>;
  private resolve: (path: string) => void = () => undefined;
  private reject: (error: unknown) => void = () => undefined;

  public constructor(signal: AbortSignal) {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    signal.addEventListener("abort", () => this.reject(new Error("The install was stopped.")), { once: true });
  }

  public complete(path: string): void {
    this.resolve(path);
  }

  public fail(error: unknown): void {
    this.reject(error);
  }
}
