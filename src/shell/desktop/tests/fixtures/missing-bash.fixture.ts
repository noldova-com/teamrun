/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

export class MissingBashFixture implements Disposable {
  private static readonly BASH: string = "/bin/bash";

  private readonly accessSync: typeof fs.accessSync = fs.accessSync;

  public constructor() {
    const accessSync = this.accessSync;
    fs.accessSync = (target: fs.PathLike, mode?: number): void => {
      if (String(target) === MissingBashFixture.BASH)
        throw Object.assign(new Error(`EACCES: permission denied, access '${MissingBashFixture.BASH}'`), { code: "EACCES" });
      Reflect.apply(accessSync, fs, [target, mode]);
    };
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    fs.accessSync = this.accessSync;
    syncBuiltinESMExports();
  }
}
