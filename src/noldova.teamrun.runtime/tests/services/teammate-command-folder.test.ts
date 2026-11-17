/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TeammateCommandFolder } from "@noldova/teamrun.runtime";

import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

type ShellRun = (script: string, folder: string, environment: NodeJS.ProcessEnv) => string;

@TestClass
export class TeammateCommandFolderTests {
  private static readonly MESSAGE: string = "He said \"ship it\" at 100% & left! Pay $5, see %PATH% and $HOME, 'quoted' and `ticked`.\nSecond line — done.";
  private static readonly ENTRY: string = [
    "import { readFileSync } from \"node:fs\";",
    "process.stdout.write(JSON.stringify({ arguments: process.argv.slice(2), input: readFileSync(0, \"utf8\"), runAsNode: process.env.ELECTRON_RUN_AS_NODE, crashPipe: process.env.CHROME_CRASHPAD_PIPE_NAME ?? null }));"
  ].join("\n");
  private static readonly DATA_FOLDER: string = "data 100% it's! Bücher";
  private static readonly ENTRY_FOLDER: string = "Café app";
  private static readonly SEND: string = "acme teamrun send c1 - --teammate Reviewer";

  @TestMethod
  public async writesAShScriptThatRunsTheProgramInNodeModeOnTheRuntimesDataDirectory(): Promise<void> {
    using directory = new TemporaryDirectory();
    const moduleFolder = directory.resolve("it's data", "modules", "teamrun");
    const folder = new TeammateCommandFolder("/opt/Team Run/teamrun", "/opt/Team Run/resources/app.asar/cli-entry.js", "linux", { PATH: "/usr/bin" });

    const command = await folder.writeAsync(moduleFolder, "acme", "teamrun");

    const script = join(moduleFolder, "command", "acme");
    Assert.areEqual([
      "#!/bin/sh",
      "export ELECTRON_RUN_AS_NODE=1",
      "unset CHROME_CRASHPAD_PIPE_NAME",
      `exec '/opt/Team Run/teamrun' '/opt/Team Run/resources/app.asar/cli-entry.js' '--data-dir=${directory.resolve("it's data").replaceAll("'", "'\\''")}' "$@"`,
      ""
    ].join("\n"), readFileSync(script, "utf8"));
    if (process.platform !== "win32")
      Assert.areEqual(0o755, statSync(script).mode & 0o777);
    Assert.isFalse(existsSync(`${script}.cmd`));
    Assert.areEqual("acme teamrun", command.words);
    Assert.areEqual(JSON.stringify({ PATH: `${join(moduleFolder, "command")}:/usr/bin` }), JSON.stringify(command.environment));
  }

  @TestMethod
  public async writesACmdOfAsciiAloneBesideTheScriptOnWindowsThatReadsThePathsFromTheTurnsEnvironment(): Promise<void> {
    using directory = new TemporaryDirectory();
    const moduleFolder = directory.resolve("100% Bücher data", "modules", "teamrun");
    const folder = new TeammateCommandFolder("C:\\Program Files\\Team Run\\Team Run.exe", "C:\\Apps\\Café\\cli-entry.js", "win32",
      { Path: "C:\\Windows", PATHEXT: ".COM;.EXE;.CMD" });

    const command = await folder.writeAsync(moduleFolder, "acme", "teamrun");

    const script = join(moduleFolder, "command", "acme");
    const data = directory.resolve("100% Bücher data");
    Assert.areEqual([
      "@echo off",
      "setlocal DisableDelayedExpansion",
      "if not defined TEAMRUN_COMMAND_PROGRAM (",
      "  echo This command runs only in a teammate's turn, whose environment names the app's program. 1>&2",
      "  exit /b 1",
      ")",
      "set ELECTRON_RUN_AS_NODE=1",
      "set CHROME_CRASHPAD_PIPE_NAME=",
      "\"%TEAMRUN_COMMAND_PROGRAM%\" \"%TEAMRUN_COMMAND_ENTRY%\" \"--data-dir=%TEAMRUN_COMMAND_DATA_DIR%\" %*",
      "exit /b %ERRORLEVEL%",
      ""
    ].join("\r\n"), readFileSync(`${script}.cmd`, "utf8"));
    Assert.areEqual(
      `exec 'C:/Program Files/Team Run/Team Run.exe' 'C:/Apps/Café/cli-entry.js' '--data-dir=${data.replaceAll("\\", "/")}' "$@"`,
      readFileSync(script, "utf8").split("\n")[3]);
    Assert.areEqual(JSON.stringify({
      Path: `${join(moduleFolder, "command")};C:\\Windows`,
      TEAMRUN_COMMAND_PROGRAM: "C:\\Program Files\\Team Run\\Team Run.exe",
      TEAMRUN_COMMAND_ENTRY: "C:\\Apps\\Café\\cli-entry.js",
      TEAMRUN_COMMAND_DATA_DIR: data
    }), JSON.stringify(command.environment));
  }

