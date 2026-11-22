/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class HeldCopy implements Disposable {
  public readonly reached: Promise<void>;
  private readonly path: string;
  private readonly restore: () => void;
  private readonly reaching: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly releasing: PromiseWithResolvers<void> = Promise.withResolvers<void>();

  public constructor(path: string, restore: () => void) {
    this.path = path;
    this.restore = restore;
    this.reached = this.reaching.promise;
  }

  public async passAsync(target: string | URL): Promise<void> {
    if (target !== this.path)
      return;
    this.reaching.resolve();
    await this.releasing.promise;
  }

  public release(): void {
    this.releasing.resolve();
  }

  public [Symbol.dispose](): void {
    this.restore();
  }
}
