/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, type SpawnOptions, spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { constants } from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import { finished } from "node:stream/promises";
import { setTimeout as delay } from "node:timers/promises";

import "@noldova/context.core";

import type { ISharedMcpLauncherHost } from "../../interfaces/i-shared-mcp-launcher-host.js";

export class SharedMcpLauncher {
  public static readonly variablesOption: string = "--variables";
  public static readonly watchOption: string = "--watch";
  public static readonly endOfOptions: string = "--";
  public static readonly nameSeparator: string = ",";
  public static readonly posixBasics: readonly string[] = ["HOME", "LOGNAME", "PATH", "SHELL", "USER", "__CF_USER_TEXT_ENCODING", "LANG", "LC_ALL", "TERM",
    "TMPDIR", "TZ"];
  public static readonly windowsBasics: readonly string[] = ["PATH", "PATHEXT", "SHELL", "COMSPEC", "SYSTEMROOT", "WINDIR", "SYSTEMDRIVE", "USERNAME", "USERDOMAIN",
    "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "PROGRAMFILES", "PROGRAMFILES(X86)", "PROGRAMW6432", "PROGRAMDATA", "LOCALAPPDATA", "APPDATA", "TEMP", "TMP", "TMPDIR",
    "POWERSHELL", "PWSH"];
  public static readonly certificateVariables: readonly string[] = ["CODEX_CA_CERTIFICATE", "SSL_CERT_FILE", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE",
    "NODE_EXTRA_CA_CERTS", "GIT_SSL_CAINFO", "CARGO_HTTP_CAINFO", "PIP_CERT", "BUNDLE_SSL_CA_CERT", "npm_config_cafile", "NPM_CONFIG_CAFILE"];
  public static readonly withheldVariables: readonly string[] = ["TEAMRUN_SENDER_TOKEN"];
  public static readonly forwardedSignals: readonly NodeJS.Signals[] = ["SIGTERM", "SIGINT", "SIGHUP"];
  public static readonly graceMilliseconds: number = 2000;
  public static readonly powershellAnswerMilliseconds: number = 10_000;
  public static readonly windowsEndMilliseconds: number = 20_000;

