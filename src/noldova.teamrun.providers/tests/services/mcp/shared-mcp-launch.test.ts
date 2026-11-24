/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { constants } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SharedMcpHeader, SharedMcpServerDefinition, SharedMcpTransport } from "@noldova/teamrun.protocol";
import { SharedMcpLaunch, SharedMcpLauncher } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class SharedMcpLaunchTests {
  private static readonly WINDOWS: string = "win32";
  private static readonly ENVIRONMENT_PROBE: string = "process.stdout.write(JSON.stringify(process.env));\n";
  private static readonly ECHO_PROBE: string = "let text = \"\";\nprocess.stdin.on(\"data\", t => text += t);\n"
    + "process.stdin.on(\"end\", () => {\n  process.stdout.write(`echo:${text}`);\n  process.stderr.write(\"errors\");\n  process.exitCode = 7;\n});\n";
  private static readonly ARGUMENTS_PROBE: string = "process.stdout.write(JSON.stringify(process.argv.slice(2)));\n";
  private static readonly STAYING_PROBE: string = "import { writeFileSync } from \"node:fs\";\nwriteFileSync(process.argv[2], String(process.pid));\n"
    + "process.on(\"SIGTERM\", () => undefined);\nsetInterval(() => undefined, 1000);\n";
  private static readonly ENDING_PROBE: string = "import { writeFileSync } from \"node:fs\";\nwriteFileSync(process.argv[2], String(process.pid));\n"
    + "setInterval(() => undefined, 1000);\n";
  private static readonly ARGUMENTS: readonly string[] = ["a b", "x&y", "say \"hi\"", "a\"b", "&echo injected", "50%", "%PATH%", "a^b", "(paren)", "<in>|out",
    "back\\"];
  private static readonly END_DEADLINE: number = 28_000;
  private static readonly POLL: number = 50;

  @TestMethod
  public startsTheLauncherWithTeamRunsRuntimeAsNodeAndPutsNoValueInItsArguments(): void {
    const launch = new SharedMcpLaunch("/opt/teamrun", "/opt/launch-shared-mcp-server.js");

    Assert.areEqual(JSON.stringify([["/opt/launch-shared-mcp-server.js", "--variables", "SEARCH_KEY,SEARCH_REGION", "--", "npx", "-y", "search-server"],
      { SEARCH_KEY: "s1", ELECTRON_RUN_AS_NODE: "1" }]), JSON.stringify([launch.argumentsOf("npx", ["-y", "search-server"], ["SEARCH_KEY", "SEARCH_REGION"]),
      launch.environmentOf({ SEARCH_KEY: "s1" })]));
  }

  @TestMethod
  public async findsItsScriptBesideItAndLoadingTheScriptStartsNothing(): Promise<void> {
    const launch = new SharedMcpLaunch();

    await import(pathToFileURL(launch.script).href);

    Assert.areEqual(JSON.stringify([process.execPath, true, true]), JSON.stringify([launch.program, launch.script.endsWith("launch-shared-mcp-server.js"),
      existsSync(launch.script)]));
  }

  @TestMethod
  public async givesTheServerOnlyTheBasicsItsOwnVariablesAndItsCertificatesNeverTheSenderTokenOrAnotherServersValue(): Promise<void> {
    using directory = new TemporaryDirectory();
    const probe = SharedMcpLaunchTests.write(directory, "environment.mjs", SharedMcpLaunchTests.ENVIRONMENT_PROBE);
    const launcher = SharedMcpLaunchTests.launch([process.execPath, probe], ["SEARCH_KEY", "TEAMRUN_SENDER_TOKEN"], { TEAMRUN_SENDER_TOKEN: "fake-sender",
      OTHER_KEY: "o1", SEARCH_KEY: "s1", SSL_CERT_FILE: "certs/ca.pem" });

    const [code, output] = await SharedMcpLaunchTests.finishAsync(launcher);

    const seen: Record<string, string> = JSON.parse(output);
    const windows = process.platform === SharedMcpLaunchTests.WINDOWS;
    const allowed = new Set([...windows ? [...SharedMcpLauncher.windowsBasics, "LOGONSERVER", "NoDefaultCurrentDirectoryInExePath"] : SharedMcpLauncher.posixBasics,
      ...SharedMcpLauncher.certificateVariables, "SEARCH_KEY"].map(t => windows ? t.toUpperCase() : t));
    Assert.areEqual(JSON.stringify([0, "s1", path.resolve("certs/ca.pem"), [], windows ? "1" : undefined]), JSON.stringify([code, seen["SEARCH_KEY"], seen["SSL_CERT_FILE"],
      Object.keys(seen).filter(t => !allowed.has(windows ? t.toUpperCase() : t)), seen["NoDefaultCurrentDirectoryInExePath"]]));
    Assert.areEqual(JSON.stringify([undefined, undefined, undefined]), JSON.stringify(["TEAMRUN_SENDER_TOKEN", "ELECTRON_RUN_AS_NODE", "OTHER_KEY"].map(t => seen[t])));
  }

  @TestMethod
  public refusesForEveryProviderAServerThatNamesTheSenderTokenInAnyCaseAnywhere(): void {
    const launch = new SharedMcpLaunch("/opt/teamrun", "/opt/launch-shared-mcp-server.js");
    const servers = [new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], ["SEARCH_KEY", "teamrun_sender_token"], null, [], null),
      new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp", [new SharedMcpHeader("X-Team", "TEAMRUN_SENDER_TOKEN")],
        null),
      new SharedMcpServerDefinition("tracker", SharedMcpTransport.Http, null, [], [], "https://tracker.example/mcp", [], "TEAMRUN_SENDER_TOKEN"),
      new SharedMcpServerDefinition("files", SharedMcpTransport.Stdio, "npx", [], ["FILES_KEY"], null, [], null)];

    Assert.areEqual(JSON.stringify([...["teamrun_sender_token", "TEAMRUN_SENDER_TOKEN", "TEAMRUN_SENDER_TOKEN"]
      .map(t => ({ reason: `TeamRun keeps ${t}, TeamRun's own sender token, from the MCP servers it passes Codex.`, short: `${t} kept from it` })), null]),
    JSON.stringify(servers.map(t => launch.refusalOf(t, "Codex"))));
  }

  @TestMethod
  public async passesInputOutputAndErrorsThroughAndExitsWithTheServersCode(): Promise<void> {
    using directory = new TemporaryDirectory();
    const probe = SharedMcpLaunchTests.write(directory, "echo.mjs", SharedMcpLaunchTests.ECHO_PROBE);
    const launcher = SharedMcpLaunchTests.launch([process.execPath, probe], [], {});
    let errors = "";
    launcher.stderr?.on("data", (chunk: Buffer) => errors += chunk.toString());

    launcher.stdin?.end("{\"jsonrpc\":\"2.0\"}\n");
    const [code, output] = await SharedMcpLaunchTests.finishAsync(launcher);

    Assert.areEqual(JSON.stringify([7, "echo:{\"jsonrpc\":\"2.0\"}\n", "errors"]),
      JSON.stringify([code, output, errors.replace(/TeamRun's MCP watch: [^\n]*\n/gu, "")]));
  }

  @TestMethod
  public async passesEachArgumentUnchangedThroughABatchFileOrAnNpmShimOnWindowsAndAScriptElsewhere(): Promise<void> {
    using directory = new TemporaryDirectory();
    const probe = SharedMcpLaunchTests.write(directory, "arguments.mjs", SharedMcpLaunchTests.ARGUMENTS_PROBE);
    const commands: string[] = [];
    if (process.platform === SharedMcpLaunchTests.WINDOWS) {
      mkdirSync(directory.resolve("bin"));
      mkdirSync(directory.resolve("node_modules", ".bin"), { recursive: true });
      const line = `@"${process.execPath}" "${probe}" %*\r\n`;
      writeFileSync(directory.resolve("bin", "echo-arguments.cmd"), line);
      writeFileSync(directory.resolve("node_modules", ".bin", "echo-arguments.cmd"), line);
      commands.push(directory.resolve("bin", "echo-arguments.cmd"), directory.resolve("node_modules", ".bin", "echo-arguments"));
    }
    else {
      const script = SharedMcpLaunchTests.write(directory, "echo-arguments.sh", `#!/bin/sh\nexec "${process.execPath}" "${probe}" "$@"\n`);
      chmodSync(script, 0o755);
      commands.push(script);
    }

    const seen: [number, string[]][] = [];
    for (const command of commands) {
      const [code, output] = await SharedMcpLaunchTests.finishAsync(SharedMcpLaunchTests.launch([command, ...SharedMcpLaunchTests.ARGUMENTS], [], {}));
      seen.push([code, JSON.parse(output)]);
    }

    Assert.areEqual(JSON.stringify(commands.map(() => [0, SharedMcpLaunchTests.ARGUMENTS])), JSON.stringify(seen));
  }

  @TestMethod
  public async endsTheServerAndWhatItStartedWhenTheLauncherIsEndedWithoutWarning(): Promise<void> {
    const deadline = Date.now() + SharedMcpLaunchTests.END_DEADLINE;
    using directory = new TemporaryDirectory();
    const windows = process.platform === SharedMcpLaunchTests.WINDOWS;
    const probe = SharedMcpLaunchTests.write(directory, "staying.mjs", SharedMcpLaunchTests.STAYING_PROBE);
    const pidFile = directory.resolve("server.pid");
    const command = windows ? [SharedMcpLaunchTests.write(directory, "staying.cmd", `@"${process.execPath}" "${probe}" %*\r\n`), pidFile]
      : [process.execPath, probe, pidFile];
    const launcher = SharedMcpLaunchTests.launch(command, [], {});
    let errors = "";
    launcher.stderr?.on("data", (chunk: Buffer) => errors += chunk.toString());
    const ended = new Promise<void>(resolve => launcher.once("exit", () => resolve()));

    await Wait.until(() => existsSync(pidFile) && readFileSync(pidFile, "utf8").length > 0, "The server did not write its process id.");
    const serverId = Number(readFileSync(pidFile, "utf8"));
    launcher.kill("SIGKILL");
    await ended;

    Assert.isTrue(await SharedMcpLaunchTests.endsAsync(serverId, deadline), `The server still ran; the launcher's errors: "${errors}"`);
  }

  @TestMethod
  public async passesSigtermToTheServerAndExitsWithItsSignalOutsideWindows(): Promise<void> {
    if (process.platform === SharedMcpLaunchTests.WINDOWS)
      return;
    const deadline = Date.now() + SharedMcpLaunchTests.END_DEADLINE;
    using directory = new TemporaryDirectory();
    const probe = SharedMcpLaunchTests.write(directory, "ending.mjs", SharedMcpLaunchTests.ENDING_PROBE);
    const pidFile = directory.resolve("server.pid");
    const launcher = SharedMcpLaunchTests.launch([process.execPath, probe, pidFile], [], {});

    await Wait.until(() => existsSync(pidFile) && readFileSync(pidFile, "utf8").length > 0, "The server did not write its process id.");
    const serverId = Number(readFileSync(pidFile, "utf8"));
    launcher.kill("SIGTERM");
    const [code] = await SharedMcpLaunchTests.finishAsync(launcher);

    Assert.areEqual(JSON.stringify([128 + constants.signals.SIGTERM, true]), JSON.stringify([code, await SharedMcpLaunchTests.endsAsync(serverId, deadline)]));
  }

  private static launch(command: readonly string[], variables: readonly string[], values: Readonly<Record<string, string>>): ChildProcess {
    const launch = new SharedMcpLaunch();
    const [program = String(), ...args] = command;
    return spawn(launch.program, launch.argumentsOf(program, args, variables), { env: { ...process.env, ...launch.environmentOf(values) }, windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"] });
  }

  private static async finishAsync(child: ChildProcess): Promise<[number, string]> {
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => output += chunk.toString());
    const code = await new Promise<number>(resolve => child.once("close", (exit: number | null) => resolve(Number(exit))));
    return [code, output];
  }

  private static async endsAsync(processId: number, deadline: number): Promise<boolean> {
    while (SharedMcpLaunchTests.runs(processId)) {
      if (Date.now() > deadline)
        return false;
      await Wait.delay(SharedMcpLaunchTests.POLL);
    }
    return true;
  }

  private static runs(processId: number): boolean {
    try {
      process.kill(processId, 0);
      return true;
    }
    catch {
      return false;
    }
  }

  private static write(directory: TemporaryDirectory, name: string, text: string): string {
    const file = directory.resolve(name);
    writeFileSync(file, text);
    return file;
  }
}
