/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";

export class UnreadableFileFixture implements Disposable {
  private readonly readFile: typeof fs.readFile = fs.readFile;

  public refused: number = 0;

  public constructor(file: string) {
    const readFile = this.readFile;
    fs.readFile = ((target: unknown, options?: unknown): Promise<unknown> => {
      if (String(target) !== file)
        return Reflect.apply(readFile, fs, [target, options]);
      this.refused++;
      return Promise.reject(Object.assign(new Error(`EACCES: permission denied, open '${file}'`), { code: "EACCES" }));
    }) as typeof fs.readFile;
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    fs.readFile = this.readFile;
    syncBuiltinESMExports();
  }
}
