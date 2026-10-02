/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ConsoleCapture implements Disposable {
  private readonly original: typeof console.log = console.log;

  public readonly lines: string[] = [];

  public constructor() {
    console.log = this.write.bind(this);
  }

  public [Symbol.dispose](): void {
    console.log = this.original;
  }

  private write(value: unknown): void {
    this.lines.push(String(value));
  }
}
