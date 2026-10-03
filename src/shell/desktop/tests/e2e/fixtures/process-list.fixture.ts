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
  private static readonly LISTED_ROW: RegExp = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*?)\s*$/;
  private static readonly POSIX_LISTED_ROW: RegExp = /^\s*(\d+)\s+(\d+)\s+(.*?)\s*$/;
  private static readonly WINDOWS_PROCESSES: string = "CimCmdlets\\Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId, CreationDate, Name, CommandLine | " +
    "Microsoft.PowerShell.Core\\ForEach-Object { \"$($_.ProcessId) $($_.ParentProcessId) $($_.CreationDate.ToFileTimeUtc()) $($_.Name) $($_.CommandLine)\" }";

  public static async readProcessesAsync(): Promise<ListedProcess[]> {
    const { stdout } = process.platform === "win32"
      ? await promisify(execFile)("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ProcessListFixture.WINDOWS_PROCESSES],
        { encoding: "utf8", windowsHide: true, timeout: ProcessListFixture.TIMEOUT, maxBuffer: 16 * 1024 * 1024 })
      : await promisify(execFile)("ps", ["-A", "-ww", "-o", "pid=,ppid=,args="], { encoding: "utf8", timeout: ProcessListFixture.TIMEOUT, maxBuffer: 16 * 1024 * 1024 });
    const processes: ListedProcess[] = [];
    for (const line of stdout.split(/\r?\n/)) {
      if (process.platform === "win32") {
        const match = ProcessListFixture.LISTED_ROW.exec(line);
        if (match !== null)
          processes.push({ processId: Number(match[1]), parentId: Number(match[2]), started: BigInt(match[3] ?? 0), command: match[4] ?? "" });
        continue;
      }
      const match = ProcessListFixture.POSIX_LISTED_ROW.exec(line);
      if (match !== null)
        processes.push({ processId: Number(match[1]), parentId: Number(match[2]), started: 0n, command: match[3] ?? "" });
    }
    return processes;
  }

  public static descendants(processes: readonly ListedProcess[], processId: number): ListedProcess[] {
    const started = new Map(processes.map(t => [t.processId, t.started]));
    const children = new Map<number, ListedProcess[]>();
    for (const listed of processes)
      if (listed.processId !== listed.parentId && listed.started >= (started.get(listed.parentId) ?? 0n))
        children.set(listed.parentId, [...children.get(listed.parentId) ?? [], listed]);
    const descendants: ListedProcess[] = [];
    const pending = [processId];
    for (let next = pending.pop(); next !== undefined; next = pending.pop())
      for (const child of children.get(next) ?? [])
        if (child.processId !== processId && !descendants.some(t => t.processId === child.processId)) {
          descendants.push(child);
          pending.push(child.processId);
        }
    return descendants;
  }

  public static isListed(processes: readonly ListedProcess[], expected: ListedProcess): boolean {
    return processes.some(t => t.processId === expected.processId && t.started === expected.started);
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

export interface ListedProcess {
  readonly processId: number;
  readonly parentId: number;
  readonly started: bigint;
  readonly command: string;
}
