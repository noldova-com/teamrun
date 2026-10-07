/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

export class LinuxLaunchFixture implements Disposable {
  private static readonly PATHS: readonly string[] = ["/bin/bash", "/proc/self/fd"];

  private readonly accessSync: typeof fs.accessSync = fs.accessSync;
  private readonly readdirSync: typeof fs.readdirSync = fs.readdirSync;

  public constructor() {
    const accessSync = this.accessSync;
    const readdirSync = this.readdirSync;
    fs.accessSync = (target: fs.PathLike, mode?: number): void => {
      if (!LinuxLaunchFixture.PATHS.includes(String(target)))
        accessSync(target, mode);
    };
    fs.readdirSync = ((target: fs.PathLike, options?: unknown): unknown =>
      LinuxLaunchFixture.PATHS.includes(String(target)) ? [] : Reflect.apply(readdirSync, fs, [target, options])) as typeof fs.readdirSync;
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    fs.accessSync = this.accessSync;
    fs.readdirSync = this.readdirSync;
    syncBuiltinESMExports();
  }
}
