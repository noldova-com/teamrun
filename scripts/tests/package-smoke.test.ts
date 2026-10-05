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
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import PackageSmoke from "../package-smoke.ts";
import ProcessResult from "../processes/process-result.ts";
import ProcessRunner from "../processes/process-runner.ts";
import StartedProcess from "../processes/started-process.ts";
import ProductIdentityFixture from "./fixtures/product-identity.fixture.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

type Answer = "none" | "running" | "failed" | "other version";

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

class SmokeRunnerFixture extends ProcessRunner {
  private readonly answers: Answer[];
  private readonly failing: string | null;

  private readonly directories: Set<string> = new Set<string>();

  public readonly desktop: DesktopFixture;
  public localAppData: string = "";
  public readonly calls: (readonly string[])[] = [];
  public readonly environments: (NodeJS.ProcessEnv | undefined)[] = [];
  public readonly starts: (readonly string[])[] = [];
  public readonly checked: number[] = [];
  public runtimeChecks: number = 1;
  public hasDiscovery: boolean = true;

  public constructor(answers: readonly Answer[], desktop: DesktopFixture = new DesktopFixture(0, null), failing: string | null = null) {
    super();

    this.answers = [...answers];
    this.desktop = desktop;
    this.failing = failing;
  }

  public get folder(): string {
    return [...this.directories].join();
  }

  public async disposeAsync(): Promise<void> {
    for (const directory of this.directories)
      await rm(directory, { recursive: true, force: true });
  }

  public override async captureAsync(command: string, commandArguments: readonly string[], directory: string, _timeout: number, environment?: NodeJS.ProcessEnv): Promise<ProcessResult> {
    this.directories.add(directory);
    this.calls.push([path.basename(command), ...commandArguments.map(t => t.startsWith(directory) ? path.relative(directory, t) : t)]);
    if (commandArguments[1] === "status") {
      this.environments.push(environment);
      return this.answer(String(commandArguments.at(-1)));
    }
    const name = path.basename(command);
    if (name === this.failing || commandArguments[0] === this.failing)
      return new ProcessResult(9, "", `${name} broke`);
    if (commandArguments[0] === "--appimage-extract")
      await SmokeRunnerFixture.createAsync(path.join(directory, "squashfs-root", "fixture-studio"));
    if (commandArguments[0] === "/S")
      await SmokeRunnerFixture.createAsync(path.join(this.localAppData, "Programs", "fixture-studio", "Fixture Studio.exe"));
    if (name === "ditto")
      await SmokeRunnerFixture.createAsync(path.join(String(commandArguments[1]), "Contents", "MacOS", "Fixture Studio"));
    if (name === "taskkill")
      this.desktop.close();
    return new ProcessResult(0, "", "");
  }

  public override isRunning(processId: number): boolean {
    this.checked.push(processId);
    return this.runtimeChecks-- > 0;
  }

  public override async startAsync(command: string, commandArguments: readonly string[], directory: string, log: string): Promise<StartedProcess> {
    this.starts.push([command.startsWith(directory) ? path.relative(directory, command) : command, ...commandArguments]);
    await writeFile(log, "The desktop's log.\n");
    return this.desktop;
  }