  @TestMethod
  public async startsThePathWithTheFolderAloneWhenTheEnvironmentHasNone(): Promise<void> {
    using directory = new TemporaryDirectory();
    const moduleFolder = directory.resolve("data", "modules", "teamrun");

    const command = await new TeammateCommandFolder("/opt/teamrun", "/opt/cli-entry.js", "darwin", {}).writeAsync(moduleFolder, "acme", "teamrun");
    const windows = await new TeammateCommandFolder("C:\\Apps\\TeamRun\\TeamRun.exe", "C:\\Apps\\TeamRun\\cli-entry.js", "win32", { PATHEXT: ".CMD" })
      .writeAsync(moduleFolder, "acme", "teamrun");

    Assert.areEqual(JSON.stringify({ PATH: join(moduleFolder, "command") }), JSON.stringify(command.environment));
    Assert.areEqual(join(moduleFolder, "command"), windows.environment["PATH"]);
  }

  @TestMethod
  public async replacesWhatAnEarlierStartWrote(): Promise<void> {
    using directory = new TemporaryDirectory();
    const moduleFolder = directory.resolve("data", "modules", "teamrun");
    await new TeammateCommandFolder("/opt/old/teamrun", "/opt/old/cli-entry.js", "linux", {}).writeAsync(moduleFolder, "acme", "teamrun");

    await new TeammateCommandFolder("/opt/new/teamrun", "/opt/new/cli-entry.js", "linux", {}).writeAsync(moduleFolder, "acme", "teamrun");

    const script = readFileSync(join(moduleFolder, "command", "acme"), "utf8");
    Assert.isTrue(script.includes("'/opt/new/teamrun' '/opt/new/cli-entry.js'"), script);
    Assert.isFalse(script.includes("/opt/old/"), script);
  }

  @TestMethod
  public async rejectsWhenTheFolderCantBeWritten(): Promise<void> {
    using directory = new TemporaryDirectory();
    const moduleFolder = directory.resolve("teamrun");
    mkdirSync(moduleFolder);
    writeFileSync(join(moduleFolder, "command"), "");

    await Assert.throwsAsync(() => new TeammateCommandFolder("/opt/teamrun", "/opt/cli-entry.js", "linux", {}).writeAsync(moduleFolder, "acme", "teamrun"), Error);
  }

