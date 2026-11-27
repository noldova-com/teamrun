/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync } from "node:child_process";

import "@noldova/context.core";

import { HolderListing } from "./holder-listing.ts";
import { ProcessStatus } from "./process-status.ts";

export class WindowsProcesses {
  public static readonly WORK_VARIABLE: string = "TEAMRUN_E2E_WORK";
  public static readonly HOLDERS_WAIT_SECONDS: number = 10;
  private static readonly HOLDERS_EXIT_MILLISECONDS: number = 5_000;
  private static readonly TIMEOUT: number = 60_000;
  private static readonly BUFFER: number = 64 * 1024 * 1024;
  private static readonly NO_SESSION: number = -1;
  private static readonly LISTING: string = "$cim = [Microsoft.Management.Infrastructure.CimSession]::Create([NullString]::Value); "
    + "function Get-Listed($where) { foreach ($found in $cim.QueryInstances('root/cimv2', 'WQL', "
    + "\"SELECT ProcessId, ParentProcessId, Name, CommandLine, CreationDate FROM Win32_Process$where\")) { $properties = $found.CimInstanceProperties; "
    + "[pscustomobject]@{ ProcessId = $properties['ProcessId'].Value; ParentProcessId = $properties['ParentProcessId'].Value; Name = $properties['Name'].Value; "
    + "CommandLine = $properties['CommandLine'].Value; CreationDate = $properties['CreationDate'].Value } } }";
  public static readonly PROCESSES_SCRIPT: string = `${WindowsProcesses.LISTING}; Get-Listed '' | ForEach-Object { '{0} {1} {2} {3} {4}' -f $_.ProcessId, `
    + "$_.ParentProcessId, $(if ($_.CreationDate) { [string]$_.CreationDate.ToUniversalTime().Ticks } else { '' }), "
    + "[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string]$_.Name)), [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string]$_.CommandLine)) }";
  private static readonly HOLDERS_QUERY: string = `$ErrorActionPreference = "Stop"; ${WindowsProcesses.LISTING}; $held = @(Get-Listed '' | Where-Object { `
    + `$_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.IndexOf($env:${WindowsProcesses.WORK_VARIABLE}, [StringComparison]::OrdinalIgnoreCase) -ge 0 })`;
  private static readonly HOLDERS_LIST: string = "$held | ForEach-Object { \"$($_.ProcessId) $($_.Name)\" }";
  private static readonly HOLDERS_END: string = [
    `if ($held.Count -gt 0) { $until = [DateTime]::UtcNow.AddSeconds(${WindowsProcesses.HOLDERS_WAIT_SECONDS}); foreach ($waited in $held) { try { `
      + "$left = [int][Math]::Max(0, ($until - [DateTime]::UtcNow).TotalMilliseconds); "
      + "$null = [System.Diagnostics.Process]::GetProcessById([int]$waited.ProcessId).WaitForExit($left) } catch { } } }",
    "$seen = @{}",
    "function Test-Running($listed) { @(Get-Listed \" WHERE ProcessId = $($listed.ProcessId)\" | Where-Object { $_.CreationDate -eq $listed.CreationDate }).Count -gt 0 }",
    "function Stop-Listed($listed, $by) { $id = $listed.ProcessId; $key = \"$id $($listed.CreationDate.Ticks)\"; if ($seen.ContainsKey($key)) { return }; $seen[$key] = $true" +
      "; $process = $null; try { $process = [System.Diagnostics.Process]::GetProcessById([int]$id) } catch { }" +
      "; try { if ($process) { $null = $process.Handle; if ([Math]::Abs(($process.StartTime - $listed.CreationDate).TotalMilliseconds) -lt 1) { $process.Kill()" +
      `; if (-not $process.WaitForExit(${WindowsProcesses.HOLDERS_EXIT_MILLISECONDS})) { throw "it still ran ${WindowsProcesses.HOLDERS_EXIT_MILLISECONDS} ms after it was stopped" }` +
      "; \"stopped $id $($listed.Name)$by\" }" +
      " elseif (Test-Running $listed) { \"not stopped $id $($listed.Name)$($by): its start time differs from the listing's\"; return } } }" +
      " catch { if (Test-Running $listed) { \"not stopped $id $($listed.Name)$($by): $($_.Exception.Message)\"; return } }" +
      "; $near = @(Get-Listed \" WHERE ProcessId = $id OR ParentProcessId = $id\")" +
      "; $before = @($near | Where-Object { $_.ProcessId -eq $id -and $_.CreationDate -ne $listed.CreationDate } | ForEach-Object { $_.CreationDate }) + [DateTime]::MaxValue" +
      "; $near | Where-Object { $_.ParentProcessId -eq $id -and $_.CreationDate -ge $listed.CreationDate -and $_.CreationDate -lt $before[0] }" +
      " | ForEach-Object { Stop-Listed $_ \" (started by $id)\" } }",
    "$held | ForEach-Object { Stop-Listed $_ \"\" }"
  ].join("; ");

  public static list(): readonly ProcessStatus[] {
    const result = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", WindowsProcesses.PROCESSES_SCRIPT],
      { encoding: "utf8", timeout: WindowsProcesses.TIMEOUT, killSignal: "SIGKILL", maxBuffer: WindowsProcesses.BUFFER });
    if (result.status !== 0)
      throw new Error(`Listing the processes failed with ${result.status}: ${result.error?.message ?? (result.stderr ?? "").trim()}`);
    return WindowsProcesses.processesOf(result.stdout);
  }

  public static processesOf(output: string): readonly ProcessStatus[] {
    return output.split(/\r?\n/).map(t => t.split(" ")).filter(t => t.length === 5).map(([pid, parent, start, name, command]) =>
      new ProcessStatus(Number(pid), WindowsProcesses.decoded(name), start ?? "", Number(parent), WindowsProcesses.NO_SESSION, "", WindowsProcesses.decoded(command)));
  }

  public static holdersScript(end: boolean): string {
    return [WindowsProcesses.HOLDERS_QUERY, end ? WindowsProcesses.HOLDERS_END : WindowsProcesses.HOLDERS_LIST].join("; ");
  }

  public static holdersOf(work: string, end: boolean): HolderListing {
    const result = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", WindowsProcesses.holdersScript(end)],
      { encoding: "utf8", env: { ...process.env, [WindowsProcesses.WORK_VARIABLE]: work }, timeout: WindowsProcesses.TIMEOUT, killSignal: "SIGKILL" });
    const lines = (result.stdout ?? "").split(/\r?\n/).map(t => t.trim()).filter(t => t !== "");
    if (!Object.isUndefined(result.error))
      return new HolderListing(lines, result.error.message);
    return new HolderListing(lines, result.status === 0 ? null : `PowerShell ended with ${result.status}: ${(result.stderr ?? "").trim()}`);
  }

  private static decoded(text: string | undefined): string {
    return Buffer.from(text ?? "", "base64").toString("utf8");
  }
}
