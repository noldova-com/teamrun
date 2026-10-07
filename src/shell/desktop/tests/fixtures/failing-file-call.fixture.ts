/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";

export class FailingFileCallFixture implements Disposable {
  private readonly name: "link" | "rename" | "rm";
  private readonly original: typeof fs.link | typeof fs.rename | typeof fs.rm;

  public constructor(name: "link" | "rename" | "rm", file: string, code: string) {
    this.name = name;
    const original = { link: fs.link, rename: fs.rename, rm: fs.rm }[name];
    this.original = original;
    Reflect.set(fs, name, (...values: unknown[]): Promise<unknown> =>
      values.some(t => String(t) === file)
        ? Promise.reject(Object.assign(new Error(`${code}: operation failed, ${name} '${file}'`), { code }))
        : Reflect.apply(original, fs, values));
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    Reflect.set(fs, this.name, this.original);
    syncBuiltinESMExports();
  }
}