  @TestMethod
  public async runsInEveryShellOfThePlatformAndHandsTheMessageOverWhole(): Promise<void> {
    using directory = new TemporaryDirectory();
    const moduleFolder = directory.resolve(TeammateCommandFolderTests.DATA_FOLDER, "modules", "teamrun");
    const entry = TeammateCommandFolderTests.writeEntry(directory);
    const command = await new TeammateCommandFolder(process.execPath, entry, process.platform, process.env).writeAsync(moduleFolder, "acme", "teamrun");
    const environment = { ...process.env, ...command.environment, CHROME_CRASHPAD_PIPE_NAME: "crashpad-pipe-of-the-app" };
    const expected = [`--data-dir=${directory.resolve(TeammateCommandFolderTests.DATA_FOLDER)}`, "teamrun", "send", "c1", "-", "--teammate", "Reviewer"];

    const shells = TeammateCommandFolderTests.shells();
    for (const [name, run] of shells) {
      const result = JSON.parse(run(TeammateCommandFolderTests.SEND, directory.path, environment)) as { arguments: string[]; input: string; runAsNode: string; crashPipe: string | null };
      Assert.areEqual(expected.join(" ").replaceAll("\\", "/"), result.arguments.join(" ").replaceAll("\\", "/"), name);
      Assert.areEqual(`${TeammateCommandFolderTests.MESSAGE}\n`, result.input.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n"), name);
      Assert.areEqual("1", result.runAsNode, name);
      Assert.isNull(result.crashPipe, name);
    }
    Assert.areEqual(process.platform === "win32" ? "powershell,cmd,bash" : process.platform === "darwin" ? "sh,bash,zsh" : "sh,bash",
      shells.map(([name]) => name).join(","));
  }

  @TestMethod
  public async refusesInCmdOutsideATeammatesTurn(): Promise<void> {
    if (process.platform !== "win32")
      return;
    using directory = new TemporaryDirectory();
    const moduleFolder = directory.resolve(TeammateCommandFolderTests.DATA_FOLDER, "modules", "teamrun");
    const entry = TeammateCommandFolderTests.writeEntry(directory);
    const command = await new TeammateCommandFolder(process.execPath, entry, process.platform, process.env).writeAsync(moduleFolder, "acme", "teamrun");
    const pathName = Object.keys(command.environment).find(t => t.toUpperCase() === "PATH") ?? "PATH";

    const run = spawnSync("cmd.exe", ["/d", "/s", "/c", "acme teamrun list-chats"],
      { cwd: directory.path, env: { ...process.env, [pathName]: command.environment[pathName] }, encoding: "utf8" });

    Assert.areEqual(1, run.status);
    Assert.areEqual("", run.stdout);
    Assert.areEqual("This command runs only in a teammate's turn, whose environment names the app's program.", run.stderr.trim());
  }

  private static writeEntry(directory: TemporaryDirectory): string {
    const entry = directory.resolve(TeammateCommandFolderTests.ENTRY_FOLDER, "entry.mjs");
    mkdirSync(directory.resolve(TeammateCommandFolderTests.ENTRY_FOLDER), { recursive: true });
    writeFileSync(entry, TeammateCommandFolderTests.ENTRY);
    return entry;
  }

  private static shells(): (readonly [string, ShellRun])[] {
    if (process.platform !== "win32")
      return ["sh", "bash", ...process.platform === "darwin" ? ["zsh"] : []].map(t => [t, TeammateCommandFolderTests.hereDocument(t)] as const);
    const bash = join(process.env["ProgramFiles"] ?? "C:\\Program Files", "Git", "bin", "bash.exe");
    return [["powershell", TeammateCommandFolderTests.hereString], ["cmd", TeammateCommandFolderTests.redirected], ["bash", TeammateCommandFolderTests.hereDocument(bash)]];
  }

  private static hereDocument(shell: string): ShellRun {
    return (script, folder, environment) =>
      TeammateCommandFolderTests.read(spawnSync(shell, ["-c", `${script} <<'EOF'\n${TeammateCommandFolderTests.MESSAGE}\nEOF\n`], { cwd: folder, env: environment, encoding: "utf8" }));
  }

  private static hereString(script: string, folder: string, environment: NodeJS.ProcessEnv): string {
    const encoded = Buffer.from(`$OutputEncoding = [Text.UTF8Encoding]::new($false); @'\n${TeammateCommandFolderTests.MESSAGE}\n'@ | ${script}`, "utf16le")
      .toString("base64");
    return TeammateCommandFolderTests.read(spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
      { cwd: folder, env: environment, encoding: "utf8" }));
  }

  private static redirected(script: string, folder: string, environment: NodeJS.ProcessEnv): string {
    writeFileSync(join(folder, "message.txt"), `${TeammateCommandFolderTests.MESSAGE}\n`);
    return TeammateCommandFolderTests.read(spawnSync("cmd.exe", ["/d", "/s", "/c", `${script} < message.txt`], { cwd: folder, env: environment, encoding: "utf8" }));
  }

  private static read(run: SpawnSyncReturns<string>): string {
    if (run.status !== 0 || run.error !== undefined)
      throw new Error(`The shell ended with ${run.status}: ${run.error?.message ?? ""}${run.stderr}`);
    return run.stdout;
  }
}