  private static readonly WINDOWS: string = "win32";
  private static readonly PATH_VARIABLE: string = "PATH";
  private static readonly EXTENSIONS_VARIABLE: string = "PATHEXT";
  private static readonly SHELL_VARIABLE: string = "COMSPEC";
  private static readonly NO_FOLDER_LOOKUP_VARIABLE: string = "NoDefaultCurrentDirectoryInExePath";
  private static readonly NO_FOLDER_LOOKUP: string = "1";
  private static readonly DEFAULT_EXTENSIONS: string = ".COM;.EXE;.BAT;.CMD";
  private static readonly LIST_SEPARATOR: string = ";";
  private static readonly FOLDER_SEPARATOR: RegExp = /[\\/]/u;
  private static readonly SHELL: string = "cmd.exe";
  private static readonly SYSTEM_ROOT_VARIABLE: string = "SYSTEMROOT";
  private static readonly WINDOWS_FOLDER_VARIABLE: string = "WINDIR";
  private static readonly WINDOWS_FOLDER: string = "C:\\Windows";
  private static readonly SYSTEM_FOLDER: string = "System32";
  private static readonly POWERSHELL_FOLDER: readonly string[] = ["WindowsPowerShell", "v1.0"];
  private static readonly SHELL_ARGUMENTS: readonly string[] = ["/d", "/s", "/c"];
  private static readonly BATCH_FILE: RegExp = /\.(?:cmd|bat)$/iu;
  private static readonly SHELL_META: RegExp = /([()\][%!^"`<>&|;, *?])/gu;
  private static readonly QUOTE_AFTER_BACKSLASHES: RegExp = /(\\*)"/gu;
  private static readonly TRAILING_BACKSLASHES: RegExp = /(\\*)$/u;
  private static readonly POWERSHELL: string = "powershell.exe";
  private static readonly POWERSHELL_ARGUMENTS: readonly string[] = ["-NoProfile", "-NonInteractive", "-EncodedCommand"];
  private static readonly SIGNAL_NUMBERS: Readonly<Record<string, number>> = { ...constants.signals };
  private static readonly SIGNAL_EXIT_BASE: number = 128;
  private static readonly FAILED_EXIT: number = 1;
  private static readonly USAGE_EXIT: number = 2;
  private static readonly LAUNCH_USAGE: string = `Usage: ${SharedMcpLauncher.variablesOption} <names> ${SharedMcpLauncher.endOfOptions} <command> [arguments...]`;
  private static readonly EXITED_LINE: string = "exited";
  private static readonly WATCH_USAGE: string = `Usage: ${SharedMcpLauncher.watchOption}, then <process id> as a line of its input, and ${SharedMcpLauncher.EXITED_LINE} `
    + "as the next once the server exits";
  private static readonly LINE_END: string = "\n";
  private static readonly PROCESS_ID: RegExp = /^[1-9]\d*$/u;
  private static readonly WATCH_MISSING_EXIT: number = 3;
  private static readonly NOTHING_ENDED_EXIT: number = 4;
  private static readonly POWERSHELL_START_FAILED: number = -1;
  private static readonly POWERSHELL_SLOW_MILLISECONDS: number = 2000;
  private static readonly POWERSHELL_ANSWERED: string = "ended";
  private static readonly POWERSHELL_FAILED: string = "failed to start";
  private static readonly POWERSHELL_STALLED: string = "didn't end and was ended";
  private static readonly POWERSHELL_EXITED: string = "exited with";
  private static readonly WATCH_LINE: string = "TeamRun's MCP watch:";
  private static readonly POWERSHELL_STOP: string = "$ErrorActionPreference = 'Stop'; ";
  private static readonly HOLD_SHELL: string = "/bin/sh";
  private static readonly HOLD_SCRIPT: string = "IFS= read -r go <&3 || exit 1; case $0 in */*) found=$0; [ -e \"$found\" ];; *) found=$(command -v \"$0\" 2>/dev/null);; esac "
    + "|| { echo missing >&3; exit 127; }; case $found in */*) [ -f \"$found\" ] && [ -x \"$found\" ] || { echo denied >&3; exit 126; };; esac; exec 3<&-; "
    + "exec /usr/bin/env";
  private static readonly HOLD_COMMAND: string = "-- \"$0\" \"$@\"";
  private static readonly HOLD_SHELL_VARIABLES: readonly string[] = ["PWD", "SHLVL"];
  private static readonly HOLD_UNSET: string = "-u";
  private static readonly HOLD_RELEASE: string = "go\n";
  private static readonly NOT_FOUND: string = "ENOENT";
  private static readonly HOLD_REFUSALS: ReadonlyMap<string, { readonly exit: number; readonly reason: string }> = new Map([
    ["missing", { exit: 127, reason: SharedMcpLauncher.NOT_FOUND }],
    ["denied", { exit: 126, reason: "EACCES" }]
  ]);
  private static readonly SPAWN_VERB: string = "spawn";
  private static readonly WINDOWS_LISTING: string = "$all = @(Get-CimInstance Win32_Process | Where-Object { $_.CreationDate } | ForEach-Object { [pscustomobject]@{ "
    + "ProcessId = $_.ProcessId; ParentProcessId = $_.ParentProcessId; Created = $_.CreationDate.ToUniversalTime() } }); ";
  private static readonly WINDOWS_TREE_END: string = "while ($next.Count -gt 0) { $found = @($all | Where-Object { $next -contains $_.ParentProcessId "
    + "-and -not $tree.ContainsKey($_.ProcessId) -and $_.Created -ge $tree[$_.ParentProcessId] }); foreach ($child in $found) { $tree[$child.ProcessId] = $child.Created }; "
    + "$ending += $found; $next = @($found | ForEach-Object { $_.ProcessId }) }; "
    + `if ($ending.Count -eq 0) { exit ${SharedMcpLauncher.NOTHING_ENDED_EXIT} }; `
    + "$ending | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";

  private readonly platform: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly program: string;
  private readonly script: string;
  private readonly host: ISharedMcpLauncherHost;
  private readonly start: (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess;
  private readonly isFile: (file: string) => boolean;
  private readonly delayAsync: (milliseconds: number, signal?: AbortSignal) => Promise<unknown>;
  private readonly now: () => number;

  public constructor(platform: string, environment: NodeJS.ProcessEnv, program: string, script: string, host: ISharedMcpLauncherHost = process,
    start: (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess = spawn, isFile: (file: string) => boolean = SharedMcpLauncher.fileExists,
    delayAsync: (milliseconds: number, signal?: AbortSignal) => Promise<unknown> = (milliseconds, signal) => delay(milliseconds, undefined, { signal }),
    now: () => number = () => performance.now()) {
    this.platform = platform;
    this.environment = environment;
    this.program = program;
    this.script = script;
    this.host = host;
    this.start = start;
    this.isFile = isFile;
    this.delayAsync = delayAsync;
    this.now = now;
  }

  private get isWindows(): boolean {
    return this.platform === SharedMcpLauncher.WINDOWS;
  }

  public async runAsync(main: boolean, args: readonly string[]): Promise<void> {
    if (!main)
      return;
    if (args[0] === SharedMcpLauncher.watchOption)
      await this.watchAsync(args.slice(1));
    else
      this.host.exit(await this.launchAsync(args));
  }

  public static withholds(name: string): boolean {
    return SharedMcpLauncher.withheldVariables.some(t => t.toUpperCase() === name.toUpperCase());
  }

  public static environmentToStart<T extends Readonly<Record<string, string | undefined>>>(platform: string, environment: T): T {
    return platform === SharedMcpLauncher.WINDOWS ? { ...environment, [SharedMcpLauncher.NO_FOLDER_LOOKUP_VARIABLE]: SharedMcpLauncher.NO_FOLDER_LOOKUP } : environment;
  }

  public environmentOf(names: readonly string[]): Record<string, string> {
    const wanted = new Set([...this.isWindows ? SharedMcpLauncher.windowsBasics : SharedMcpLauncher.posixBasics, ...names].map(t => this.keyOf(t)));
    const certificates = new Map(SharedMcpLauncher.certificateVariables.map(t => [this.keyOf(t), t]));
    const entries = Object.entries(this.environment).filter((t): t is [string, string] => t[1] !== undefined && !SharedMcpLauncher.withholds(t[0]));
    const found = entries.flatMap(([name, value]): [string, string][] => {
      const certificate = certificates.get(this.keyOf(name));
      return certificate === undefined || value.length === 0 ? [] : [[certificate, path.resolve(value)]];
    });
    const replaced = new Set(found.map(t => this.keyOf(t[0])));
    return Object.fromEntries([...entries.filter(t => wanted.has(this.keyOf(t[0])) && !replaced.has(this.keyOf(t[0]))), ...found]);
  }

  public commandOf(command: string, args: readonly string[], environment: Readonly<Record<string, string>>): { command: string; args: string[]; verbatim: boolean } | null {
    if (!this.isWindows)
      return { command, args: [...args], verbatim: false };

    const located = this.locate(command, environment);
    if (Object.isNull(located))
      return null;
    if (!SharedMcpLauncher.BATCH_FILE.test(located))
      return { command: located, args: [...args], verbatim: false };
    const line = [located.replace(SharedMcpLauncher.SHELL_META, "^$1"), ...args.map(t => SharedMcpLauncher.escapeArgument(t))].join(" ");
    const shell = SharedMcpLauncher.valueOf(environment, SharedMcpLauncher.SHELL_VARIABLE);
    return { command: !Object.isUndefined(shell) && path.win32.isAbsolute(shell) ? shell : path.win32.join(SharedMcpLauncher.systemFolderOf(environment),
      SharedMcpLauncher.SHELL), args: [...SharedMcpLauncher.SHELL_ARGUMENTS, `"${line}"`], verbatim: true };
  }

  private async launchAsync(args: readonly string[]): Promise<number> {
    const [option, names, separator, command, ...rest] = args;
    if (option !== SharedMcpLauncher.variablesOption || separator !== SharedMcpLauncher.endOfOptions || command === undefined)
      return this.refuse(SharedMcpLauncher.LAUNCH_USAGE, SharedMcpLauncher.USAGE_EXIT);

    const environment = this.environmentOf(String(names).split(SharedMcpLauncher.nameSeparator).filter(t => t.length > 0));
    const target = this.commandOf(command, rest, environment);
    if (Object.isNull(target))
      return this.refuse([SharedMcpLauncher.SPAWN_VERB, command, SharedMcpLauncher.NOT_FOUND].join(" "), SharedMcpLauncher.FAILED_EXIT);
    const watch = this.start(this.program, [this.script, SharedMcpLauncher.watchOption], { env: this.environment, stdio: ["pipe", "ignore", this.isWindows ? "inherit" : "ignore"],
      detached: true, windowsHide: true, ...this.isWindows ? { cwd: SharedMcpLauncher.systemFolderOf(this.environment) } : {} }).on("error", () => undefined);
    watch.stdin?.on("error", () => undefined);
    const script = [SharedMcpLauncher.HOLD_SCRIPT, ...SharedMcpLauncher.HOLD_SHELL_VARIABLES.filter(t => environment[t] === undefined)
      .flatMap(t => [SharedMcpLauncher.HOLD_UNSET, t]), SharedMcpLauncher.HOLD_COMMAND].join(" ");
    const held = this.isWindows ? target : { command: SharedMcpLauncher.HOLD_SHELL, args: ["-c", script, target.command, ...target.args], verbatim: false };
    let processId: number | undefined;
    const forward = (signal: NodeJS.Signals): void => {
      if (processId !== undefined)
        this.signalQuietly(this.isWindows ? processId : -processId, signal);
    };
    for (const signal of SharedMcpLauncher.forwardedSignals)
      this.host.on(signal, forward);
    try {
      const server = this.start(held.command, held.args, { env: SharedMcpLauncher.environmentToStart(this.platform, environment),
        stdio: this.isWindows ? "inherit" : ["inherit", "inherit", "inherit", "pipe"],
        windowsHide: true, windowsVerbatimArguments: held.verbatim, detached: !this.isWindows });
      processId = server.pid;
      if (processId === undefined)
        watch.stdin?.end();
      else
        watch.stdin?.write(`${processId}${SharedMcpLauncher.LINE_END}`);
      const ended = new Promise<number>(resolve => {
        server.once("error", error => resolve(this.refuse(error.message, SharedMcpLauncher.FAILED_EXIT)));
        server.once("exit", (code, signal) => resolve(code ?? SharedMcpLauncher.SIGNAL_EXIT_BASE + Number(SharedMcpLauncher.SIGNAL_NUMBERS[String(signal)])));
      });
      if (processId === undefined)
        return ended;

      const release = server.stdio[3];
      let said = "";
      if (release instanceof Writable)
        release.on("error", () => undefined).on("data", (chunk: Buffer) => {
          said += chunk.toString();
        }).end(SharedMcpLauncher.HOLD_RELEASE);
      const code = await ended;
      watch.stdin?.write(`${SharedMcpLauncher.EXITED_LINE}${SharedMcpLauncher.LINE_END}`);
      if (![...SharedMcpLauncher.HOLD_REFUSALS.values()].some(t => t.exit === code) || !(release instanceof Writable))
        return code;
      await finished(release).catch(() => undefined);
      const refusal = SharedMcpLauncher.HOLD_REFUSALS.get(said.trim());
      return refusal?.exit === code ? this.refuse([SharedMcpLauncher.SPAWN_VERB, target.command, refusal.reason].join(" "), SharedMcpLauncher.FAILED_EXIT) : code;
    }
    finally {
      for (const signal of SharedMcpLauncher.forwardedSignals)
        this.host.off(signal, forward);
    }
  }

  private async watchAsync(args: readonly string[]): Promise<void> {
    if (args.length > 0) {
      this.host.exit(this.refuse(SharedMcpLauncher.WATCH_USAGE, SharedMcpLauncher.USAGE_EXIT));
      return;
    }

    this.host.stderr.on("error", () => undefined);
    const input = this.host.stdin;
    let text = String();
    await new Promise<void>(resolve => {
      input.on("data", (chunk: Buffer) => text += chunk.toString());
      input.once("end", () => resolve());
      input.once("error", () => resolve());
    });
    const [line = String(), ...more] = text.split(SharedMcpLauncher.LINE_END);
    const processId = Number(line);
    if (more.length === 0 || !SharedMcpLauncher.PROCESS_ID.test(line) || !Number.isSafeInteger(processId)) {
      if (this.isWindows)
        await this.endOrphansOnWindowsAsync();
      this.host.exit(0);
      return;
    }
    const hasExited = more[0] === SharedMcpLauncher.EXITED_LINE;
    if (this.isWindows) {
      if (await this.endOnWindowsAsync(processId, hasExited) === SharedMcpLauncher.NOTHING_ENDED_EXIT && !hasExited)
        this.host.stderr.write(`${SharedMcpLauncher.WATCH_LINE} its launcher ended before server ${processId}, and PowerShell found nothing of it to end.\n`);
    }
    else if (this.signalQuietly(-processId, "SIGTERM")) {
      await this.delayAsync(SharedMcpLauncher.graceMilliseconds);
      this.signalQuietly(-processId, "SIGKILL");
    }
    this.host.exit(0);
  }

  private endOnWindowsAsync(processId: number, hasExited: boolean): Promise<number | null> {
    const script = SharedMcpLauncher.POWERSHELL_STOP + SharedMcpLauncher.WINDOWS_LISTING
      + `$self = @($all | Where-Object { $_.ProcessId -eq ${this.host.pid} }); if ($self.Count -eq 0) { exit ${SharedMcpLauncher.WATCH_MISSING_EXIT} }; `
      + `$holder = @($all | Where-Object { $_.ProcessId -eq ${processId} }); `
      + `$ours = ${hasExited ? "$false" : "$true"} -and $holder.Count -gt 0 -and $holder[0].Created -ge $self[0].Created `
      + "-and $holder[0].ParentProcessId -eq $self[0].ParentProcessId; "
      + "$before = if ($holder.Count -gt 0 -and -not $ours) { $holder[0].Created } else { [DateTime]::MaxValue }; "
      + `$ending = @(if ($ours) { $holder } else { $all | Where-Object { $_.ParentProcessId -eq ${processId} -and $_.Created -ge $self[0].Created `
      + "-and $_.Created -lt $before } }); "
      + "$tree = @{}; foreach ($root in $ending) { $tree[$root.ProcessId] = $root.Created }; $next = @($ending | ForEach-Object { $_.ProcessId }); "
      + SharedMcpLauncher.WINDOWS_TREE_END;
    return this.runPowerShellAsync(script);
  }

  private async endOrphansOnWindowsAsync(): Promise<void> {
    const script = SharedMcpLauncher.POWERSHELL_STOP + SharedMcpLauncher.WINDOWS_LISTING
      + `$self = @($all | Where-Object { $_.ProcessId -eq ${this.host.pid} }); if ($self.Count -eq 0) { exit }; `
      + `$holder = @($all | Where-Object { $_.ProcessId -eq ${this.host.ppid} }); `
      + "$by = if ($holder.Count -gt 0) { $holder[0].Created } else { [DateTime]::MaxValue }; "
      + `$ending = @($all | Where-Object { $_.ParentProcessId -eq ${this.host.ppid} -and $_.ProcessId -ne ${this.host.pid} -and $_.Created -ge $self[0].Created `
      + "-and $_.Created -lt $by }); "
      + "$tree = @{}; foreach ($root in $ending) { $tree[$root.ProcessId] = $root.Created }; $next = @($ending | ForEach-Object { $_.ProcessId }); "
      + SharedMcpLauncher.WINDOWS_TREE_END;
    await this.runPowerShellAsync(script);
  }

  private async runPowerShellAsync(script: string): Promise<number | null> {
    const code = await this.runPowerShellOnceAsync(script, SharedMcpLauncher.powershellAnswerMilliseconds, 1);
    return Object.isNull(code) ? this.runPowerShellOnceAsync(script, SharedMcpLauncher.windowsEndMilliseconds - SharedMcpLauncher.powershellAnswerMilliseconds, 2) : code;
  }

  private async runPowerShellOnceAsync(script: string, limit: number, attempt: number): Promise<number | null> {
    const started = this.now();
    const folder = SharedMcpLauncher.systemFolderOf(this.environment);
    const powershell = this.start(path.win32.join(folder, ...SharedMcpLauncher.POWERSHELL_FOLDER, SharedMcpLauncher.POWERSHELL),
      [...SharedMcpLauncher.POWERSHELL_ARGUMENTS, Buffer.from(script, "utf16le").toString("base64")], { cwd: folder, env: this.environment, stdio: "ignore", windowsHide: true });
    const ended = new Promise<number>(resolve => {
      powershell.once("exit", code => resolve(code ?? SharedMcpLauncher.FAILED_EXIT))
        .once("error", () => resolve(SharedMcpLauncher.POWERSHELL_START_FAILED));
    });
    const timer = new AbortController();
    const code = await Promise.race([ended, this.delayAsync(limit, timer.signal).then(() => null, () => null)]);
    timer.abort();
    const elapsed = Math.round(this.now() - started);
    if (Object.isNull(code))
      powershell.kill();
    const outcome = Object.isNull(code) ? SharedMcpLauncher.POWERSHELL_STALLED : code === SharedMcpLauncher.POWERSHELL_START_FAILED ? SharedMcpLauncher.POWERSHELL_FAILED
      : code === 0 || code === SharedMcpLauncher.NOTHING_ENDED_EXIT ? SharedMcpLauncher.POWERSHELL_ANSWERED : `${SharedMcpLauncher.POWERSHELL_EXITED} ${code}`;
    if (outcome !== SharedMcpLauncher.POWERSHELL_ANSWERED || elapsed > SharedMcpLauncher.POWERSHELL_SLOW_MILLISECONDS)
      this.host.stderr.write(`${SharedMcpLauncher.WATCH_LINE} PowerShell ${attempt} of 2 ${outcome} after ${elapsed} ms.\n`);
    return code;
  }

  private refuse(message: string, code: number): number {
    this.host.stderr.write(`${message}\n`);
    return code;
  }

  private signalQuietly(processId: number, signal: NodeJS.Signals): boolean {
    try {
      this.host.kill(processId, signal);
      return true;
    }
    catch {
      return false;
    }
  }

  private locate(command: string, environment: Readonly<Record<string, string>>): string | null {
    const extensions = (SharedMcpLauncher.valueOf(environment, SharedMcpLauncher.EXTENSIONS_VARIABLE) ?? SharedMcpLauncher.DEFAULT_EXTENSIONS)
      .split(SharedMcpLauncher.LIST_SEPARATOR).filter(t => t.length > 0);
    const isPath = SharedMcpLauncher.FOLDER_SEPARATOR.test(command);
    const folders = isPath ? [String()] : (SharedMcpLauncher.valueOf(environment, SharedMcpLauncher.PATH_VARIABLE) ?? String())
      .split(SharedMcpLauncher.LIST_SEPARATOR).filter(t => path.win32.isAbsolute(t));
    const extension = path.extname(command).toUpperCase();
    const named = extensions.some(t => t.toUpperCase() === extension);
    for (const folder of folders) {
      const file = path.join(folder, command);
      const found = [...named ? [file] : [], ...extensions.map(t => `${file}${t}`)].find(t => this.isFile(t));
      if (found !== undefined)
        return found;
    }
    return isPath ? command : null;
  }

  private keyOf(name: string): string {
    return this.isWindows ? name.toUpperCase() : name;
  }

  private static systemFolderOf(environment: Readonly<Record<string, string | undefined>>): string {
    const windows = [SharedMcpLauncher.SYSTEM_ROOT_VARIABLE, SharedMcpLauncher.WINDOWS_FOLDER_VARIABLE].map(t => SharedMcpLauncher.valueOf(environment, t))
      .find(t => t !== undefined && path.win32.isAbsolute(t));
    return path.win32.join(windows ?? SharedMcpLauncher.WINDOWS_FOLDER, SharedMcpLauncher.SYSTEM_FOLDER);
  }

  private static valueOf(environment: Readonly<Record<string, string | undefined>>, name: string): string | undefined {
    return Object.entries(environment).filter(t => t[0].toUpperCase() === name).map(t => t[1])[0];
  }

  private static escapeArgument(argument: string): string {
    const quoted = `"${argument.replace(SharedMcpLauncher.QUOTE_AFTER_BACKSLASHES, "$1$1\\\"").replace(SharedMcpLauncher.TRAILING_BACKSLASHES, "$1$1")}"`;
    return quoted.replace(SharedMcpLauncher.SHELL_META, "^$1").replace(SharedMcpLauncher.SHELL_META, "^$1");
  }

  private static fileExists(file: string): boolean {
    return existsSync(file) && statSync(file).isFile();
  }
}
