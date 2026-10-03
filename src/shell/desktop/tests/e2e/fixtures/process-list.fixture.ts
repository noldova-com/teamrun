/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile, spawnSync } from "node:child_process";
import { promisify } from "node:util";

export default class ProcessListFixture {
  private static readonly TIMEOUT: number = 30_000;
  private static readonly WINDOWS_ROW: RegExp = /^"([^"]*)","(\d+)"/;
  private static readonly POSIX_ROW: RegExp = /^\s*(\d+)\s+(.+)$/;
  private static readonly PARENT_ROW: RegExp = /^\s*(\d+)\s+(\d+)(?:\s+(\d+))?\s*$/;
  private static readonly WINDOWS_PARENTS: string = "CimCmdlets\\Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId, CreationDate | " +
    "Microsoft.PowerShell.Core\\ForEach-Object { \"$($_.ProcessId) $($_.ParentProcessId) $($_.CreationDate.ToFileTimeUtc())\" }";

  public static async readDescendantsAsync(processId: number): Promise<number[]> {
    const { stdout } = process.platform === "win32"
      ? await promisify(execFile)("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ProcessListFixture.WINDOWS_PARENTS],
        { encoding: "utf8", windowsHide: true, timeout: ProcessListFixture.TIMEOUT, maxBuffer: 16 * 1024 * 1024 })
      : await promisify(execFile)("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8", timeout: ProcessListFixture.TIMEOUT, maxBuffer: 16 * 1024 * 1024 });
    const rows = stdout.split(/\r?\n/).map(t => ProcessListFixture.PARENT_ROW.exec(t)).filter(t => t !== null)
      .map(t => ({ child: Number(t[1]), parent: Number(t[2]), started: BigInt(t[3] ?? 0) }));
    const started = new Map(rows.map(t => [t.child, t.started]));
    const children = new Map<number, number[]>();
    for (const row of rows)
      if (row.child !== row.parent && row.started >= (started.get(row.parent) ?? 0n))
        children.set(row.parent, [...children.get(row.parent) ?? [], row.child]);
    const descendants: number[] = [];
    const pending = [processId];
    for (let next = pending.pop(); next !== undefined; next = pending.pop())
      for (const child of children.get(next) ?? [])
        if (!descendants.includes(child) && child !== processId) {
          descendants.push(child);
          pending.push(child);
        }
    return descendants;
  }

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
