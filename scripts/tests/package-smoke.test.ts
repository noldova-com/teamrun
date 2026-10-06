/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { ChildProcess, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import PackageSmoke from "../package-smoke.ts";
import ProcessResult from "../processes/process-result.ts";
import StartedProcess from "../processes/started-process.ts";
import InstallRunnerFixture from "./fixtures/install-runner.fixture.ts";
import ProductIdentityFixture from "./fixtures/product-identity.fixture.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TemporaryFolderFixture from "./fixtures/temporary-folder.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

type Answer = "none" | "running" | "failed" | "other version" | "unreadable";
type Discovery = "written" | "missing" | "unreadable";
type Killing = "ends" | "refused" | "ignored";

class DesktopFixture extends StartedProcess {
  private readonly quitCode: number | null;
  private readonly earlyExitCode: number | null;
  private isClosed: boolean;

  public readonly signals: string[] = [];

  public constructor(quitCode: number | null, earlyExitCode: number | null) {
    super(new ChildProcess());

    this.quitCode = quitCode;
    this.earlyExitCode = earlyExitCode;
    this.isClosed = earlyExitCode !== null;
  }

  public override get id(): number {
    return 4242;
  }

  public override get hasExited(): boolean {
    return this.isClosed;
  }

  public override get exitCode(): number | null {
    return this.earlyExitCode ?? this.quitCode;
  }

  public override async waitAsync(): Promise<boolean> {
    return this.isClosed;
  }

  public override signal(name: NodeJS.Signals): void {
    this.signals.push(name);
    this.close();
  }

  public close(): void {
    this.isClosed = this.quitCode !== null;
  }
}

class SmokeRunnerFixture extends InstallRunnerFixture {
  private readonly answers: Answer[];

  public readonly desktop: DesktopFixture;
  public readonly environments: (NodeJS.ProcessEnv | undefined)[] = [];
  public readonly starts: (readonly string[])[] = [];
  public readonly checked: number[] = [];
  public readonly killed: number[] = [];
  public runtimeChecks: number = 1;
  public discovery: Discovery = "written";
  public killing: Killing = "ends";
  public powerShell: Answer = "running";

  public constructor(answers: readonly Answer[], desktop: DesktopFixture = new DesktopFixture(0, null), failing: readonly string[] = []) {
    super(failing);

    this.answers = [...answers];
    this.desktop = desktop;
  }

  public get statuses(): number {
    return this.calls.filter(t => t.includes("status")).length;
  }

  public override async captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number, environment?: NodeJS.ProcessEnv): Promise<ProcessResult> {
    const result = await super.captureAsync(command, commandArguments, directory, timeout);
    if (commandArguments.includes("status")) {
      this.environments.push(environment);
      return this.answer(String(commandArguments.at(-1)));
    }
    if (path.basename(command) === "pwsh") {
      this.environments.push(environment);
      return SmokeRunnerFixture.describe(this.powerShell, /'(.+)';/.exec(String(commandArguments.at(-1)))?.[1] ?? "");
    }
    if (result.isSuccessful && path.basename(command) === "taskkill")
      this.desktop.close();
    return result;
  }

  public override isRunning(processId: number): boolean {
    this.checked.push(processId);
    return this.runtimeChecks-- > 0;
  }

  public override kill(processId: number): void {
    this.killed.push(processId);
    if (this.killing === "refused")
      throw new Error(`EPERM: operation not permitted, kill ${processId}`);
    if (this.killing === "ends")
      this.runtimeChecks = 0;
  }

  public override async startAsync(command: string, commandArguments: readonly string[], directory: string, log: string): Promise<StartedProcess> {
    this.starts.push([command.startsWith(directory) ? path.relative(directory, command) : command, ...commandArguments]);
    await writeFile(log, "The desktop's log.\n");
    return this.desktop;
  }

  private answer(data: string): ProcessResult {
    const answer = this.answers.length > 1 ? this.answers.shift() : this.answers[0];
    if ((answer === "running" || answer === "other version") && this.discovery === "written") {
      mkdirSync(path.join(data, "discovery"), { recursive: true });
      writeFileSync(path.join(data, "discovery", "runtime.json"), JSON.stringify({ processId: 5151 }));
    }
    if (this.discovery === "unreadable")
      mkdirSync(path.join(data, "discovery", "runtime.json"), { recursive: true });
    return SmokeRunnerFixture.describe(answer, data);
  }

  private static describe(answer: Answer | undefined, data: string): ProcessResult {
    switch (answer) {
      case "running":
        return new ProcessResult(0, JSON.stringify({ build: { productVersion: "0.0.7" }, dataDirectory: data }), "");
      case "other version":
        return new ProcessResult(0, JSON.stringify({ build: { productVersion: "0.0.6" }, dataDirectory: data }), "");
      case "unreadable":
        return new ProcessResult(0, "{\"build\":", "");
      case "failed":
        return new ProcessResult(1, "", "The runtime could not start.");
      default:
        return new ProcessResult(3, "", "No runtime is running.");
    }
  }
}

