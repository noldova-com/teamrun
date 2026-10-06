/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

export class FileSystemPatchFixture implements Disposable {
  private static readonly MOUNT_TABLE: string = "/proc/self/mountinfo";

  private readonly accessSync: typeof fs.accessSync = fs.accessSync;
  private readonly readdirSync: typeof fs.readdirSync = fs.readdirSync;
  private readonly readFileSync: typeof fs.readFileSync = fs.readFileSync;

  public readonly checked: string[] = [];

  public constructor(failingPath: string | null, mountTable: string = "") {
    const readFileSync = this.readFileSync;
    fs.accessSync = (target: fs.PathLike): void => this.check(target, failingPath);
    fs.readdirSync = (target: fs.PathLike): never[] => {
      this.check(target, failingPath);
      return [];
    };
    fs.readFileSync = ((target: fs.PathOrFileDescriptor, options?: unknown): unknown =>
      target === FileSystemPatchFixture.MOUNT_TABLE ? mountTable : Reflect.apply(readFileSync, fs, [target, options])) as typeof fs.readFileSync;
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    fs.accessSync = this.accessSync;
    fs.readdirSync = this.readdirSync;
    fs.readFileSync = this.readFileSync;
    syncBuiltinESMExports();
  }

  private check(target: fs.PathLike, failingPath: string | null): void {
    this.checked.push(String(target));
    if (String(target) === failingPath)
      throw Object.assign(new Error(`EACCES: permission denied, access '${failingPath}'`), { code: "EACCES" });
  }
}
