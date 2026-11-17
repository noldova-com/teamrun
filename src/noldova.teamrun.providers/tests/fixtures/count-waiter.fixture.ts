/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CountWaiter {
  private readonly waiting: { readonly count: number; readonly reached: () => void }[] = [];
  private current: number = 0;

  public add(): void {
    this.current += 1;
    for (const waiter of this.waiting.filter(t => t.count <= this.current)) {
      this.waiting.splice(this.waiting.indexOf(waiter), 1);
      waiter.reached();
    }
  }

  public reach(count: number): Promise<void> {
    if (this.current >= count)
      return Promise.resolve();
    const reached = Promise.withResolvers<void>();
    this.waiting.push({ count, reached: reached.resolve });
    return reached.promise;
  }
}
