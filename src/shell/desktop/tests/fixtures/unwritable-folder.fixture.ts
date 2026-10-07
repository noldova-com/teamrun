/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";

export class UnwritableFolderFixture implements Disposable {
  private readonly open: typeof fs.open = fs.open;

  public constructor(folder: string) {
    const open = this.open;
    fs.open = ((target: unknown, flags?: unknown, mode?: unknown): Promise<unknown> =>
      path.dirname(String(target)) === folder
        ? Promise.reject(Object.assign(new Error(`EACCES: permission denied, open '${String(target)}'`), { code: "EACCES" }))
        : Reflect.apply(open, fs, [target, flags, mode])) as typeof fs.open;
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    fs.open = this.open;
    syncBuiltinESMExports();
  }
}
