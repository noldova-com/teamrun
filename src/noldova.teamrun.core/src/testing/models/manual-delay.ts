/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ManualDelay {
  private readonly resolvers: PromiseWithResolvers<void> = Promise.withResolvers<void>();

  public readonly deadline: number;

  public constructor(deadline: number) {
    this.deadline = deadline;
  }

  public get promise(): Promise<void> {
    return this.resolvers.promise;
  }

  public elapse(): void {
    this.resolvers.resolve();
  }

  public cancel(reason: unknown): void {
    this.resolvers.reject(reason);
  }
}
