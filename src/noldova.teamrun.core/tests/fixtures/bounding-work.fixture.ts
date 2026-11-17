/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class BoundingWork {
  public readonly name: string;
  public readonly done: Promise<unknown>;

  public constructor(name: string, done: Promise<unknown>) {
    this.name = name;
    this.done = done;
  }

  public endedAsync(): Promise<string> {
    return this.done.then(() => this.name, () => this.name);
  }
}
