/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { Wait } from "@noldova/teamrun-foundation-testing";

export default class ProcessListFixture {
  private static readonly TIMEOUT: number = 30_000;
  private static readonly EXIT_INTERVAL: number = 250;
  private static readonly COMMAND_LINE_TIMEOUT: number = 10_000;
  private static readonly THREADS_TIMEOUT: number = 15_000;
  private static readonly SAMPLE_SECONDS: string = "3";
  private static readonly SAMPLE_PREFIX: string = "teamrun-sample-";
  private static readonly SAMPLE_FILE: string = "sample.txt";
  private static readonly SIGNAL_INTERVAL: number = 50;
  private static readonly WINDOWS_ROW: RegExp = /^"([^"]*)","(\d+)"/;
  private static readonly POSIX_ROW: RegExp = /^\s*(\d+)\s+(.+)$/;
  private static readonly ID_ROW: RegExp = /^\s*(\d+)\s*$/;
  private static readonly DESCRIBED_ROW: RegExp = /^\s*(\d+)\s+(.*?)\s*$/;
  private static readonly PROCESSOR_TIME: RegExp = /^\s*(?:(?:(\d+)-)?(\d+):)?(\d+):(\d+(?:\.\d+)?)\s*$/m;

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
    let running = [...processIds];
    await Wait.untilAsync(async () => {
      running = await ProcessListFixture.readRunningAsync(running);
      if (running.length > 0)
        onWaiting(running);
      return running.length === 0;
    }, limit, ProcessListFixture.EXIT_INTERVAL);
    return running;
  }

  public static async waitForSignalsAsync(processIds: readonly number[], limit: number): Promise<number[]> {
    let answering = [...processIds];
    await Wait.untilAsync(() => {
      answering = answering.filter(t => ProcessListFixture.answersSignal(t));
      return answering.length === 0;
    }, limit, ProcessListFixture.SIGNAL_INTERVAL);
    return answering;
  }

  private static answersSignal(processId: number): boolean {
    try {
      process.kill(processId, 0);
      return true;
    }
    catch (error) {
      return (error as NodeJS.ErrnoException).code === "EPERM";
    }
  }

  public static async describeAsync(processIds: readonly number[]): Promise<string> {
    const output = process.platform === "win32"
      ? await ProcessListFixture.describeOnWindowsAsync(processIds)
      : await ProcessListFixture.runAsync("ps", ["-ww", "-o", "pid=,args=", "-p", processIds.join(",")]);
    const described = new Map(output.split(/\r?\n/).map(t => ProcessListFixture.DESCRIBED_ROW.exec(t)).filter(t => t !== null).map(t => [Number(t[1]), t[2] ?? ""]));
    return processIds.map(t => `${t} ${described.get(t) ?? "(gone)"}`).join("; ");
  }

  public static async describeNamingAsync(text: string): Promise<string> {
    const output = process.platform === "win32"
      ? await ProcessListFixture.runAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        "Microsoft.PowerShell.Management\\Get-WmiObject -Query 'SELECT ProcessId, CommandLine FROM Win32_Process' | Microsoft.PowerShell.Core\\ForEach-Object { \"$($_.ProcessId) $($_.CommandLine)\" }"], ProcessListFixture.COMMAND_LINE_TIMEOUT)
      : await ProcessListFixture.runAsync("ps", ["-ww", "-A", "-o", "pid=,args="]);
    const naming = output.split(/\r?\n/).map(t => t.trim()).filter(t => t.includes(text));
    return naming.length === 0 ? "none" : naming.join("; ");
  }

  public static async readProcessorMillisecondsAsync(processId: number): Promise<number | null> {
    if (process.platform === "win32") {
      const output = await ProcessListFixture.runAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        `Microsoft.PowerShell.Management\\Get-Process -Id ${processId} -ErrorAction SilentlyContinue | Microsoft.PowerShell.Core\\ForEach-Object { [long]$_.TotalProcessorTime.TotalMilliseconds }`]);
      const row = ProcessListFixture.ID_ROW.exec(output);
      return row === null ? null : Number(row[1]);
    }
    const time = ProcessListFixture.PROCESSOR_TIME.exec(await ProcessListFixture.runAsync("ps", ["-o", "time=", "-p", String(processId)]));
    if (time === null)
      return null;
    const [days, hours, minutes, seconds] = time.slice(1).map(t => Number(t ?? 0));
    return Math.round(((((days ?? 0) * 24 + (hours ?? 0)) * 60 + (minutes ?? 0)) * 60 + (seconds ?? 0)) * 1000);
  }

  public static async describeThreadsAsync(processId: number): Promise<string> {
    if (process.platform === "win32")
      return await ProcessListFixture.runReportingAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        `Microsoft.PowerShell.Management\\Get-Process -Id ${processId} -ErrorAction SilentlyContinue | Microsoft.PowerShell.Core\\ForEach-Object { $_.Threads } | ` +
        "Microsoft.PowerShell.Core\\ForEach-Object { \"$($_.Id) $($_.ThreadState) $(if ($_.ThreadState -eq 'Wait') { $_.WaitReason } else { '-' }) $([long]$_.TotalProcessorTime.TotalMilliseconds) ms\" }"]);
    if (process.platform !== "darwin")
      return await ProcessListFixture.runReportingAsync("ps", ["-L", "-o", "tid=,stat=,wchan:32=,time=,comm=", "-p", String(processId)]);
    const folder = await mkdtemp(path.join(os.tmpdir(), ProcessListFixture.SAMPLE_PREFIX));
    try {
      const file = path.join(folder, ProcessListFixture.SAMPLE_FILE);
      const output = await ProcessListFixture.runReportingAsync("sample", [String(processId), ProcessListFixture.SAMPLE_SECONDS, "-file", file]);
      return await readFile(file, "utf8").catch(() => output);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static async runReportingAsync(file: string, commandArguments: readonly string[]): Promise<string> {
    try {
      const result = await promisify(execFile)(file, [...commandArguments], { encoding: "utf8", windowsHide: true, timeout: ProcessListFixture.THREADS_TIMEOUT, maxBuffer: 16 * 1024 * 1024 });
      return `${result.stdout}${result.stderr}`;
    }
    catch (error) {
      const failed = error as Error & { killed?: boolean; stdout?: string };
      const stopped = failed.killed === true ? `\nIt was stopped after ${ProcessListFixture.THREADS_TIMEOUT} ms.` : "";
      return `${failed.message}${stopped}\n${failed.stdout ?? ""}`;
    }
  }

  private static async describeOnWindowsAsync(processIds: readonly number[]): Promise<string> {
    try {
      return await ProcessListFixture.runAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        `Microsoft.PowerShell.Management\\Get-WmiObject -Query "SELECT ProcessId, CommandLine FROM Win32_Process WHERE ${processIds.map(t => `ProcessId = ${t}`).join(" OR ")}" |Microsoft.PowerShell.Core\\ForEach-Object { "$($_.ProcessId) $($_.CommandLine)" }`],
        ProcessListFixture.COMMAND_LINE_TIMEOUT);
    }
    catch {
      return await ProcessListFixture.runAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        `Microsoft.PowerShell.Management\\Get-Process -Id ${processIds.join(",")} -ErrorAction SilentlyContinue | Microsoft.PowerShell.Core\\ForEach-Object { "$($_.Id) $($_.Path)" }`]);
    }
  }

  private static async runAsync(file: string, commandArguments: readonly string[], timeout: number = ProcessListFixture.TIMEOUT): Promise<string> {
    try {
      return (await promisify(execFile)(file, [...commandArguments], { encoding: "utf8", windowsHide: true, timeout, maxBuffer: 16 * 1024 * 1024 })).stdout;
    }
    catch (error) {
      const failed = error as { code?: unknown; stdout?: string };
      if (typeof failed.code === "number" && typeof failed.stdout === "string")
        return failed.stdout;
      throw error;
    }
  }
}