  private static async createAsync(file: string): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, "program\n");
  }

  private answer(data: string): ProcessResult {
    const answer = this.answers.length > 1 ? this.answers.shift() : this.answers[0];
    switch (answer) {
      case "running":
        if (this.hasDiscovery) {
          mkdirSync(path.join(data, "discovery"), { recursive: true });
          writeFileSync(path.join(data, "discovery", "runtime.json"), JSON.stringify({ processId: 5151 }));
        }
        return new ProcessResult(0, JSON.stringify({ build: { productVersion: "0.0.7" }, dataDirectory: data }), "");
      case "other version":
        return new ProcessResult(0, JSON.stringify({ build: { productVersion: "0.0.6" }, dataDirectory: data }), "");
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
  private static readonly LIMITS = { command: 1_000, start: 60_000, quit: 1_000, stop: 60_000, settle: 1, pause: 1 };
  private static readonly STATUS: readonly string[] = ["status", "--json", "--data-dir", "data"];
  private static readonly CLI: string = path.join("app.asar", "node_modules", "@noldova", "teamrun-shell-cli", "services", "cli-entry.js");

  public static register(): void {
    test("on Linux the AppImage is made executable and unpacked, the desktop starts from the AppImage and the command line from the unpacked program", async t => {
      const repository = await PackageSmokeTests.createAsync(t, "Fixture Studio-linux-x64.AppImage");
      const runner = new SmokeRunnerFixture(["none", "none", "failed", "running", "none"]);
      const output = new TextOutputFixture();

      const exitCode = await PackageSmokeTests.runAsync(t, repository, "linux", runner, output);

      const appImage = path.join(repository.directory, "_build", "package", "out", "Fixture Studio-linux-x64.AppImage");
      const status = ["fixture-studio", path.join("squashfs-root", "resources", PackageSmokeTests.CLI), ...PackageSmokeTests.STATUS];
      assert.equal(exitCode, 0, output.text);
      assert.deepEqual(runner.calls, [["Fixture Studio-linux-x64.AppImage", "--appimage-extract"], status, status, status, status, status]);
      assert.deepEqual(runner.starts, [[appImage, `--data-dir=${path.join(runner.folder, "data")}`]]);
      assert.deepEqual(runner.environments.map(t => [t?.["ELECTRON_RUN_AS_NODE"], t?.["PATH"]]), [1, 2, 3, 4, 5].map(() => ["1", "fixture-path"]));
      assert.deepEqual(runner.desktop.signals, ["SIGTERM"]);
      assert.deepEqual(runner.checked, [5151, 5151]);
      if (process.platform !== "win32")
        assert.equal((await stat(appImage)).mode & 0o777, 0o755);
      assert.equal(output.text, [
        `Installed: ${appImage}`,
        "teamrun status before the start: no runtime.",
        `teamrun status after the start: version 0.0.7 in ${path.join(runner.folder, "data")}.`,
        "The desktop quit.",
        "The runtime stopped once idle.",
        ""
      ].join("\n"));
      assert.equal(existsSync(runner.folder), false);
    });

    test("on Windows the installer installs silently for the user, and the desktop is closed through its window", async t => {
      const repository = await PackageSmokeTests.createAsync(t, "Fixture Studio-windows-x64.exe");
      const runner = new SmokeRunnerFixture(["none", "running", "none"]);
      const output = new TextOutputFixture();
      runner.localAppData = path.join(repository.directory, "local");

      const exitCode = await PackageSmokeTests.runAsync(t, repository, "win32", runner, output);

      const program = path.join(repository.directory, "local", "Programs", "fixture-studio", "Fixture Studio.exe");
      const status = ["Fixture Studio.exe", path.join(path.dirname(program), "resources", PackageSmokeTests.CLI), ...PackageSmokeTests.STATUS];
      assert.equal(exitCode, 0, output.text);
      assert.deepEqual(runner.calls, [["Fixture Studio-windows-x64.exe", "/S"], status, status, ["taskkill", "/PID", "4242"], status]);
      assert.deepEqual(runner.starts, [[program, `--data-dir=${path.join(runner.folder, "data")}`]]);
      assert.deepEqual(runner.desktop.signals, []);
      assert.ok(output.text.startsWith(`Installed: ${program}\n`));
    });

    test("on macOS the app is copied out of the disk image, which is detached again, the screen is captured with the window, and the desktop is asked to quit", async t => {
      const repository = await PackageSmokeTests.createAsync(t, "Fixture Studio-macos-arm64.dmg");
      const runner = new SmokeRunnerFixture(["none", "running", "none"]);
      const output = new TextOutputFixture();

      const exitCode = await PackageSmokeTests.runAsync(t, repository, "darwin", runner, output, "arm64");

      const image = path.join(repository.directory, "_build", "package", "out", "Fixture Studio-macos-arm64.dmg");
      const status = ["Fixture Studio", path.join("Fixture Studio.app", "Contents", "Resources", PackageSmokeTests.CLI), ...PackageSmokeTests.STATUS];
      const screen = path.join(repository.directory, "_build", "package", "smoke", "window-macos-arm64.png");
      assert.equal(exitCode, 0, output.text);
      assert.deepEqual(runner.calls, [
        ["hdiutil", "attach", image, "-nobrowse", "-readonly", "-mountpoint", "mount"],
        ["ditto", path.join("mount", "Fixture Studio.app"), "Fixture Studio.app"],
        ["hdiutil", "detach", "mount"],
        status,
        status,
        ["screencapture", "-x", screen],
        status
      ]);
      assert.equal(existsSync(path.dirname(screen)), true);
      assert.ok(output.text.includes(`\nThe screen with the window: ${screen}\nThe desktop quit.\n`), output.text);
      assert.deepEqual(runner.starts, [[path.join("Fixture Studio.app", "Contents", "MacOS", "Fixture Studio"), `--data-dir=${path.join(runner.folder, "data")}`]]);
      assert.deepEqual(runner.desktop.signals, ["SIGTERM"]);
    });

    test("on macOS a screen that cannot be captured is reported with its reason, and the smoke check goes on", async t => {
      const repository = await PackageSmokeTests.createAsync(t, "Fixture Studio-macos-arm64.dmg");
      const runner = new SmokeRunnerFixture(["none", "running", "none"], undefined, "screencapture");
      const output = new TextOutputFixture();

      const exitCode = await PackageSmokeTests.runAsync(t, repository, "darwin", runner, output, "arm64");

      assert.equal(exitCode, 0, output.text);
      assert.ok(output.text.includes("\nThe screen could not be captured, so the run keeps no picture of the window; screencapture exited with 9:\nscreencapture broke\nThe desktop quit.\n"),
        output.text);
      assert.ok(output.text.endsWith("The runtime stopped once idle.\n"), output.text);
    });

    test("a step that fails, or an install without its program, stops the smoke check, and the disk image is detached even after a failed copy", async t => {
      const repository = await PackageSmokeTests.createAsync(t, "Fixture Studio-macos-x64.dmg");
      await repository.writeAsync({ "_build/package/out/Fixture Studio-linux-x64.AppImage": "package\n", "_build/package/out/Fixture Studio-windows-x64.exe": "package\n" });
      const copy = new SmokeRunnerFixture(["none"], undefined, "ditto");
      const extract = new SmokeRunnerFixture(["none"], undefined, "--appimage-extract");
      const install = new SmokeRunnerFixture(["none"]);
      install.localAppData = path.join(repository.directory, "elsewhere");
      const outputs = [new TextOutputFixture(), new TextOutputFixture(), new TextOutputFixture()] as const;

      const exitCodes = [
        await PackageSmokeTests.runAsync(t, repository, "darwin", copy, outputs[0]),
        await PackageSmokeTests.runAsync(t, repository, "linux", extract, outputs[1]),
        await PackageSmokeTests.runAsync(t, repository, "win32", install, outputs[2])
      ];

      assert.deepEqual(exitCodes, [1, 1, 1]);
      assert.deepEqual(copy.calls.map(t => t.slice(0, 2)), [["hdiutil", "attach"], ["ditto", path.join("mount", "Fixture Studio.app")], ["hdiutil", "detach"]]);
      assert.match(outputs[0].text, /^ditto .+ failed with exit code 9:\nditto broke\n$/);
      assert.match(outputs[1].text, /^Fixture Studio-linux-x64\.AppImage --appimage-extract failed with exit code 9:\nFixture Studio-linux-x64\.AppImage broke\n$/);
      assert.equal(outputs[2].text, `The installed package has no ${path.join(repository.directory, "local", "Programs", "fixture-studio", "Fixture Studio.exe")}.\n`);
      assert.deepEqual([copy.starts, extract.starts, install.starts], [[], [], []]);
    });

    test("a runtime before the start, a desktop that ends before its runtime answers or a runtime that never answers fails the smoke check", async t => {
      const repository = await PackageSmokeTests.createAsync(t, "Fixture Studio-linux-x64.AppImage");
      const early = new SmokeRunnerFixture(["running"]);
      const ended = new SmokeRunnerFixture(["none"], new DesktopFixture(0, 4));
      const silent = new SmokeRunnerFixture(["none", "failed"]);
      const outputs = [new TextOutputFixture(), new TextOutputFixture(), new TextOutputFixture()] as const;

      const exitCodes = [
        await PackageSmokeTests.runAsync(t, repository, "linux", early, outputs[0]),
        await PackageSmokeTests.runAsync(t, repository, "linux", ended, outputs[1]),
        await PackageSmokeTests.runAsync(t, repository, "linux", silent, outputs[2], "x64", { ...PackageSmokeTests.LIMITS, start: 0 })
      ];

      assert.deepEqual(exitCodes, [1, 1, 1]);
      assert.equal(early.starts.length, 0);
      assert.match(outputs[0].text, /^Installed: .+\nteamrun status before the start exited with 0 instead of 3:\n\{"build"/);
      assert.match(outputs[1].text, /\nThe desktop exited with 4 before its runtime answered:\n.+desktop\.log:\nThe desktop's log\.\n$/);
      assert.match(outputs[2].text, /\nThe desktop's runtime did not answer teamrun status within 0 ms; the last answer was exit code 1:\nThe runtime could not start\.\n.+desktop\.log:\nThe desktop's log\.\n$/);
      assert.deepEqual(silent.desktop.signals, ["SIGKILL"]);
      assert.deepEqual(ended.desktop.signals, []);
    });

    test("another build's answer, a desktop that does not quit or one that quits with an error fails the smoke check, and a desktop left running is stopped", async t => {
      const repository = await PackageSmokeTests.createAsync(t, "Fixture Studio-linux-x64.AppImage");
      const other = new SmokeRunnerFixture(["none", "other version"]);
      const stuck = new SmokeRunnerFixture(["none", "running"], new DesktopFixture(null, null));
      const failed = new SmokeRunnerFixture(["none", "running"], new DesktopFixture(5, null));
      const outputs = [new TextOutputFixture(), new TextOutputFixture(), new TextOutputFixture()] as const;

      const exitCodes = [
        await PackageSmokeTests.runAsync(t, repository, "linux", other, outputs[0]),
        await PackageSmokeTests.runAsync(t, repository, "linux", stuck, outputs[1]),
        await PackageSmokeTests.runAsync(t, repository, "linux", failed, outputs[2])
      ];

      assert.deepEqual(exitCodes, [1, 1, 1]);
      assert.match(outputs[0].text, /\nteamrun status reported version 0\.0\.6 in .+ instead of 0\.0\.7 in .+\.\n$/);
      assert.deepEqual(other.desktop.signals, ["SIGKILL"]);
      assert.match(outputs[1].text, /\nThe desktop did not quit within 1000 ms; a question on closing, such as one about work in progress, keeps it open:\n.+desktop\.log:\nThe desktop's log\.\n$/);
      assert.deepEqual(stuck.desktop.signals, ["SIGTERM", "SIGKILL"]);
      assert.match(outputs[2].text, /\nThe desktop quit with exit code 5:\n.+desktop\.log:\nThe desktop's log\.\n$/);
    });

    test("a runtime that stays after the desktop quit, one without a discovery file or one status still finds fails the smoke check, and its folder is kept", async t => {
      const repository = await PackageSmokeTests.createAsync(t, "Fixture Studio-linux-x64.AppImage");
      const lingering = new SmokeRunnerFixture(["none", "running"]);
      const hidden = new SmokeRunnerFixture(["none", "running"]);
      const answering = new SmokeRunnerFixture(["none", "running"]);
      lingering.runtimeChecks = Number.POSITIVE_INFINITY;
      hidden.hasDiscovery = false;
      answering.runtimeChecks = 0;
      const outputs = [new TextOutputFixture(), new TextOutputFixture(), new TextOutputFixture()] as const;

      const exitCodes = [
        await PackageSmokeTests.runAsync(t, repository, "linux", lingering, outputs[0], "x64", { ...PackageSmokeTests.LIMITS, stop: 0 }),
        await PackageSmokeTests.runAsync(t, repository, "linux", hidden, outputs[1]),
        await PackageSmokeTests.runAsync(t, repository, "linux", answering, outputs[2])
      ];

      assert.deepEqual(exitCodes, [1, 1, 1]);
      assert.match(outputs[0].text, /\nThe desktop quit\.\nThe runtime, process 5151, did not stop within 0 ms after the desktop quit, although nothing used it:\n.+desktop\.log:\nThe desktop's log\.\n$/);
      assert.match(outputs[1].text, /\nThe runtime's discovery file .+runtime\.json names no process\.\n$/);
      assert.deepEqual(hidden.desktop.signals, ["SIGKILL"]);
      assert.match(outputs[2].text, /\nThe desktop quit\.\nteamrun status after the runtime stopped exited with 0 instead of 3:\n\{"build"/);
      assert.deepEqual([lingering, hidden, answering].map(t => existsSync(t.folder)), [true, true, true]);
    });

    test("a host without packages is refused, an unexpected error reaches the caller, and any argument is refused with the usage", async t => {
      const repository = await PackageSmokeTests.createAsync(t, "Fixture Studio-linux-x64.AppImage");
      const host = new TextOutputFixture();
      const usage = new TextOutputFixture();
      const runner = new SmokeRunnerFixture(["none"]);

      assert.equal(await new PackageSmoke(repository.directory, "freebsd", "x64", runner, {}, host).runAsync([]), 1);
      assert.equal(await new PackageSmoke(repository.directory, "linux", "x64", runner, {}, usage).runAsync(["--target", "linux"]), 2);
      await assert.rejects(PackageSmokeTests.runAsync(t, repository, "linux", new UnstartableRunnerFixture(["none"]), new TextOutputFixture()), new RangeError("The fixture broke."));
      const command = spawnSync(process.execPath, [SourceTreeFixture.locateScript("package-smoke.ts"), "--help"], { cwd: repository.directory, encoding: "utf8", timeout: 10_000 });

      assert.equal(host.text, "Packages are made for windows, macos and linux on x64 and arm64, not for freebsd on x64.\n");
      assert.equal(usage.text, PackageSmokeTests.USAGE);
      assert.deepEqual(runner.calls, []);
      assert.deepEqual([command.status, command.stdout], [2, PackageSmokeTests.USAGE]);
    });
  }

  private static runAsync(t: TestContext, repository: RepositoryFixture, platform: string, runner: SmokeRunnerFixture, output: TextOutputFixture,
    architecture: string = "x64", limits: typeof PackageSmokeTests.LIMITS = PackageSmokeTests.LIMITS): Promise<number> {
    t.after(() => runner.disposeAsync());
    const environment = { PATH: "fixture-path", LOCALAPPDATA: path.join(repository.directory, "local") };
    return new PackageSmoke(repository.directory, platform, architecture, runner, environment, output, limits, tmpdir()).runAsync([]);
  }

  private static async createAsync(t: TestContext, made: string): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({
      "package.json": JSON.stringify(ProductIdentityFixture.manifest()),
      [`_build/package/out/${made}`]: "package\n"
    });
    return repository;
  }
}

PackageSmokeTests.register();