class UnstartableRunnerFixture extends SmokeRunnerFixture {
  public override async startAsync(): Promise<StartedProcess> {
    throw new RangeError("The fixture broke.");
  }
}

class PackageSmokeTests {
  private static readonly USAGE: string = "Usage: npm run package:smoke\n";
  private static readonly TIMEOUT: number = 30_000;
  private static readonly TICK: number = 100;
  private static readonly STATUS: readonly string[] = ["status", "--json", "--data-dir", "data"];
  private static readonly CLI: string = path.join("app.asar", "node_modules", "@noldova", "teamrun-shell-cli", "services", "cli-entry.js");

  public static register(): void {
    test("on Linux the AppImage is unpacked, the desktop starts from the AppImage and the command line from the unpacked program, and the runtime is left to stop on its own",
      { timeout: PackageSmokeTests.TIMEOUT }, async t => {
        const repository = await PackageSmokeTests.createAsync(t, "Fixture Studio-linux-x64.AppImage");
        const runner = new SmokeRunnerFixture(["none", "none", "failed", "running", "none"]);
        const output = new TextOutputFixture();
        const temporaryFolder = new TemporaryFolderFixture(repository.directory);

        const exitCode = await PackageSmokeTests.runAsync(t, repository, "linux", runner, output, "x64", {}, temporaryFolder);

        const appImage = path.join(repository.directory, "_build", "package", "out", "Fixture Studio-linux-x64.AppImage");
        const status = ["fixture-studio", path.join("squashfs-root", "resources", PackageSmokeTests.CLI), ...PackageSmokeTests.STATUS];
        assert.equal(exitCode, 0, output.text);
        assert.deepEqual(runner.calls, [["Fixture Studio-linux-x64.AppImage", "--appimage-extract"], status, status, status, status, status]);
        assert.deepEqual(runner.starts, [[appImage, `--data-dir=${path.join(runner.folder, "data")}`]]);
        assert.deepEqual(runner.environments.map(t => [t?.["ELECTRON_RUN_AS_NODE"], t?.["PATH"]]), [1, 2, 3, 4, 5].map(() => ["1", "fixture-path"]));
        assert.deepEqual(runner.desktop.signals, ["SIGTERM"]);
        assert.deepEqual(temporaryFolder.platforms, ["linux"]);
        assert.deepEqual([runner.checked, runner.killed], [[5151, 5151], []]);
        const lines = output.text.split("\n");
        assert.match(lines[0] ?? "", /^Installed in \d+\.\d s: /);
        assert.equal([lines[0]?.slice(lines[0].indexOf(": ") + 2), ...lines.slice(1)].join("\n"), [
          appImage,
          "teamrun status before the start: no runtime.",
          `teamrun status after the start: version 0.0.7 in ${path.join(runner.folder, "data")}.`,
          "The desktop quit.",
          "The runtime stopped once idle.",
          ""
        ].join("\n"));
        assert.equal(existsSync(runner.folder), false);
      });

    test("on Windows the installer installs silently for the user and adds its command to the user's Path, the command line answers through cmd and PowerShell, the desktop is closed through its window, and installing again and uninstalling keep the Path right",
      { timeout: PackageSmokeTests.TIMEOUT }, async t => {
        const repository = await PackageSmokeTests.createAsync(t, "Fixture Studio-windows-x64.exe");
        const runner = new SmokeRunnerFixture(["none", "running", "none"]);
        const output = new TextOutputFixture();
        runner.localAppData = path.join(repository.directory, "local");
        runner.userPath = "C:\\Tools";
        const temporaryFolder = new TemporaryFolderFixture(repository.directory);

        const exitCode = await PackageSmokeTests.runAsync(t, repository, "win32", runner, output, "x64", {}, temporaryFolder);

        const installFolder = path.join(repository.directory, "local", "Programs", "fixture-studio");
        const program = path.join(installFolder, "Fixture Studio.exe");
        const bin = path.join(installFolder, "bin");
        const data = path.join(runner.folder, "data");
        const registry = ["reg.exe", "query", "HKCU\\Environment", "/v", "Path"];
        const status = ["cmd.exe", "/d", "/c", "fixture-studio", ...PackageSmokeTests.STATUS];
        const powerShell = ["pwsh", "-NoProfile", "-NonInteractive", "-Command", `& fixture-studio status --json --data-dir '${data}'; exit $LASTEXITCODE`];
        assert.equal(exitCode, 0, output.text);
        assert.deepEqual(runner.calls, [
          registry,
          ["Fixture Studio-windows-x64.exe", "/S"],
          registry,
          status,
          status,
          powerShell,
          ["taskkill", "/PID", "4242"],
          status,
          ["Fixture Studio-windows-x64.exe", "/S"],
          registry,
          ["Uninstall Fixture Studio.exe", "/S", `_?=${installFolder}`],
          registry
        ]);
        assert.deepEqual(runner.environments.map(t => t?.["PATH"]), [1, 2, 3, 4].map(() => `${bin};fixture-path`));
        assert.deepEqual(temporaryFolder.platforms, ["win32"]);
        assert.deepEqual(runner.starts, [[program, `--data-dir=${data}`]]);
        assert.deepEqual(runner.desktop.signals, []);
        assert.equal(runner.userPath, "C:\\Tools");
        const lines = output.text.split("\n");
        assert.match(lines[0] ?? "", /^Installed in \d+\.\d s: /);
        assert.equal(lines[0]?.slice(lines[0].indexOf(": ") + 2), program);
        assert.deepEqual(lines.slice(1), [
          `The user's Path holds ${bin} once.`,
          "teamrun status before the start: no runtime.",
          `teamrun status after the start: version 0.0.7 in ${data}.`,
          `teamrun status through PowerShell: version 0.0.7 in ${data}.`,
          "The desktop quit.",
          "The runtime stopped once idle.",
          `Installed again over itself, the user's Path still holds ${bin} once.`,
          "Uninstalled: the program and its command are gone, and the user's Path is as it was before the install.",
          ""
        ]);
      });

    test("on Windows a Path that cannot be read, a command missing from it or on it twice, a PowerShell answer that fails or a Path the uninstall leaves changed fails the smoke check",
      { timeout: PackageSmokeTests.TIMEOUT }, async t => {
        const repository = await PackageSmokeTests.createAsync(t, "Fixture Studio-windows-x64.exe");
        const bin = path.join(repository.directory, "local", "Programs", "fixture-studio", "bin");
        const cases: readonly Partial<SmokeRunnerFixture>[] = [
          { registryAnswers: false },
          { pathEntries: 0 },
          { pathEntries: 2 },
          { powerShell: "failed" },
          { uninstallKeepsPath: true }
        ];
        const texts: string[] = [];

        for (const settings of cases) {
          const runner = new SmokeRunnerFixture(["none", "running", "none"]);
          Object.assign(runner, { localAppData: path.join(repository.directory, "local"), ...settings });
          const output = new TextOutputFixture();
          assert.equal(await PackageSmokeTests.runAsync(t, repository, "win32", runner, output), 1, output.text);
          texts.push(output.text.split("\n").filter(t => t.length > 0).at(-1) ?? "");
        }

        assert.deepEqual(texts, [
          "ERROR: Access is denied.",
          `The user's Path holds ${bin} 0 times instead of once: ""`,
          `The user's Path holds ${bin} 2 times instead of once: ${JSON.stringify(`${bin};${bin}`)}`,
          "The runtime could not start.",
          `After the uninstall the user's Path is ${JSON.stringify(bin)} instead of null, as it was before the install.`
        ]);
      });

    test("on macOS the app comes out of the disk image, the screen is captured with the window, and the desktop is asked to quit", { timeout: PackageSmokeTests.TIMEOUT }, async t => {
      const repository = await PackageSmokeTests.createAsync(t, "Fixture Studio-macos-arm64.dmg");
      const runner = new SmokeRunnerFixture(["none", "running", "none"]);
      const output = new TextOutputFixture();
      const temporaryFolder = new TemporaryFolderFixture(repository.directory);

      const exitCode = await PackageSmokeTests.runAsync(t, repository, "darwin", runner, output, "arm64", {}, temporaryFolder);

      const status = ["Fixture Studio", path.join("Fixture Studio.app", "Contents", "Resources", PackageSmokeTests.CLI), ...PackageSmokeTests.STATUS];
      const screen = path.join(repository.directory, "_build", "package", "smoke", "window-macos-arm64.png");
      assert.equal(exitCode, 0, output.text);
      assert.deepEqual(runner.calls.slice(3), [status, status, ["screencapture", "-x", screen], status]);
      assert.equal(existsSync(path.dirname(screen)), true);
      assert.ok(output.text.includes(`\nThe screen with the window: ${screen}\nThe desktop quit.\n`), output.text);
      assert.deepEqual(runner.starts, [[path.join("Fixture Studio.app", "Contents", "MacOS", "Fixture Studio"), `--data-dir=${path.join(runner.folder, "data")}`]]);
      assert.deepEqual(runner.desktop.signals, ["SIGTERM"]);
      assert.deepEqual(temporaryFolder.platforms, ["darwin"]);
    });

    test("on macOS a screen that cannot be captured is reported with its reason in the output and the step summary, and the smoke check goes on", { timeout: PackageSmokeTests.TIMEOUT }, async t => {
      const repository = await PackageSmokeTests.createAsync(t, "Fixture Studio-macos-arm64.dmg");
      const summary = path.join(repository.directory, "summary.md");
      const runners = [new SmokeRunnerFixture(["none", "running", "none"], undefined, ["screencapture"]), new SmokeRunnerFixture(["none", "running", "none"], undefined, ["screencapture"])] as const;
      const outputs = [new TextOutputFixture(), new TextOutputFixture()] as const;
      const reason = "The screen could not be captured, so the run keeps no picture of the window; screencapture exited with 9:\nscreencapture broke\n";

      const exitCodes = [
        await PackageSmokeTests.runAsync(t, repository, "darwin", runners[0], outputs[0], "arm64"),
        await PackageSmokeTests.runAsync(t, repository, "darwin", runners[1], outputs[1], "arm64", { GITHUB_STEP_SUMMARY: summary })
      ];

      assert.deepEqual(exitCodes, [0, 0], outputs.map(t => t.text).join());
      for (const output of outputs) {
        assert.ok(output.text.includes(`\n${reason}The desktop quit.\n`), output.text);
        assert.ok(output.text.endsWith("The runtime stopped once idle.\n"), output.text);
      }
      assert.equal(await readFile(summary, "utf8"), reason);
    });

    test("a failed install or a window that cannot be closed stops the smoke check, and a desktop left running is stopped", { timeout: PackageSmokeTests.TIMEOUT }, async t => {
      const repository = await PackageSmokeTests.createAsync(t, "Fixture Studio-linux-x64.AppImage");
      await repository.writeAsync({ "_build/package/out/Fixture Studio-windows-x64.exe": "package\n" });
      const extract = new SmokeRunnerFixture(["none"], undefined, ["--appimage-extract"]);
      const close = new SmokeRunnerFixture(["none", "running"], undefined, ["taskkill"]);
      close.localAppData = path.join(repository.directory, "local");
      const outputs = [new TextOutputFixture(), new TextOutputFixture()] as const;

      const exitCodes = [
        await PackageSmokeTests.runAsync(t, repository, "linux", extract, outputs[0]),
        await PackageSmokeTests.runAsync(t, repository, "win32", close, outputs[1])
      ];

      assert.deepEqual(exitCodes, [1, 1]);
      assert.equal(outputs[0].text, "Fixture Studio-linux-x64.AppImage --appimage-extract failed with exit code 9:\nFixture Studio-linux-x64.AppImage broke\n");
      assert.deepEqual(extract.starts, []);
      assert.match(outputs[1].text, /\ntaskkill \/PID 4242 failed with exit code 9:\ntaskkill broke\n$/);
      assert.deepEqual(close.desktop.signals, ["SIGKILL"]);
    });

    test("a runtime before the start, a desktop that ends before its runtime answers or a runtime that answers for none of the 60 s fails the smoke check", { timeout: PackageSmokeTests.TIMEOUT }, async t => {
      const repository = await PackageSmokeTests.createAsync(t, "Fixture Studio-linux-x64.AppImage");
      const early = new SmokeRunnerFixture(["running"]);
      const ended = new SmokeRunnerFixture(["none"], new DesktopFixture(0, 4));
      const silent = new SmokeRunnerFixture(["none", "failed"]);
      const outputs = [new TextOutputFixture(), new TextOutputFixture(), new TextOutputFixture()] as const;

      const exitCodes = [
        await PackageSmokeTests.runAsync(t, repository, "linux", early, outputs[0]),
        await PackageSmokeTests.runAsync(t, repository, "linux", ended, outputs[1]),
        await PackageSmokeTests.runAsync(t, repository, "linux", silent, outputs[2])
      ];

      assert.deepEqual(exitCodes, [1, 1, 1]);
      assert.equal(early.starts.length, 0);
      assert.match(outputs[0].text, /^Installed in \d+\.\d s: .+\nteamrun status before the start exited with 0 instead of 3:\n\{"build"/);
      assert.match(outputs[1].text, /\nThe desktop exited with 4 before its runtime answered:\n.+desktop\.log:\nThe desktop's log\.\n$/);
      assert.match(outputs[2].text, /\nThe desktop's runtime did not answer teamrun status within 60000 ms; the last answer was exit code 1:\nThe runtime could not start\.\n.+desktop\.log:\nThe desktop's log\.\n$/);
      assert.equal(silent.statuses, 1 + 60_000 / 500 + 1);
      assert.deepEqual(silent.desktop.signals, ["SIGKILL"]);
      assert.deepEqual(ended.desktop.signals, []);
    });

    test("an unreadable or another build's answer, a desktop that does not quit within 30 s or one that quits with an error fails the smoke check, and a desktop left running is stopped",
      { timeout: PackageSmokeTests.TIMEOUT }, async t => {
        const repository = await PackageSmokeTests.createAsync(t, "Fixture Studio-linux-x64.AppImage");
        const unreadable = new SmokeRunnerFixture(["none", "unreadable"]);
        const other = new SmokeRunnerFixture(["none", "other version"]);
        const stuck = new SmokeRunnerFixture(["none", "running"], new DesktopFixture(null, null));
        const failed = new SmokeRunnerFixture(["none", "running"], new DesktopFixture(5, null));
        const outputs = [new TextOutputFixture(), new TextOutputFixture(), new TextOutputFixture(), new TextOutputFixture()] as const;

        const exitCodes = [
          await PackageSmokeTests.runAsync(t, repository, "linux", unreadable, outputs[0]),
          await PackageSmokeTests.runAsync(t, repository, "linux", other, outputs[1]),
          await PackageSmokeTests.runAsync(t, repository, "linux", stuck, outputs[2]),
          await PackageSmokeTests.runAsync(t, repository, "linux", failed, outputs[3])
        ];

        assert.deepEqual(exitCodes, [1, 1, 1, 1]);
        assert.match(outputs[0].text, /\nteamrun status --json answered without a build version and a data directory:\n\{"build":\n$/);
        assert.deepEqual(unreadable.desktop.signals, ["SIGKILL"]);
        assert.match(outputs[1].text, /\nteamrun status reported version 0\.0\.6 in .+ instead of 0\.0\.7 in .+\.\n$/);
        assert.deepEqual(other.desktop.signals, ["SIGKILL"]);
        assert.match(outputs[2].text, /\nThe desktop did not quit within 30000 ms; a question on closing, such as one about work in progress, keeps it open:\n.+desktop\.log:\nThe desktop's log\.\n$/);
        assert.deepEqual(stuck.desktop.signals, ["SIGTERM", "SIGKILL"]);
        assert.match(outputs[3].text, /\nThe desktop quit with exit code 5:\n.+desktop\.log:\nThe desktop's log\.\n$/);
      });

    test("a runtime still there 90 s after the desktop quit is killed, and it, one without a discovery file or one status still finds fails the smoke check, whose folder is then removed",
      { timeout: PackageSmokeTests.TIMEOUT }, async t => {
        const repository = await PackageSmokeTests.createAsync(t, "Fixture Studio-linux-x64.AppImage");
        const lingering = new SmokeRunnerFixture(["none", "running"]);
        const hidden = new SmokeRunnerFixture(["none", "running"]);
        const answering = new SmokeRunnerFixture(["none", "running"]);
        lingering.runtimeChecks = Number.POSITIVE_INFINITY;
        hidden.discovery = "missing";
        answering.runtimeChecks = 0;
        const outputs = [new TextOutputFixture(), new TextOutputFixture(), new TextOutputFixture()] as const;

        const exitCodes = [
          await PackageSmokeTests.runAsync(t, repository, "linux", lingering, outputs[0]),
          await PackageSmokeTests.runAsync(t, repository, "linux", hidden, outputs[1]),
          await PackageSmokeTests.runAsync(t, repository, "linux", answering, outputs[2])
        ];

        assert.deepEqual(exitCodes, [1, 1, 1]);
        assert.match(outputs[0].text, /\nThe desktop quit\.\nThe runtime, process 5151, did not stop within 90000 ms after the desktop quit, although nothing used it:\n.+desktop\.log:\nThe desktop's log\.\n$/);
        assert.equal(lingering.checked.length, 90_000 / 500 + 2);
        assert.deepEqual(lingering.killed, [5151]);
        assert.match(outputs[1].text, /\nThe runtime's discovery file .+runtime\.json names no process\.\n$/);
        assert.deepEqual(hidden.desktop.signals, ["SIGKILL"]);
        assert.match(outputs[2].text, /\nThe desktop quit\.\nteamrun status after the runtime stopped exited with 0 instead of 3:\n\{"build"/);
        assert.deepEqual([lingering, hidden, answering].map(t => existsSync(t.folder)), [false, false, false]);
      });

    test("after a failure the runtime the check never reached is still waited for, and a runtime that cannot be ended or a folder that cannot be removed is reported after the failure",
      { timeout: PackageSmokeTests.TIMEOUT }, async t => {
        const repository = await PackageSmokeTests.createAsync(t, "Fixture Studio-linux-x64.AppImage");
        const other = new SmokeRunnerFixture(["none", "other version"]);
        const stubborn = new SmokeRunnerFixture(["none", "running"]);
        const passing = new SmokeRunnerFixture(["none", "running", "none"]);
        stubborn.runtimeChecks = Number.POSITIVE_INFINITY;
        stubborn.killing = "refused";
        const locked = [new TemporaryFolderFixture(repository.directory), new TemporaryFolderFixture(repository.directory)] as const;
        for (const temporaryFolder of locked)
          temporaryFolder.isRemovable = false;
        const outputs = [new TextOutputFixture(), new TextOutputFixture(), new TextOutputFixture()] as const;

        const exitCodes = [
          await PackageSmokeTests.runAsync(t, repository, "linux", other, outputs[0]),
          await PackageSmokeTests.runAsync(t, repository, "linux", stubborn, outputs[1], "x64", {}, locked[0]),
          await PackageSmokeTests.runAsync(t, repository, "linux", passing, outputs[2], "x64", {}, locked[1])
        ];

        assert.deepEqual(exitCodes, [1, 1, 1]);
        assert.deepEqual([other.checked, other.killed], [[5151, 5151], []]);
        assert.equal(existsSync(other.folder), false);
        assert.match(outputs[1].text, new RegExp(`\\nThe runtime, process 5151, did not stop within 90000 ms after the desktop quit, although nothing used it:\\n.+desktop\\.log:\\nThe desktop's log\\.\\n`
          + `Cleaning up failed:\\nThe runtime, process 5151, could not be ended: Error: EPERM: operation not permitted, kill 5151\\n`
          + `The smoke's folder .+ could not be removed: Error: EBUSY: resource busy or locked, rmdir '.+'\\n$`, "s"));
        assert.match(outputs[2].text, /\nThe runtime stopped once idle\.\nCleaning up failed:\nThe smoke's folder .+ could not be removed: Error: EBUSY: resource busy or locked, rmdir '.+'\n$/);
      });

    test("a runtime still running after the kill is reported once the kill's 10 s have passed, and a discovery file that cannot be read is reported, with the folder removed either way",
      { timeout: PackageSmokeTests.TIMEOUT }, async t => {
        const repository = await PackageSmokeTests.createAsync(t, "Fixture Studio-linux-x64.AppImage");
        const ignoring = new SmokeRunnerFixture(["none", "running"]);
        const unreadable = new SmokeRunnerFixture(["none", "other version"]);
        ignoring.runtimeChecks = Number.POSITIVE_INFINITY;
        ignoring.killing = "ignored";
        unreadable.discovery = "unreadable";
        const outputs = [new TextOutputFixture(), new TextOutputFixture()] as const;

        const exitCodes = [
          await PackageSmokeTests.runAsync(t, repository, "linux", ignoring, outputs[0]),
          await PackageSmokeTests.runAsync(t, repository, "linux", unreadable, outputs[1])
        ];

        assert.deepEqual(exitCodes, [1, 1]);
        assert.match(outputs[0].text, /\nCleaning up failed:\nThe runtime, process 5151, could not be ended: it was still running 10000 ms after it was killed\.\n$/);
        assert.deepEqual([ignoring.checked.length, ignoring.killed], [90_000 / 500 + 1 + 10_000 / 500 + 1, [5151]]);
        assert.match(outputs[1].text, /\nCleaning up failed:\nThe runtime's discovery file in .+ could not be read: Error: EISDIR: illegal operation on a directory, read\n$/);
        assert.deepEqual([unreadable.checked, unreadable.killed], [[], []]);
        assert.deepEqual([ignoring, unreadable].map(t => existsSync(t.folder)), [false, false]);
      });

    test("a host without packages is refused, an unexpected error reaches the caller, and any argument is refused with the usage", { timeout: PackageSmokeTests.TIMEOUT }, async t => {
      const repository = await PackageSmokeTests.createAsync(t, "Fixture Studio-linux-x64.AppImage");
      const host = new TextOutputFixture();
      const usage = new TextOutputFixture();
      const runner = new SmokeRunnerFixture(["none"]);

      assert.equal(await new PackageSmoke(repository.directory, "freebsd", "x64", runner, new TemporaryFolderFixture(repository.directory), {}, host).runAsync([]), 1);
      assert.equal(await new PackageSmoke(repository.directory, "linux", "x64", runner, new TemporaryFolderFixture(repository.directory), {}, usage).runAsync(["--target", "linux"]), 2);
      await assert.rejects(PackageSmokeTests.runAsync(t, repository, "linux", new UnstartableRunnerFixture(["none"]), new TextOutputFixture()), new RangeError("The fixture broke."));
      const command = spawnSync(process.execPath, [SourceTreeFixture.locateScript("package-smoke.ts"), "--help"], { cwd: repository.directory, encoding: "utf8", timeout: 10_000 });

      assert.equal(host.text, "Packages are made for windows, macos and linux on x64 and arm64, not for freebsd on x64.\n");
      assert.equal(usage.text, PackageSmokeTests.USAGE);
      assert.deepEqual(runner.calls, []);
      assert.deepEqual([command.status, command.stdout], [2, PackageSmokeTests.USAGE]);
    });
  }

  private static async runAsync(t: TestContext, repository: RepositoryFixture, platform: string, runner: SmokeRunnerFixture, output: TextOutputFixture,
    architecture: string = "x64", variables: NodeJS.ProcessEnv = {}, temporaryFolder: TemporaryFolderFixture = new TemporaryFolderFixture(repository.directory)): Promise<number> {
    t.after(() => runner.disposeAsync());
    const environment = { PATH: "fixture-path", LOCALAPPDATA: path.join(repository.directory, "local"), SystemRoot: "C:\\Windows", ...variables };
    const smoke = new PackageSmoke(repository.directory, platform, architecture, runner, temporaryFolder, environment, output);
    t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
    try {
      let isDone = false;
      const run = smoke.runAsync([]);
      const finish = (): void => {
        isDone = true;
      };
      run.then(finish, finish);
      while (!isDone) {
        await new Promise(resolve => setImmediate(resolve));
        t.mock.timers.tick(PackageSmokeTests.TICK);
      }
      return await run;
    }
    finally {
      t.mock.timers.reset();
    }
  }

  private static async createAsync(t: TestContext, made: string): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({
      "package.json": JSON.stringify(ProductIdentityFixture.manifest()),
      [`_build/package/out/${made}`]: "package\n",
      "_build/package/electron/ffmpeg.dll": "program\n"
    });
    return repository;
  }
}

PackageSmokeTests.register();
