/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CodexThreadRelease {
  public readonly threadId: string;
  public readonly done: PromiseWithResolvers<void> = Promise.withResolvers<void>();

  public constructor(threadId: string) {
    this.threadId = threadId;
  }
}
