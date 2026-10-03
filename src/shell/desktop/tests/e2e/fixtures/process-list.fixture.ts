/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync } from "node:child_process";

export default class ProcessListFixture {
  private static readonly TIMEOUT: number = 30_000;
  private static readonly WINDOWS_ROW: RegExp = /^"([^"]*)","(\d+)"/;
  private static readonly POSIX_ROW: RegExp = /^\s*(\d+)\s+(.+)$/;

  public static readNames(processIds: readonly number[]): ReadonlyMap<number, string> {
    const isWindows = process.platform === "win32";
    const result = isWindows
      ? spawnSync("tasklist", ["/FO", "CSV", "/NH"], { encoding: "utf8", windowsHide: true, timeout: ProcessListFixture.TIMEOUT })
      : spawnSync("ps", ["-o", "pid=,comm=", "-p", processIds.join(",")], { encoding: "utf8", timeout: ProcessListFixture.TIMEOUT });
    if (result.error !== undefined)
      throw result.error;
    const pattern = isWindows ? ProcessListFixture.WINDOWS_ROW : ProcessListFixture.POSIX_ROW;
    const names = new Map<number, string>();
    for (const line of result.stdout.split(/\r?\n/)) {
      const match = pattern.exec(line);
      if (match === null)
        continue;
      const [processId, name] = isWindows ? [Number(match[2]), match[1]] : [Number(match[1]), match[2]];
      if (processIds.includes(processId) && name !== undefined)
        names.set(processId, name.trim());
    }
    return names;
  }
}
