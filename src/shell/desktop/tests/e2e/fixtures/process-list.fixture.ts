/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

export default class ProcessListFixture {
  private static readonly TIMEOUT: number = 30_000;
  private static readonly EXIT_INTERVAL: number = 250;
  private static readonly WINDOWS_ROW: RegExp = /^"([^"]*)","(\d+)"/;
  private static readonly POSIX_ROW: RegExp = /^\s*(\d+)\s+(.+)$/;
  private static readonly ID_ROW: RegExp = /^\s*(\d+)\s*$/;
  private static readonly DESCRIBED_ROW: RegExp = /^\s*(\d+)\s+(.*?)\s*$/;

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

  public static async readRunningAsync(processIds: readonly number[]): Promise<number[]> {
    if (processIds.length === 0)
      return [];
    const output = process.platform === "win32"
      ? await ProcessListFixture.runAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        `Microsoft.PowerShell.Management\\Get-Process -Id ${processIds.join(",")} -ErrorAction SilentlyContinue | Microsoft.PowerShell.Core\\ForEach-Object { $_.Id }`])
      : await ProcessListFixture.runAsync("ps", ["-o", "pid=", "-p", processIds.join(",")]);
    const listed = output.split(/\r?\n/).map(t => ProcessListFixture.ID_ROW.exec(t)).filter(t => t !== null).map(t => Number(t[1]));
    return processIds.filter(t => listed.includes(t));
  }

  public static async waitForExitAsync(processIds: readonly number[], limit: number, onWaiting: (running: readonly number[]) => void = () => undefined): Promise<number[]> {
    const deadline = Date.now() + limit;
    let running = await ProcessListFixture.readRunningAsync(processIds);
    while (running.length > 0 && Date.now() < deadline) {
      onWaiting(running);
      await delay(ProcessListFixture.EXIT_INTERVAL);
      running = await ProcessListFixture.readRunningAsync(running);
    }
    return running;
  }

  public static async describeAsync(processIds: readonly number[]): Promise<string> {
    const output = process.platform === "win32"
      ? await ProcessListFixture.runAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        `CimCmdlets\\Get-CimInstance Win32_Process -Filter "${processIds.map(t => `ProcessId = ${t}`).join(" OR ")}" | Microsoft.PowerShell.Core\\ForEach-Object { "$($_.ProcessId) $($_.CommandLine)" }`])
      : await ProcessListFixture.runAsync("ps", ["-ww", "-o", "pid=,args=", "-p", processIds.join(",")]);
    const described = new Map(output.split(/\r?\n/).map(t => ProcessListFixture.DESCRIBED_ROW.exec(t)).filter(t => t !== null).map(t => [Number(t[1]), t[2] ?? ""]));
    return processIds.map(t => `${t} ${described.get(t) ?? "(gone)"}`).join("; ");
  }

  private static async runAsync(file: string, commandArguments: readonly string[]): Promise<string> {
    try {
      return (await promisify(execFile)(file, [...commandArguments], { encoding: "utf8", windowsHide: true, timeout: ProcessListFixture.TIMEOUT, maxBuffer: 16 * 1024 * 1024 })).stdout;
    }
    catch (error) {
      const failed = error as { code?: unknown; stdout?: string };
      if (typeof failed.code === "number" && typeof failed.stdout === "string")
        return failed.stdout;
      throw error;
    }
  }
}
