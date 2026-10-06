/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Writable } from "node:stream";

export default class TextOutputFixture extends Writable {
  private readonly chunks: string[] = [];
  private readonly waiters: (() => void)[] = [];

  public constructor() {
    super({ decodeStrings: false });
  }

  public get text(): string {
    return this.chunks.join("");
  }

  public nextWriteAsync(): Promise<void> {
    return new Promise<void>(resolve => this.waiters.push(resolve));
  }

  public override _write(chunk: string, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.chunks.push(Buffer.from(chunk, encoding).toString("utf8"));
    callback();
    for (const resolve of this.waiters.splice(0))
      resolve();
  }
}
