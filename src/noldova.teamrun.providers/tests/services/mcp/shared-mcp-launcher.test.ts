/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChildProcess, type SpawnOptions, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { constants } from "node:os";
import path from "node:path";
import { Duplex, PassThrough, Writable } from "node:stream";

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { Resources as ProtocolResources } from "@noldova/teamrun.protocol";
import { SharedMcpLauncher } from "@noldova/teamrun.providers";

import { FakeLauncherHost } from "../../fixtures/fake-launcher-host.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class SharedMcpLauncherTests {
  private static readonly EXIT_SCRIPT: string = "process.exit(Number(process.argv[1]))";
  private static readonly INPUT_SCRIPT: string = "process.stdin.resume(); process.stdin.on(\"end\", () => process.exit(0))";
  private static readonly NO_SUCH_PROGRAM: string = "teamrun-no-such-program";
  private static readonly VERSION_OPTION: string = "--version";
  private static readonly HANDED: string = "4321\n";
  private static readonly EXITED: string = "4321\nexited\n";
  private static readonly HOLD: string = "IFS= read -r go <&3 || exit 1; case $0 in */*) found=$0; [ -e \"$found\" ];; *) found=$(command -v \"$0\" 2>/dev/null);; esac "
    + "|| { echo missing >&3; exit 127; }; case $found in */*) [ -f \"$found\" ] && [ -x \"$found\" ] || { echo denied >&3; exit 126; };; esac; exec 3<&-; "
    + "exec /usr/bin/env";
  private static readonly KEEP_SCRIPT: string = "setInterval(() => undefined, 1000)";
  private static readonly SERVER_SCRIPT: string = "const child = require(\"node:child_process\").spawn(process.execPath, [\"-e\", process.argv[2]], { stdio: \"ignore\" }); "
    + "require(\"node:fs\").writeFileSync(process.argv[1], String(child.pid)); setInterval(() => undefined, 1000)";
  private static readonly LAUNCHER_SCRIPT: string = "const [file, keep, server] = process.argv.slice(1); const { spawn } = require(\"node:child_process\"); "
    + "const watch = spawn(process.execPath, [\"-e\", keep], { stdio: \"ignore\", detached: true }); "
    + "const child = spawn(process.execPath, [\"-e\", server, `${file}.server`, keep], { stdio: \"ignore\" }); "
    + "require(\"node:fs\").writeFileSync(file, JSON.stringify([watch.pid, child.pid])); setInterval(() => undefined, 1000)";

  @TestMethod
  public async doesNothingWhenItsScriptIsOnlyLoaded(): Promise<void> {
    const host = new FakeLauncherHost();
    const recorder = SharedMcpLauncherTests.recorder();

    await new SharedMcpLauncher("linux", {}, "node", "launch.js", host, recorder.start).runAsync(false, ["--variables", "", "--", "npx"]);

    Assert.areEqual("[]", JSON.stringify([...host.codes, ...recorder.starts]));
  }

  @TestMethod
  public async refusesArgumentsThatAreNeitherALaunchNorAWatch(): Promise<void> {
    const refused: [number[], number, boolean][] = [];

    for (const args of [[], ["--variables"], ["--variables", "KEY", "npx"], ["--variables", "KEY", "--"], ["--watch", "4321"], ["--watch", "1", "2", "3"]]) {
      const host = new FakeLauncherHost();
      const recorder = SharedMcpLauncherTests.recorder();
      await new SharedMcpLauncher("linux", {}, "node", "launch.js", host, recorder.start).runAsync(true, args);
      refused.push([host.codes, recorder.starts.length, host.errors.startsWith("Usage: ")]);
    }

    Assert.areEqual(JSON.stringify(Array.from({ length: 6 }, () => [[2], 0, true])), JSON.stringify(refused));
  }

  @TestMethod
  public async startsTheServerInItsOwnGroupWithOnlyTheBasicsAndItsOwnVariablesAndExitsWithItsCode(): Promise<void> {
    const host = new FakeLauncherHost();
    const input = new PassThrough();
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.watching(input), SharedMcpLauncherTests.exiting(7));
    const environment = { HOME: "/home/a", PATH: "/usr/bin", path: "/elsewhere", LANG: undefined, TEAMRUN_SENDER_TOKEN: "sender", ELECTRON_RUN_AS_NODE: "1",
      SEARCH_KEY: "s1", OTHER_KEY: "o1" };

    const running = new SharedMcpLauncher("linux", environment, "/opt/teamrun", "/opt/launch.js", host, recorder.start)
      .runAsync(true, ["--variables", "SEARCH_KEY,", "--", "npx", "-y", "search-server"]);
    host.emit("SIGINT", "SIGINT");
    await running;

    const processId = Number(recorder.children[1]?.pid);
    const [watch, server] = recorder.starts;
    Assert.areEqual(JSON.stringify([7]), JSON.stringify(host.codes));
    Assert.areEqual(JSON.stringify({ command: "/bin/sh", args: ["-c", `${SharedMcpLauncherTests.HOLD} -u PWD -u SHLVL -- "$0" "$@"`, "npx", "-y", "search-server"], options: {
      env: { HOME: "/home/a", PATH: "/usr/bin", SEARCH_KEY: "s1" }, stdio: ["inherit", "inherit", "inherit", "pipe"], windowsHide: true, windowsVerbatimArguments: false,
      detached: true } }), JSON.stringify(server));
    Assert.areEqual(JSON.stringify({ command: "/opt/teamrun", args: ["/opt/launch.js", "--watch"], options: { env: environment, stdio: ["pipe", "ignore", "ignore"],
      detached: true, windowsHide: true } }), JSON.stringify(watch));
    Assert.areEqual(JSON.stringify([[-processId, "SIGINT"]]), JSON.stringify(host.signals));
  }

  @TestMethod
  public async handsTheWatchTheServersIdAsSoonAsTheServerStartsAndSaysOnceTheServerExits(): Promise<void> {
    const host = new FakeLauncherHost();
    const input = new PassThrough();
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.watching(input), SharedMcpLauncherTests.exiting(0));

    const running = new SharedMcpLauncher("linux", {}, "node", "launch.js", host, recorder.start).runAsync(true, ["--variables", "", "--", "server"]);
    const handed = String(input.read());
    await running;

    Assert.areEqual(JSON.stringify([["--watch", "server"], `${String(recorder.children[1]?.pid)}\n`, "exited\n"]), JSON.stringify([[recorder.starts[0]?.args[1],
      recorder.starts[1]?.args[2]], handed, String(input.read())]));
    Assert.isFalse(input.writableEnded);
  }

  @TestMethod
  public async releasesTheHeldServerOnlyOnceItsWatchHasTheServersLine(): Promise<void> {
    const host = new FakeLauncherHost();
    const input = new PassThrough();
    const released: [string, string][] = [];
    const release = new Writable({
      write: (chunk: Buffer, _encoding, done) => {
        released.push([chunk.toString(), String(input.read() ?? "")]);
        done();
      }
    });
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.watching(input), SharedMcpLauncherTests.holding(release));

    await new SharedMcpLauncher("linux", {}, "node", "launch.js", host, recorder.start).runAsync(true, ["--variables", "", "--", "server"]);

    const [[line, handed] = ["", ""]] = released;
    Assert.areEqual(JSON.stringify(["go\n", true, 1, true, [0]]), JSON.stringify([line, handed === SharedMcpLauncherTests.HANDED, released.length, release.writableFinished, host.codes]));
  }

  @TestMethod
  public async listensForItsForwardedSignalsBeforeItStartsTheServer(): Promise<void> {
    const outside = await SharedMcpLauncherTests.listeningAtStartAsync("linux", {}, "node", "launch.js", () => false, "server");
    const windows = await SharedMcpLauncherTests.listeningAtStartAsync("win32", { Path: "C:\\Windows", SystemRoot: "C:\\Windows" }, "C:\\TeamRun\\TeamRun.exe",
      "C:\\TeamRun\\launch.js", t => t === path.join("C:\\tools\\server.exe"), "C:\\tools\\server.exe");

    const all = SharedMcpLauncher.forwardedSignals.map(() => 1);
    Assert.areEqual(JSON.stringify([all, all]), JSON.stringify([outside, windows]));
  }

  @TestMethod
  public async forwardsNoSignalThatComesWhileTheServerStarts(): Promise<void> {
    const host = new FakeLauncherHost();
    const server = SharedMcpLauncherTests.exiting(0);
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.exiting(0), () => {
      host.emit("SIGTERM", "SIGTERM");
      return server();
    });

    await new SharedMcpLauncher("linux", {}, "node", "launch.js", host, recorder.start).runAsync(true, ["--variables", "", "--", "server"]);

    Assert.areEqual(JSON.stringify([[], [0]]), JSON.stringify([host.signals, host.codes]));
  }

  @TestMethod
  public async leavesTheHoldingShellsOwnVariablesOutOfTheServersEnvironmentButKeepsOnesTheServerNames(): Promise<void> {
    const host = new FakeLauncherHost();
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.exiting(0), SharedMcpLauncherTests.exiting(0));

    await new SharedMcpLauncher("linux", { PWD: "/home/a" }, "node", "launch.js", host, recorder.start).runAsync(true, ["--variables", "PWD", "--", "server"]);

    Assert.areEqual(`${SharedMcpLauncherTests.HOLD} -u SHLVL -- "$0" "$@"`, recorder.starts[1]?.args[1]);
  }

  @TestMethod
  public async exitsWith1AndSaysWhatNodeSaysWhenTheHeldShellAnswersThatTheCommandIsMissing(): Promise<void> {
    const host = new FakeLauncherHost();
    const release: Duplex = new Duplex({
      read: () => undefined,
      write: (_chunk: Buffer, _encoding, done) => {
        release.push("missing\n");
        release.push(null);
        done();
      }
    });
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.exiting(0), SharedMcpLauncherTests.holding(release, 127));

    await new SharedMcpLauncher("linux", {}, "node", "launch.js", host, recorder.start).runAsync(true, ["--variables", "", "--", "search-server"]);

    Assert.areEqual(JSON.stringify([[1], "spawn search-server ENOENT\n"]), JSON.stringify([host.codes, host.errors]));
  }

  @TestMethod
  public async exitsWith1AndSaysWhatNodeSaysWhenTheHeldShellAnswersThatTheCommandCannotRun(): Promise<void> {
    const host = new FakeLauncherHost();
    const release: Duplex = new Duplex({
      read: () => undefined,
      write: (_chunk: Buffer, _encoding, done) => {
        release.push("denied\n");
        release.push(null);
        done();
      }
    });
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.exiting(0), SharedMcpLauncherTests.holding(release, 126));

    await new SharedMcpLauncher("linux", {}, "node", "launch.js", host, recorder.start).runAsync(true, ["--variables", "", "--", "/opt/search-server"]);

    Assert.areEqual(JSON.stringify([[1], "spawn /opt/search-server EACCES\n"]), JSON.stringify([host.codes, host.errors]));
  }

  @TestMethod
  public async exitsWithTheServersCodeWhenTheHeldShellsAnswerIsForAnotherCode(): Promise<void> {
    const host = new FakeLauncherHost();
    const release: Duplex = new Duplex({
      read: () => undefined,
      write: (_chunk: Buffer, _encoding, done) => {
        release.push("missing\n");
        release.push(null);
        done();
      }
    });
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.exiting(0), SharedMcpLauncherTests.holding(release, 126));

    await new SharedMcpLauncher("linux", {}, "node", "launch.js", host, recorder.start).runAsync(true, ["--variables", "", "--", "search-server"]);

    Assert.areEqual(JSON.stringify([[126], ""]), JSON.stringify([host.codes, host.errors]));
  }

  @TestMethod
  public async exitsWithTheServersCodeWhenItsReleaseFailsAndSaysNothing(): Promise<void> {
    const host = new FakeLauncherHost();
    const release = new Duplex({ read: () => undefined, write: (_chunk: Buffer, _encoding, done) => done(new Error("write EPIPE")) });
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.exiting(0), SharedMcpLauncherTests.holding(release, 127));

    await new SharedMcpLauncher("linux", {}, "node", "launch.js", host, recorder.start).runAsync(true, ["--variables", "", "--", "search-server"]);

    Assert.areEqual(JSON.stringify([[127], "", true]), JSON.stringify([host.codes, host.errors, release.destroyed]));
  }

  @TestMethod
  public async startsNoCommandOutsideWindowsWhenItDiesBetweenStartingTheServerAndTellingItsWatch(): Promise<void> {
    if (process.platform === "win32")
      return;
    using directory = new TemporaryDirectory();
    const marker = directory.resolve("ran.txt");
    const servers: ChildProcess[] = [];
    const start = (command: string, args: readonly string[], options: SpawnOptions): ChildProcess => {
      if (args.includes(SharedMcpLauncher.watchOption))
        return SharedMcpLauncherTests.watching(new PassThrough())();
      servers.push(spawn(command, args, { ...options, stdio: ["ignore", "ignore", "ignore", "pipe"] }));
      throw new Error("Killed as the server started.");
    };

    await Assert.throwsAsync(() => new SharedMcpLauncher(process.platform, { ...process.env }, "node", "launch.js", new FakeLauncherHost(), start)
      .runAsync(true, ["--variables", "", "--", process.execPath, "-e", `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "ran")`]), Error);
    const [server] = servers;
    Assert.isDefined(server);
    const exited = once(server, "exit");
    server.stdio[3]?.destroy();
    const [code] = await exited;

    Assert.areEqual(JSON.stringify([1, false]), JSON.stringify([code, existsSync(marker)]));
  }

  @TestMethod
  public async exitsWith1AndSaysWhatNodeSaysOutsideWindowsWhenTheHeldServersCommandIsMissing(): Promise<void> {
    if (process.platform === "win32")
      return;
    const [direct] = await once(spawn(SharedMcpLauncherTests.NO_SUCH_PROGRAM, [], { windowsHide: true }), "error") as [Error];
    const host = new FakeLauncherHost();

    await new SharedMcpLauncher(process.platform, { ...process.env }, "node", "launch.js", host, SharedMcpLauncherTests.held())
      .runAsync(true, ["--variables", "", "--", SharedMcpLauncherTests.NO_SUCH_PROGRAM]);

    Assert.areEqual(JSON.stringify([[1], `${direct.message}\n`]), JSON.stringify([host.codes, host.errors]));
  }

  @TestMethod
  public async exitsWith1AndSaysWhatNodeSaysOutsideWindowsWhenTheHeldServersCommandHasNoExecuteBit(): Promise<void> {
    if (process.platform === "win32")
      return;
    using directory = new TemporaryDirectory();
    const command = directory.resolve("search-server");
    writeFileSync(command, "#!/bin/sh\n", { mode: 0o644 });
    const [direct] = await once(spawn(command, [], { windowsHide: true }), "error") as [Error];
    const host = new FakeLauncherHost();

    await new SharedMcpLauncher(process.platform, { ...process.env }, "node", "launch.js", host, SharedMcpLauncherTests.held())
      .runAsync(true, ["--variables", "", "--", command]);

    Assert.areEqual(JSON.stringify([[1], `${direct.message}\n`]), JSON.stringify([host.codes, host.errors]));
  }

  @TestMethod
  public async exitsWith1AndSaysWhatNodeSaysOutsideWindowsWhenTheHeldServersCommandIsAFolderOrAMissingPath(): Promise<void> {
    if (process.platform === "win32")
      return;
    using directory = new TemporaryDirectory();
    const folder = directory.resolve("search-server");
    mkdirSync(folder);
    for (const command of [folder, directory.resolve("no-such-server")]) {
      const [direct] = await once(spawn(command, [], { windowsHide: true }), "error") as [Error];
      const host = new FakeLauncherHost();

      await new SharedMcpLauncher(process.platform, { ...process.env }, "node", "launch.js", host, SharedMcpLauncherTests.held())
        .runAsync(true, ["--variables", "", "--", command]);

      Assert.areEqual(JSON.stringify([[1], `${direct.message}\n`]), JSON.stringify([host.codes, host.errors]));
    }
  }

  @TestMethod
  public async exitsWithTheServersOwn126OutsideWindowsWhenItsCommandCouldRun(): Promise<void> {
    if (process.platform === "win32")
      return;
    const host = new FakeLauncherHost();

    await new SharedMcpLauncher(process.platform, { ...process.env }, "node", "launch.js", host, SharedMcpLauncherTests.held())
      .runAsync(true, ["--variables", "", "--", "/bin/sh", "-c", "exit 126"]);

    Assert.areEqual(JSON.stringify([[126], ""]), JSON.stringify([host.codes, host.errors]));
  }

  @TestMethod
  public async exitsWithTheServersOwn127OutsideWindowsWhenItsCommandWasFound(): Promise<void> {
    if (process.platform === "win32")
      return;
    const host = new FakeLauncherHost();

    await new SharedMcpLauncher(process.platform, { ...process.env }, "node", "launch.js", host, SharedMcpLauncherTests.held())
      .runAsync(true, ["--variables", "", "--", "/bin/sh", "-c", "exit 127"]);

    Assert.areEqual(JSON.stringify([[127], ""]), JSON.stringify([host.codes, host.errors]));
  }

  @TestMethod
  public async endsOnWindowsWhatItsLauncherStartedAfterItWhenItsInputEndsWithoutTheServersLine(): Promise<void> {
    const host = new FakeLauncherHost();
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.exiting(0));

    const running = new SharedMcpLauncher("win32", {}, "node", "launch.js", host, recorder.start).runAsync(true, ["--watch"]);
    host.stdin.end();
    await running;

    const script = Buffer.from(String(recorder.starts[0]?.args[3]), "base64").toString("utf16le");
    Assert.areEqual(JSON.stringify([true, true, true, true, true, true, true]), JSON.stringify(["$ErrorActionPreference = 'Stop'; ", "$_.ProcessId -eq 5555 })", "$_.ProcessId -eq 6666 })",
      "$_.ParentProcessId -eq 6666 -and $_.ProcessId -ne 5555 -and $_.Created -ge $self[0].Created", "-and $_.Created -lt $by", "$tree[$root.ProcessId] = $root.Created",
      "Stop-Process -Id $_.ProcessId -Force"].map(t => script.includes(t))));
    Assert.areEqual(JSON.stringify([[], [0]]), JSON.stringify([host.signals, host.codes]));
  }

  @TestMethod
  public async endsTheServerAndWhatItStartedOnWindowsWhenItsLauncherDiedBeforeTellingItsWatch(): Promise<void> {
    if (process.platform !== "win32")
      return;
    using directory = new TemporaryDirectory();
    const ids = directory.resolve("ids.json");
    const launcher = spawn(process.execPath, ["-e", SharedMcpLauncherTests.LAUNCHER_SCRIPT, ids, SharedMcpLauncherTests.KEEP_SCRIPT, SharedMcpLauncherTests.SERVER_SCRIPT],
      { stdio: "ignore", windowsHide: true });
    await Wait.until(() => existsSync(ids), "The launcher did not write its process ids.");
    await Wait.until(() => existsSync(`${ids}.server`) && readFileSync(`${ids}.server`, "utf8").length > 0, "The server did not write its process ids.");
    const [watch = 0, server = 0] = JSON.parse(readFileSync(ids, "utf8")) as number[];
    const startedByServer = Number(readFileSync(`${ids}.server`, "utf8"));
    const died = once(launcher, "exit");
    launcher.kill();
    await died;
    const host = new FakeLauncherHost();
    host.pid = watch;
    host.ppid = Number(launcher.pid);

    try {
      const running = new SharedMcpLauncher("win32", { ...process.env }, "node", "launch.js", host).runAsync(true, ["--watch"]);
      host.stdin.end();
      await running;
      await Wait.until(() => !SharedMcpLauncherTests.runs(server), "The server process still ran.");
      await Wait.until(() => !SharedMcpLauncherTests.runs(startedByServer), "The process the server started still ran.");

      Assert.isTrue(SharedMcpLauncherTests.runs(watch));
    }
    finally {
      for (const id of [watch, server, startedByServer].filter(t => SharedMcpLauncherTests.runs(t)))
        process.kill(id);
    }
  }

  @TestMethod
  public async findsItsVariablesInAnyCaseOnWindowsAndForwardsASignalToTheServerItselfUntilItEnds(): Promise<void> {
    const host = new FakeLauncherHost();
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.exiting(0), SharedMcpLauncherTests.exiting(0));
    const environment = { Path: "C:\\Windows", SystemRoot: "C:\\Windows", TEAMRUN_SENDER_TOKEN: "sender", search_key: "s1" };

    const running = new SharedMcpLauncher("win32", environment, "C:\\TeamRun\\TeamRun.exe", "C:\\TeamRun\\launch.js", host, recorder.start,
      t => t === path.join("C:\\tools\\server.exe")).runAsync(true, ["--variables", "SEARCH_KEY", "--", "C:\\tools\\server.exe", "--stdio"]);
    host.emit("SIGTERM", "SIGTERM");
    await running;

    Assert.areEqual(JSON.stringify([0]), JSON.stringify(host.codes));
    Assert.areEqual(JSON.stringify(["pipe", "ignore", "inherit"]), JSON.stringify(recorder.starts[0]?.options.stdio));
    Assert.areEqual(JSON.stringify({ command: path.join("C:\\tools\\server.exe"), args: ["--stdio"], options: { env: { Path: "C:\\Windows", SystemRoot: "C:\\Windows",
      search_key: "s1" }, stdio: "inherit", windowsHide: true, windowsVerbatimArguments: false, detached: false } }), JSON.stringify(recorder.starts[1]));
    Assert.areEqual(JSON.stringify([[recorder.children[1]?.pid, "SIGTERM"]]), JSON.stringify(host.signals));
    Assert.areEqual(0, SharedMcpLauncher.forwardedSignals.reduce((total, t) => total + host.listenerCount(t), 0));
  }

  @TestMethod
  public async exitsWith128AndTheSignalsNumberWhenASignalEndsTheServer(): Promise<void> {
    const host = new FakeLauncherHost();
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.exiting(0), SharedMcpLauncherTests.waiting());

    const running = new SharedMcpLauncher("linux", {}, "node", "launch.js", host, recorder.start).runAsync(true, ["--variables", "", "--", "server"]);
    recorder.children[1]?.kill("SIGTERM");
    await running;

    Assert.areEqual(JSON.stringify([128 + constants.signals.SIGTERM]), JSON.stringify(host.codes));
  }

  @TestMethod
  public async exitsWith1AndSaysWhyWhenTheServerCannotStartAndEndsItsWatchsInputWithNoId(): Promise<void> {
    const host = new FakeLauncherHost();
    const input = new PassThrough();
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.watching(input), SharedMcpLauncherTests.failing());

    await new SharedMcpLauncher("linux", {}, "node", "launch.js", host, recorder.start).runAsync(true, ["--variables", "", "--", SharedMcpLauncherTests.NO_SUCH_PROGRAM]);

    Assert.areEqual(JSON.stringify([[1], 2, true, true, null, 0]), JSON.stringify([host.codes, recorder.starts.length, host.errors.includes("ENOENT"),
      input.writableEnded, input.read(), SharedMcpLauncher.forwardedSignals.reduce((total, t) => total + host.listenerCount(t), 0)]));
  }

  @TestMethod
  public async runsTheServerEvenWhenItsWatchCannotStart(): Promise<void> {
    const host = new FakeLauncherHost();
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.failing(), SharedMcpLauncherTests.exiting(0));

    await new SharedMcpLauncher("linux", {}, "node", "launch.js", host, recorder.start).runAsync(true, ["--variables", "", "--", "server"]);

    Assert.areEqual(JSON.stringify([[0], 2]), JSON.stringify([host.codes, recorder.starts.length]));
  }

  @TestMethod
  public async runsTheServerOnWhenItsWatchsInputFails(): Promise<void> {
    const host = new FakeLauncherHost();
    const input = new PassThrough();
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.watching(input), SharedMcpLauncherTests.exiting(0));

    const running = new SharedMcpLauncher("linux", {}, "node", "launch.js", host, recorder.start).runAsync(true, ["--variables", "", "--", "server"]);
    input.destroy(new Error("write EPIPE"));
    await running;

    Assert.areEqual(JSON.stringify([[0], true]), JSON.stringify([host.codes, input.destroyed]));
  }

  @TestMethod
  public async startsTheServerItselfWithItsOwnStarterAndExitsWithItsCode(): Promise<void> {
    const host = new FakeLauncherHost();

    await new SharedMcpLauncher(process.platform, { ...process.env }, process.execPath, SharedMcpLauncherTests.VERSION_OPTION, host)
      .runAsync(true, ["--variables", "", "--", process.execPath, "-e", "process.exit(7)"]);

    Assert.areEqual(JSON.stringify([7]), JSON.stringify(host.codes));
  }

  @TestMethod
  public async endsTheServersGroupOnceItsInputEndsOutsideWindowsWithSigkillAfterTheGrace(): Promise<void> {
    const host = new FakeLauncherHost();
    const delays: number[] = [];
    const launcher = new SharedMcpLauncher("linux", {}, "node", "launch.js", host, SharedMcpLauncherTests.recorder().start, undefined, async t => {
      delays.push(t);
    });

    const running = launcher.runAsync(true, ["--watch"]);
    const before = host.signals.length;
    host.stdin.end(SharedMcpLauncherTests.HANDED);
    await running;

    Assert.areEqual(JSON.stringify([0, [[-4321, "SIGTERM"], [-4321, "SIGKILL"]], [SharedMcpLauncher.graceMilliseconds], [0]]),
      JSON.stringify([before, host.signals, delays, host.codes]));
  }

  @TestMethod
  public async sendsNoSigkillOutsideWindowsWhenTheGroupIsAlreadyGoneOrItsInputFails(): Promise<void> {
    const host = new FakeLauncherHost();
    host.refusing = true;
    const delays: number[] = [];
    const launcher = new SharedMcpLauncher("linux", {}, "node", "launch.js", host, SharedMcpLauncherTests.recorder().start, undefined, async t => {
      delays.push(t);
    });

    const running = launcher.runAsync(true, ["--watch"]);
    const arrived = new Promise<void>(resolve => host.stdin.once("data", () => resolve()));
    host.stdin.write(SharedMcpLauncherTests.HANDED);
    await arrived;
    host.stdin.destroy(new Error("Gone."));
    await running;

    Assert.areEqual(JSON.stringify([[[-4321, "SIGTERM"]], [], [0]]), JSON.stringify([host.signals, delays, host.codes]));
  }

  @TestMethod
  public async endsNothingWhenItsInputEndsWithoutAWholeLineOfTheServersId(): Promise<void> {
    const outcomes: unknown[] = [];

    for (const text of ["", "4321", "4321 1700000000000 1700000000005\n", "0\n", "x\n"]) {
      for (const platform of ["linux", "win32"]) {
        const host = new FakeLauncherHost();
        const recorder = SharedMcpLauncherTests.recorder();
        const running = new SharedMcpLauncher(platform, {}, "node", "launch.js", host, recorder.start).runAsync(true, ["--watch"]);
        host.stdin.end(text);
        await running;
        outcomes.push([platform, host.signals, recorder.starts.map(t => t.command), host.codes]);
      }
    }

    Assert.areEqual(JSON.stringify(Array.from({ length: 5 }, () => [["linux", [], [], [0]], ["win32", [], ["powershell.exe"], [0]]]).flat()), JSON.stringify(outcomes));
  }

  @TestMethod
  public async waitsOutTheGraceWithItsOwnTimer(): Promise<void> {
    const host = new FakeLauncherHost();
    const started = Date.now();

    const running = new SharedMcpLauncher("linux", {}, "node", "launch.js", host).runAsync(true, ["--watch"]);
    host.stdin.end(SharedMcpLauncherTests.HANDED);
    await running;

    Assert.isTrue(Date.now() - started >= SharedMcpLauncher.graceMilliseconds - 50);
    Assert.areEqual(JSON.stringify([[[-4321, "SIGTERM"], [-4321, "SIGKILL"]], [0]]), JSON.stringify([host.signals, host.codes]));
  }

  @TestMethod
  public async endsTheServerAndEachProcessUnderItThatStartedAfterTheWatchByTheKernelsTimesOnWindows(): Promise<void> {
    const host = new FakeLauncherHost();
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.exiting(0));
    const environment = { SystemRoot: "C:\\Windows" };

    const running = new SharedMcpLauncher("win32", environment, "node", "launch.js", host, recorder.start).runAsync(true, ["--watch"]);
    host.stdin.end(SharedMcpLauncherTests.HANDED);
    await running;

    const [powershell] = recorder.starts;
    const script = Buffer.from(String(powershell?.args[3]), "base64").toString("utf16le");
    Assert.areEqual(JSON.stringify(["powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand"], { env: environment, stdio: "ignore", windowsHide: true }]),
      JSON.stringify([powershell?.command, powershell?.args.slice(0, 3), powershell?.options]));
    Assert.areEqual(JSON.stringify([true, true, true, true, true, true, true, true, false, false]), JSON.stringify(["$ErrorActionPreference = 'Stop'; ",
      "Created = $_.CreationDate.ToUniversalTime()", "$self = @($all | Where-Object { $_.ProcessId -eq 5555 }); if ($self.Count -eq 0) { exit 3 }; ",
      "$ours = $true -and $holder.Count -gt 0 -and $holder[0].Created -ge $self[0].Created -and $holder[0].ParentProcessId -eq $self[0].ParentProcessId; ",
      "$_.ParentProcessId -eq 4321 -and $_.Created -ge $self[0].Created -and $_.Created -lt $before", "$_.Created -ge $tree[$_.ParentProcessId]",
      "if ($ending.Count -eq 0) { exit 4 }; ", "Stop-Process -Id $_.ProcessId -Force", "FromUnixTimeMilliseconds", "LocalDateTime"].map(t => script.includes(t))));
    Assert.areEqual(JSON.stringify([[], [0]]), JSON.stringify([host.signals, host.codes]));
  }

  @TestMethod
  public async endsOnlyWhatTheServerStartedWhenAProcessTheLauncherDidNotStartHoldsItsIdOnWindows(): Promise<void> {
    const host = new FakeLauncherHost();
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.exiting(0));

    const running = new SharedMcpLauncher("win32", {}, "node", "launch.js", host, recorder.start).runAsync(true, ["--watch"]);
    host.stdin.end(SharedMcpLauncherTests.HANDED);
    await running;

    const script = Buffer.from(String(recorder.starts[0]?.args[3]), "base64").toString("utf16le");
    Assert.areEqual(JSON.stringify([true, true, true]), JSON.stringify(["-and $holder[0].ParentProcessId -eq $self[0].ParentProcessId; ",
      "$before = if ($holder.Count -gt 0 -and -not $ours) { $holder[0].Created } else { [DateTime]::MaxValue }; ",
      "$ending = @(if ($ours) { $holder } else { $all | Where-Object { $_.ParentProcessId -eq 4321 -and $_.Created -ge $self[0].Created -and $_.Created -lt $before } }); "]
      .map(t => script.includes(t))));
  }

  @TestMethod
  public async endsOnlyWhatTheServerStartedBeforeAnotherProcessTookItsIdOnceItExitedOnWindows(): Promise<void> {
    const host = new FakeLauncherHost();
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.exiting(0));

    const running = new SharedMcpLauncher("win32", {}, "node", "launch.js", host, recorder.start).runAsync(true, ["--watch"]);
    host.stdin.end(SharedMcpLauncherTests.EXITED);
    await running;

    const script = Buffer.from(String(recorder.starts[0]?.args[3]), "base64").toString("utf16le");
    Assert.areEqual(JSON.stringify([true, true, [0], ""]), JSON.stringify([...["$ours = $false -and $holder.Count -gt 0",
      "$before = if ($holder.Count -gt 0 -and -not $ours) { $holder[0].Created } else { [DateTime]::MaxValue }; "].map(t => script.includes(t)), host.codes, host.errors]));
  }

  @TestMethod
  @TestData("4321\n", 0, "")
  @TestData("4321\n", 1, "TeamRun's MCP watch: PowerShell 1 of 2 exited with 1 after 5 ms.\n")
  @TestData("4321\n", 3, "TeamRun's MCP watch: PowerShell 1 of 2 exited with 3 after 5 ms.\n")
  @TestData("4321\n", 4, "TeamRun's MCP watch: its launcher ended before server 4321, and PowerShell found nothing of it to end.\n")
  @TestData("4321\nexited\n", 4, "")
  @TestData("4321\nexited\n", 1, "TeamRun's MCP watch: PowerShell 1 of 2 exited with 1 after 5 ms.\n")
  public async writesALineOnWindowsWhenPowershellFailsOrALauncherKilledBeforeItsServerLeavesNothingToEnd(input: string, code: number, written: string): Promise<void> {
    const host = new FakeLauncherHost();
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.exiting(code));

    const running = new SharedMcpLauncher("win32", {}, "node", "launch.js", host, recorder.start, undefined, undefined, SharedMcpLauncherTests.clock(0, 5))
      .runAsync(true, ["--watch"]);
    host.stdin.end(input);
    await running;

    Assert.areEqual(JSON.stringify([[0], 1, written]), JSON.stringify([host.codes, recorder.starts.length, host.errors]));
  }

  @TestMethod
  public async endsAPowershellThatDoesntAnswerWithinItsLimitOnWindowsAndListsOnceMoreInANewOne(): Promise<void> {
    const host = new FakeLauncherHost();
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.waiting(), SharedMcpLauncherTests.exiting(0));
    const limits: number[] = [];
    const delayAsync = async (milliseconds: number, signal?: AbortSignal): Promise<void> => {
      limits.push(milliseconds);
      if (limits.length > 1)
        await new Promise((_, reject) => signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    };

    const running = new SharedMcpLauncher("win32", {}, "node", "launch.js", host, recorder.start, undefined, delayAsync,
      SharedMcpLauncherTests.clock(0, 10_000, 10_000, 10_400)).runAsync(true, ["--watch"]);
    host.stdin.end(SharedMcpLauncherTests.HANDED);
    await running;
    const [stalled, second] = recorder.starts;

    Assert.areEqual(JSON.stringify([2, "powershell.exe", true, [SharedMcpLauncher.powershellAnswerMilliseconds,
      SharedMcpLauncher.windowsEndMilliseconds - SharedMcpLauncher.powershellAnswerMilliseconds], [true, false], [0],
    "TeamRun's MCP watch: PowerShell 1 of 2 didn't end and was ended after 10000 ms.\n"]),
    JSON.stringify([recorder.starts.length, second?.command, second?.args[3] === stalled?.args[3], limits, recorder.children.map(t => t.killed), host.codes,
      host.errors]));
  }

  @TestMethod
  public async endsTheRetrysPowershellTooWhenItDoesntAnswerWithinTheRestOfTheEndsTimeOnWindows(): Promise<void> {
    const host = new FakeLauncherHost();
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.waiting(), SharedMcpLauncherTests.waiting());
    const limits: number[] = [];
    const delayAsync = async (milliseconds: number): Promise<void> => {
      limits.push(milliseconds);
    };

    const running = new SharedMcpLauncher("win32", {}, "node", "launch.js", host, recorder.start, undefined, delayAsync,
      SharedMcpLauncherTests.clock(0, 10_000, 10_000, 20_000)).runAsync(true, ["--watch"]);
    host.stdin.end(SharedMcpLauncherTests.HANDED);
    await running;

    Assert.areEqual(JSON.stringify([2, SharedMcpLauncher.windowsEndMilliseconds, [true, true], [0],
      "TeamRun's MCP watch: PowerShell 1 of 2 didn't end and was ended after 10000 ms.\nTeamRun's MCP watch: PowerShell 2 of 2 didn't end and was ended after 10000 ms.\n"]),
    JSON.stringify([recorder.starts.length, limits.reduce((total, t) => total + t, 0), recorder.children.map(t => t.killed), host.codes, host.errors]));
  }

  @TestMethod
  public async endsBothPowershellsWithinTheEndsTimeOnWindowsWhenItsErrorsCantBeWritten(): Promise<void> {
    const host = new FakeLauncherHost();
    Object.defineProperty(host, "stderr", { value: new Writable({ write: (_chunk, _encoding, done) => done(new Error("write EPIPE")) }) });
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.waiting(), SharedMcpLauncherTests.waiting());
    const limits: number[] = [];
    const delayAsync = async (milliseconds: number): Promise<void> => {
      limits.push(milliseconds);
    };

    const running = new SharedMcpLauncher("win32", {}, "node", "launch.js", host, recorder.start, undefined, delayAsync).runAsync(true, ["--watch"]);
    host.stdin.end(SharedMcpLauncherTests.HANDED);
    await running;

    Assert.areEqual(JSON.stringify([2, SharedMcpLauncher.windowsEndMilliseconds, [true, true], [0]]),
      JSON.stringify([recorder.starts.length, limits.reduce((total, t) => total + t, 0), recorder.children.map(t => t.killed), host.codes]));
  }

  @TestMethod
  @TestData(2000, "")
  @TestData(2001, "TeamRun's MCP watch: PowerShell 1 of 2 ended after 2001 ms.\n")
  public async writesAPowershellsTimeOnWindowsOnlyWhenItTakesOverTwoSeconds(elapsed: number, written: string): Promise<void> {
    const host = new FakeLauncherHost();
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.exiting(0));

    const running = new SharedMcpLauncher("win32", {}, "node", "launch.js", host, recorder.start, undefined, undefined, SharedMcpLauncherTests.clock(0, elapsed))
      .runAsync(true, ["--watch"]);
    host.stdin.end(SharedMcpLauncherTests.HANDED);
    await running;

    Assert.areEqual(JSON.stringify([[0], 1, written]), JSON.stringify([host.codes, recorder.starts.length, host.errors]));
  }

  @TestMethod
  public async exitsOnWindowsEvenWhenPowerShellCannotStart(): Promise<void> {
    const host = new FakeLauncherHost();
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.failing());

    const running = new SharedMcpLauncher("win32", {}, "node", "launch.js", host, recorder.start, undefined, undefined, SharedMcpLauncherTests.clock(0, 5))
      .runAsync(true, ["--watch"]);
    host.stdin.end(SharedMcpLauncherTests.HANDED);
    await running;

    Assert.areEqual(JSON.stringify([[0], 1, "TeamRun's MCP watch: PowerShell 1 of 2 failed to start after 5 ms.\n"]),
      JSON.stringify([host.codes, recorder.starts.length, host.errors]));
  }

  @TestMethod
  public startsACommandAsItIsOutsideWindows(): void {
    const launcher = new SharedMcpLauncher("darwin", {}, "node", "launch.js", new FakeLauncherHost());

    Assert.areEqual(JSON.stringify({ command: "tool.cmd", args: ["a b"], verbatim: false }), JSON.stringify(launcher.commandOf("tool.cmd", ["a b"], {})));
  }

  @TestMethod
  public findsACommandThroughPathAndTheUsualExtensionsOnWindows(): void {
    const found = `${path.join("C:\\b", "server")}.EXE`;
    const launcher = new SharedMcpLauncher("win32", {}, "node", "launch.js", new FakeLauncherHost(), undefined, t => t === found);

    Assert.areEqual(JSON.stringify([{ command: found, args: ["--stdio"], verbatim: false }, { command: "missing", args: [], verbatim: false }]),
      JSON.stringify([launcher.commandOf("server", ["--stdio"], { Path: "C:\\a;;C:\\b" }), launcher.commandOf("missing", [], {})]));
  }

  @TestMethod
  public runsABatchFileThroughCmdWithEachArgumentQuotedAndEscapedTwiceSinceItReadsThemAgain(): void {
    const located = path.join("C:\\bin", "tool.cmd");
    const launcher = new SharedMcpLauncher("win32", {}, "node", "launch.js", new FakeLauncherHost(), undefined, t => t === located);

    const command = launcher.commandOf("tool.cmd", ["a b", "a\"b", "&calc", "50%", "back\\"], { PATHEXT: ".EXE;.CMD", PATH: "C:\\bin" });

    Assert.areEqual(JSON.stringify({ command: "cmd.exe", args: ["/d", "/s", "/c",
      `"${located} ^^^"a^^^ b^^^" ^^^"a\\^^^"b^^^" ^^^"^^^&calc^^^" ^^^"50^^^%^^^" ^^^"back\\\\^^^""`], verbatim: true }), JSON.stringify(command));
  }

  @TestMethod
  public runsAnNpmShimThroughComSpecWithItsArgumentsEscapedTwice(): void {
    const located = `${path.join("C:\\p\\node_modules\\.bin\\tool")}.CMD`;
    const launcher = new SharedMcpLauncher("win32", {}, "node", "launch.js", new FakeLauncherHost(), undefined, t => t === located);

    const command = launcher.commandOf("C:\\p\\node_modules\\.bin\\tool", ["x&y"], { ComSpec: "C:\\Windows\\system32\\cmd.exe", PATHEXT: ".CMD" });

    Assert.areEqual(JSON.stringify({ command: "C:\\Windows\\system32\\cmd.exe", args: ["/d", "/s", "/c", `"${located} ^^^"x^^^&y^^^""`], verbatim: true }),
      JSON.stringify(command));
  }

  @TestMethod
  public givesEachSetCertificateVariableMadeAbsoluteAndNeverTheSenderTokenEvenWhenNamed(): void {
    const posix = new SharedMcpLauncher("linux", { PATH: "/usr/bin", SSL_CERT_FILE: "certs/ca.pem", NODE_EXTRA_CA_CERTS: "/etc/ca.pem", PIP_CERT: "",
      CURL_CA_BUNDLE: "", SSL_CERT_DIR: "/etc/certs", TEAMRUN_SENDER_TOKEN: "sender", teamrun_sender_token: "lower" }, "node", "launch.js", new FakeLauncherHost());
    const windows = new SharedMcpLauncher("win32", { Path: "C:\\Windows", ssl_cert_file: "C:\\certs\\ca.pem", npm_config_cafile: "npm.pem",
      Teamrun_Sender_Token: "sender" }, "node", "launch.js", new FakeLauncherHost());

    Assert.areEqual(JSON.stringify([{ PATH: "/usr/bin", PIP_CERT: "", SSL_CERT_FILE: path.resolve("certs/ca.pem"), NODE_EXTRA_CA_CERTS: path.resolve("/etc/ca.pem") },
      { Path: "C:\\Windows", SSL_CERT_FILE: path.resolve("C:\\certs\\ca.pem"), NPM_CONFIG_CAFILE: path.resolve("npm.pem") }]),
    JSON.stringify([posix.environmentOf(["PIP_CERT", "TEAMRUN_SENDER_TOKEN", "teamrun_sender_token"]), windows.environmentOf(["SSL_CERT_FILE", "TEAMRUN_SENDER_TOKEN"])]));
    Assert.areEqual(JSON.stringify([true, true, false]), JSON.stringify([SharedMcpLauncher.withheldVariables.includes(ProtocolResources.senderTokenVariable),
      SharedMcpLauncher.withholds("Teamrun_Sender_Token"), SharedMcpLauncher.withholds("TEAMRUN_SENDER")]));
  }

  @TestMethod
  public findsOnlyFilesWithItsOwnCheck(): void {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve("tool.EXE"));
    writeFileSync(directory.resolve("tool.cmd"), "@echo off\r\n");
    const launcher = new SharedMcpLauncher("win32", {}, "node", "launch.js", new FakeLauncherHost());

    const command = launcher.commandOf("tool", [], { PATH: directory.path, PATHEXT: ".EXE;.cmd" });

    Assert.areEqual(JSON.stringify(["cmd.exe", true, true]), JSON.stringify([command.command, command.verbatim, String(command.args[3]).includes("tool.cmd")]));
  }

  private static async listeningAtStartAsync(platform: string, environment: Readonly<Record<string, string>>, program: string, script: string,
    isFile: (file: string) => boolean, command: string): Promise<number[]> {
    const host = new FakeLauncherHost();
    const server = SharedMcpLauncherTests.exiting(0);
    let listening: number[] = [];
    const recorder = SharedMcpLauncherTests.recorder(SharedMcpLauncherTests.exiting(0), () => {
      listening = SharedMcpLauncher.forwardedSignals.map(t => host.listenerCount(t));
      return server();
    });
    await new SharedMcpLauncher(platform, environment, program, script, host, recorder.start, isFile).runAsync(true, ["--variables", "", "--", command]);
    return listening;
  }

  private static recorder(...makers: (() => ChildProcess)[]): { starts: { command: string; args: readonly string[]; options: SpawnOptions }[]; children: ChildProcess[];
    start: (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess; } {
    const starts: { command: string; args: readonly string[]; options: SpawnOptions }[] = [];
    const children: ChildProcess[] = [];
    const start = (command: string, args: readonly string[], options: SpawnOptions): ChildProcess => {
      starts.push({ command, args, options });
      const child = (makers[starts.length - 1] ?? SharedMcpLauncherTests.exiting(0))();
      children.push(child);
      return child;
    };
    return { starts, children, start };
  }

  private static exiting(code: number): () => ChildProcess {
    return () => spawn(process.execPath, ["-e", SharedMcpLauncherTests.EXIT_SCRIPT, String(code)], { stdio: "ignore", windowsHide: true });
  }

  private static watching(input: PassThrough): () => ChildProcess {
    return () => {
      const child = new ChildProcess();
      child.stdin = input;
      return child;
    };
  }

  private static clock(...times: number[]): () => number {
    return () => times.shift() ?? 0;
  }

  private static waiting(): () => ChildProcess {
    return () => spawn(process.execPath, ["-e", SharedMcpLauncherTests.INPUT_SCRIPT], { stdio: ["pipe", "ignore", "ignore"], windowsHide: true });
  }

  private static holding(release: Writable, code: number = 0): () => ChildProcess {
    return () => {
      const child = new ChildProcess();
      Object.defineProperties(child, { pid: { value: 4321 }, stdio: { value: [null, null, null, release] } });
      release.once("close", () => child.emit("exit", code, null));
      return child;
    };
  }

  private static held(): (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess {
    return (command, args, options) => args.includes(SharedMcpLauncher.watchOption) ? SharedMcpLauncherTests.watching(new PassThrough())()
      : spawn(command, args, { ...options, stdio: ["ignore", "ignore", "ignore", "pipe"] });
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

  private static failing(): () => ChildProcess {
    return () => spawn(SharedMcpLauncherTests.NO_SUCH_PROGRAM, [], { windowsHide: true });
  }
}
