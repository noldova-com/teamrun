/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class BrowserStepWords {
  public readonly done: string;
  public readonly doing: string;
  public readonly undone: string;

  public constructor(done: string, doing: string, undone: string) {
    this.done = done;
    this.doing = doing;
    this.undone = undone;
  }
}
