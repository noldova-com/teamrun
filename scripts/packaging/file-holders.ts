/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ProcessRunner from "../processes/process-runner.ts";

export default class FileHolders {
  private static readonly POWERSHELL: string = "powershell.exe";
  private static readonly OPTIONS: readonly string[] = ["-NoProfile", "-NonInteractive", "-EncodedCommand"];
  private static readonly FILES_VARIABLE: string = "TEAMRUN_LEFT_FILES";
  private static readonly SEPARATOR: string = "\n";
  private static readonly LIMIT: number = 120_000;
  private static readonly SCRIPT: string = [
    "$ErrorActionPreference = 'Stop'",
    "Microsoft.PowerShell.Utility\\Add-Type -TypeDefinition @'",
    "using System;",
    "using System.Collections.Generic;",
    "using System.Runtime.InteropServices;",
    "using System.Text;",
    "public static class TeamRunFileHolders {",
    "  private const int MoreData = 234;",
    "  [StructLayout(LayoutKind.Sequential)]",
    "  private struct UniqueProcess { public uint ProcessId; public uint StartLow; public uint StartHigh; }",
    "  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]",
    "  private struct ProcessInfo {",
    "    public UniqueProcess Process;",
    "    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string AppName;",
    "    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)] public string ServiceName;",
    "    public int ApplicationType;",
    "    public uint AppStatus;",
    "    public uint SessionId;",
    "    [MarshalAs(UnmanagedType.Bool)] public bool Restartable;",
    "  }",
    "  [DllImport(\"rstrtmgr.dll\", CharSet = CharSet.Unicode)]",
    "  private static extern int RmStartSession(out uint session, int flags, StringBuilder key);",
    "  [DllImport(\"rstrtmgr.dll\", CharSet = CharSet.Unicode)]",
    "  private static extern int RmRegisterResources(uint session, uint fileCount, string[] files, uint processCount, IntPtr processes, uint serviceCount, IntPtr services);",
    "  [DllImport(\"rstrtmgr.dll\")]",
    "  private static extern int RmGetList(uint session, out uint needed, ref uint count, [In, Out] ProcessInfo[] infos, out uint reasons);",
    "  [DllImport(\"rstrtmgr.dll\")]",
    "  private static extern int RmEndSession(uint session);",
    "  public static string[] Describe(string file) {",
    "    uint session;",
    "    int error = RmStartSession(out session, 0, new StringBuilder(64));",
    "    if (error != 0)",
    "      return new[] { \"Restart Manager could not start, error \" + error };",
    "    try {",
    "      error = RmRegisterResources(session, 1, new[] { file }, 0, IntPtr.Zero, 0, IntPtr.Zero);",
    "      if (error != 0)",
    "        return new[] { \"Restart Manager could not register it, error \" + error };",
    "      uint needed;",
    "      uint count = 0;",
    "      uint reasons;",
    "      ProcessInfo[] infos = new ProcessInfo[0];",
    "      error = RmGetList(session, out needed, ref count, infos, out reasons);",
    "      while (error == MoreData) {",
    "        infos = new ProcessInfo[needed];",
    "        count = needed;",
    "        error = RmGetList(session, out needed, ref count, infos, out reasons);",
    "      }",
    "      if (error != 0)",
    "        return new[] { \"Restart Manager could not list what uses it, error \" + error };",
    "      List<string> holders = new List<string>();",
    "      for (int i = 0; i < count; i++)",
    "        holders.Add(\"process \" + infos[i].Process.ProcessId + \" \" + infos[i].AppName + (string.IsNullOrEmpty(infos[i].ServiceName) ? \"\" : \", service \" + infos[i].ServiceName));",
    "      return holders.ToArray();",
    "    }",
    "    finally {",
    "      RmEndSession(session);",
    "    }",
    "  }",
    "}",
    "'@",
    `foreach ($file in $env:${FileHolders.FILES_VARIABLE}.Split([char]10)) {`,
    "  $holders = @([TeamRunFileHolders]::Describe($file))",
    "  if ($holders.Count -eq 0) { \"${file}: no process holds it now.\" }",
    "  foreach ($holder in $holders) { \"${file}: $holder.\" }",
    "}",
    "$since = (Microsoft.PowerShell.Utility\\Get-Date).AddMinutes(-5)",
    "$records = @(Microsoft.PowerShell.Diagnostics\\Get-WinEvent -MaxEvents 20 -ErrorAction SilentlyContinue -FilterHashtable @{ LogName = 'Microsoft-Windows-Windows Defender/Operational'; StartTime = $since })",
    "if ($records.Count -eq 0) { 'Defender logged no event in the last 5 minutes.' }",
    "foreach ($record in $records) { \"Defender event $($record.Id) at $($record.TimeCreated.ToString('o')): $(\"$($record.Message)\".Split([char]10)[0].Trim())\" }"
  ].join(FileHolders.SEPARATOR);

  private readonly runner: ProcessRunner;
  private readonly folder: string;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(runner: ProcessRunner, folder: string, environment: NodeJS.ProcessEnv) {
    this.runner = runner;
    this.folder = folder;
    this.environment = environment;
  }

  public async describeAsync(files: readonly string[]): Promise<string> {
    const command = Buffer.from(FileHolders.SCRIPT, "utf16le").toString("base64");
    const result = await this.runner.captureAsync(FileHolders.POWERSHELL, [...FileHolders.OPTIONS, command], this.folder, FileHolders.LIMIT,
      { ...this.environment, [FileHolders.FILES_VARIABLE]: files.join(FileHolders.SEPARATOR) });
    if (!result.isSuccessful)
      return `What holds them could not be read: ${FileHolders.POWERSHELL} exited with ${result.exitCode}:\n${result.text}`;
    return `What holds them now:\n${result.output.trim()}`;
  }
}
