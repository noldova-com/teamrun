/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";

export class CommandLinePatchFixture implements Disposable {
  private static readonly COMMAND_LINE: RegExp = /^[/\\]proc[/\\](\d+)[/\\]cmdline$/;

  private readonly readFile: typeof fs.readFile = fs.readFile;

  public constructor(commandLines: ReadonlyMap<number, string | Error>) {
    const readFile = this.readFile;
    fs.readFile = ((target: unknown, options?: unknown): Promise<unknown> => {
      const match = CommandLinePatchFixture.COMMAND_LINE.exec(String(target));
      if (match === null)
        return Reflect.apply(readFile, fs, [target, options]);
      const commandLine = commandLines.get(Number(match[1]));
      if (commandLine === undefined)
        return Promise.reject(Object.assign(new Error(`ENOENT: no such file or directory, open '${String(target)}'`), { code: "ENOENT" }));
      return commandLine instanceof Error ? Promise.reject(commandLine) : Promise.resolve(commandLine);
    }) as typeof fs.readFile;
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    fs.readFile = this.readFile;
    syncBuiltinESMExports();
  }
}
