/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import ExecutableLocator from "../../processes/executable-locator.ts";

export default class CommandDoublesFixture {
  private static readonly PREFIX: string = "teamrun-doubles-";
  private static readonly TIMEOUT: number = 30_000;
  private static readonly EXECUTABLE_MODE: number = 0o755;
  private static readonly SCRIPT_NAME: string = "step.sh";
  private static readonly CALL_LOG_NAME: string = "calls.log";
  private static readonly BASH_OPTIONS: readonly string[] = ["--noprofile", "--norc", "-eo", "pipefail"];
  private static readonly WINDOWS_PLATFORM: string = "win32";
  private static readonly WINDOWS_BASH: string = "../../../bin/bash.exe";
  private static readonly SYSTEM_SEARCH_PATH: readonly string[] = ["/usr/bin", "/bin"];

  private static bash: string | null = null;

  private readonly root: string;
  private readonly responses: Map<string, string[]> = new Map<string, string[]>();
  private readonly forwarded: Set<string> = new Set<string>();

  public readonly directory: string;

  private constructor(root: string) {
    this.root = root;
    this.directory = path.join(root, "work");
  }

  public static async createAsync(): Promise<CommandDoublesFixture> {
    const fixture = new CommandDoublesFixture(await mkdtemp(path.join(tmpdir(), CommandDoublesFixture.PREFIX)));
    await mkdir(fixture.binaryDirectory);
    await mkdir(fixture.directory);
    return fixture;
  }

  public static readBashMajorVersion(): number {
    const result = spawnSync(CommandDoublesFixture.locateBash(), ["--noprofile", "--norc", "-c", "echo \"${BASH_VERSINFO[0]}\""], {
      encoding: "utf8", timeout: CommandDoublesFixture.TIMEOUT
    });
    return Number.parseInt(result.stdout, 10);
  }

  public respond(command: string, commandArguments: string, output: string, exitCode: number = 0): void {
    const responses = this.responses.get(command) ?? [];
    responses.push(`  ${CommandDoublesFixture.quote(commandArguments)}) printf '%s' ${CommandDoublesFixture.quote(output)}; exit ${exitCode} ;;`);
    this.responses.set(command, responses);
  }

  public respondInTurn(command: string, commandArguments: string, exitCodes: readonly number[], errorText: string = ""): void {
    const counter = CommandDoublesFixture.quote(CommandDoublesFixture.toShellPath(path.join(this.root, `${command}.turn`)));
    const body = [
      `n=$(cat ${counter} 2>/dev/null || echo 0)`,
      "n=$((n + 1))",
      `echo "$n" > ${counter}`,
      `set -- ${exitCodes.join(" ")}`,
      "i=0; code=0; for c in \"$@\"; do i=$((i + 1)); code=$c; if [ \"$i\" -ge \"$n\" ]; then break; fi; done",
      `if [ "$code" -ne 0 ]; then printf '%s\n' ${CommandDoublesFixture.quote(errorText)} >&2; fi`,
      "exit \"$code\""
    ].join("; ");
    const responses = this.responses.get(command) ?? [];
    responses.push(`  ${CommandDoublesFixture.quote(commandArguments)}) ${body} ;;`);
    this.responses.set(command, responses);
  }

  public forward(command: string): void {
    this.forwarded.add(command);
  }

  public async readCallsAsync(): Promise<readonly string[]> {
    return existsSync(this.callLog) ? (await readFile(this.callLog, "utf8")).split("\n").filter(t => t.length > 0) : [];
  }

  public async readFileAsync(name: string): Promise<string> {
    return readFile(path.join(this.directory, name), "utf8");
  }

  public async runAsync(script: string, environment: Readonly<Record<string, string>> = {}): Promise<ICommandResult> {
    for (const [command, responses] of this.responses)
      await this.writeDoubleAsync(command, ["case \"$*\" in", ...responses, "esac", "echo \"Unexpected call: $0 $*\" >&2", "exit 127"]);
    for (const command of this.forwarded)
      await this.writeDoubleAsync(command, ["shift", "exec \"$@\""]);

    const scriptPath = path.join(this.directory, CommandDoublesFixture.SCRIPT_NAME);
    await writeFile(scriptPath, script);
    const child = spawn(CommandDoublesFixture.locateBash(), [...CommandDoublesFixture.BASH_OPTIONS, scriptPath], {
      cwd: this.directory,
      env: { ...process.env, ...environment, PATH: this.formatSearchPath() },
      timeout: CommandDoublesFixture.TIMEOUT
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (text: string) => stdout += text);
    child.stderr.setEncoding("utf8").on("data", (text: string) => stderr += text);
    const status = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", code => resolve(code));
    });
    return { status, stdout, stderr };
  }

  public async disposeAsync(): Promise<void> {
    await rm(this.root, { recursive: true, force: true });
  }

  private static quote(text: string): string {
    return `'${text.replaceAll("'", "'\\''")}'`;
  }

  private static locateBash(): string {
    CommandDoublesFixture.bash ??= process.platform === CommandDoublesFixture.WINDOWS_PLATFORM
      ? path.resolve(spawnSync("git", ["--exec-path"], { encoding: "utf8", timeout: CommandDoublesFixture.TIMEOUT }).stdout.trim(), CommandDoublesFixture.WINDOWS_BASH)
      : ExecutableLocator.locate("bash");
    return CommandDoublesFixture.bash;
  }


  private static toShellPath(file: string): string {
    return file.replaceAll("\\", "/");
  }

  private get binaryDirectory(): string {
    return path.join(this.root, "bin");
  }

  private get callLog(): string {
    return path.join(this.root, CommandDoublesFixture.CALL_LOG_NAME);
  }

  private formatSearchPath(): string {
    const system = process.platform === CommandDoublesFixture.WINDOWS_PLATFORM ? [process.env["PATH"] ?? ""] : CommandDoublesFixture.SYSTEM_SEARCH_PATH;
    return [this.binaryDirectory, ...system].join(path.delimiter);
  }

  private async writeDoubleAsync(command: string, body: readonly string[]): Promise<void> {
    const log = CommandDoublesFixture.quote(CommandDoublesFixture.toShellPath(this.callLog));
    const lines = ["#!/bin/sh", `printf '%s\\n' "${command} $*" >> ${log}`, ...body, ""];
    await writeFile(path.join(this.binaryDirectory, command), lines.join("\n"), { mode: CommandDoublesFixture.EXECUTABLE_MODE });
  }
}

export interface ICommandResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}
