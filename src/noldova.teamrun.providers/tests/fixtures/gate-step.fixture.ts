/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GateStep {
  private readonly gate: PromiseWithResolvers<void> = Promise.withResolvers<void>();

  public get opened(): Promise<void> {
    return this.gate.promise;
  }

  public open(): void {
    this.gate.resolve();
  }
}
