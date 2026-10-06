/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import ElectronBinary from "../../desktop/electron-binary.ts";
import ProcessException from "../../processes/process.exception.ts";
import ProcessResult from "../../processes/process-result.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class InstallerRunnerFixture extends ProcessRunnerFixture {
  private readonly results: ProcessResult[];
  private readonly installsOnSuccess: boolean;

  public constructor(results: readonly ProcessResult[], installsOnSuccess: boolean = true) {
    super();

    this.results = [...results];
    this.installsOnSuccess = installsOnSuccess;
  }

  public override async captureAsync(command: string, commandArguments: readonly string[], directory: string): Promise<ProcessResult> {
    this.captured.push([command, directory, ...commandArguments]);
    const result = this.results.shift() ?? new ProcessResult(1, "", "no result left");
    if (result.isSuccessful && this.installsOnSuccess)
      await ElectronBinaryTests.installAsync(directory);
    return result;
  }
}

class ElectronBinaryTests {
  private static readonly ATTEMPTS: number = 4;
  private static readonly PAUSE: number = 15_000;
  private static readonly POLLS: number = 1_000;
  private static readonly FAILED: ProcessResult = new ProcessResult(1, "", "HTTPError: Response code 500\n");
  private static readonly SUCCEEDED: ProcessResult = new ProcessResult(0, "", "");

  public static register(): void {
    test("an installed binary is left alone", async t => {
      const repository = await ElectronBinaryTests.createAsync(t);
      await ElectronBinaryTests.installAsync(repository.directory);
      const runner = new InstallerRunnerFixture([]);
      const output = new TextOutputFixture();

      await new ElectronBinary(repository.directory, runner).installAsync(output);

      assert.equal(runner.captured.length, 0);
      assert.equal(output.text, "");
    });

    test("a checkout without Electron among its packages has no binary to install", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const runner = new InstallerRunnerFixture([]);
      const binary = new ElectronBinary(repository.directory, runner);

      await binary.installAsync(new TextOutputFixture());

      assert.equal(binary.isInstalled(), false);
      assert.equal(runner.captured.length, 0);
    });

    test("a missing binary is installed with Electron's own installer", async t => {
      const repository = await ElectronBinaryTests.createAsync(t);
      const runner = new InstallerRunnerFixture([ElectronBinaryTests.SUCCEEDED]);
      const output = new TextOutputFixture();
      const binary = new ElectronBinary(repository.directory, runner);

      assert.equal(binary.isInstalled(), false);
      await binary.installAsync(output);

      assert.equal(binary.isInstalled(), true);
      assert.deepEqual(runner.captured, [[process.execPath, repository.directory, path.join(repository.directory, "node_modules", "electron", "install.js")]]);
      assert.equal(output.text, "Installing Electron's binary...\n");
    });

    test("a failed download is tried again after a pause, up to four attempts", async t => {
      const repository = await ElectronBinaryTests.createAsync(t);
      const runner = new InstallerRunnerFixture([ElectronBinaryTests.FAILED, ElectronBinaryTests.FAILED, ElectronBinaryTests.SUCCEEDED]);
      const output = new TextOutputFixture();

      t.mock.timers.enable({ apis: ["setTimeout"] });
      try {
        const run = new ElectronBinary(repository.directory, runner).installAsync(output);
        for (const attempts of [1, 2]) {
          await ElectronBinaryTests.waitForPauseAsync(output, attempts);
          t.mock.timers.tick(ElectronBinaryTests.PAUSE - 1);
          await new Promise(resolve => setImmediate(resolve));
          assert.equal(runner.captured.length, attempts);
          t.mock.timers.tick(1);
        }
        await run;
      }
      finally {
        t.mock.timers.reset();
      }

      assert.equal(runner.captured.length, 3);
      assert.equal(output.text, `Installing Electron's binary...\n${ElectronBinaryTests.pausing(1)}${ElectronBinaryTests.pausing(2)}`);
    });

    test("an installer that keeps failing, or reports success without the binary, fails after four attempts with the last reason", async t => {
      const repository = await ElectronBinaryTests.createAsync(t);
      const failing = new InstallerRunnerFixture(Array.from({ length: ElectronBinaryTests.ATTEMPTS }, () => ElectronBinaryTests.FAILED));
      const hollow = new InstallerRunnerFixture(Array.from({ length: ElectronBinaryTests.ATTEMPTS }, () => ElectronBinaryTests.SUCCEEDED), false);
      const output = new TextOutputFixture();
      const hollowOutput = new TextOutputFixture();

      await assert.rejects(ElectronBinaryTests.runAsync(t, failing, output, new ElectronBinary(repository.directory, failing)),
        new ProcessException("Electron's binary could not be installed in 4 attempts; the last failed with exit code 1: HTTPError: Response code 500."));
      await assert.rejects(ElectronBinaryTests.runAsync(t, hollow, hollowOutput, new ElectronBinary(repository.directory, hollow)),
        new ProcessException("Electron's binary could not be installed in 4 attempts; the last failed with it reported success, but the binary is still missing."));

      assert.equal(failing.captured.length, ElectronBinaryTests.ATTEMPTS);
      assert.equal(hollow.captured.length, ElectronBinaryTests.ATTEMPTS);
      assert.equal(output.text, `Installing Electron's binary...\n${ElectronBinaryTests.pausing(1)}${ElectronBinaryTests.pausing(2)}${ElectronBinaryTests.pausing(3)}`);
      assert.equal(hollowOutput.text, output.text);
    });
  }

  public static async installAsync(root: string): Promise<void> {
    const directory = path.join(root, "node_modules", "electron");
    await mkdir(path.join(directory, "dist"), { recursive: true });
    await writeFile(path.join(directory, "path.txt"), "electron");
    await writeFile(path.join(directory, "dist", "electron"), "");
  }

  private static pausing(attempt: number): string {
    return `Electron's binary could not be installed (attempt ${attempt} of ${ElectronBinaryTests.ATTEMPTS}); trying again in ${ElectronBinaryTests.PAUSE / 1000} seconds.\n`;
  }

  private static async runAsync(t: TestContext, runner: InstallerRunnerFixture, output: TextOutputFixture, binary: ElectronBinary): Promise<void> {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    try {
      let isDone = false;
      const run = binary.installAsync(output);
      const finish = (): void => {
        isDone = true;
      };
      run.then(finish, finish);
      for (let poll = 0; !isDone; poll++) {
        assert.ok(poll < ElectronBinaryTests.POLLS, `the install did not settle; ${runner.captured.length} attempts started; the output is ${JSON.stringify(output.text)}`);
        await new Promise(resolve => setImmediate(resolve));
        t.mock.timers.tick(ElectronBinaryTests.PAUSE);
      }
      await run;
    }
    finally {
      t.mock.timers.reset();
    }
  }

  private static async waitForPauseAsync(output: TextOutputFixture, attempt: number): Promise<void> {
    const pausing = ElectronBinaryTests.pausing(attempt);
    for (let poll = 0; !output.text.includes(pausing); poll++) {
      assert.ok(poll < ElectronBinaryTests.POLLS, `no pause after attempt ${attempt}; the output is ${JSON.stringify(output.text)}`);
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  private static async createAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({ "node_modules/electron/install.js": "" });
    return repository;
  }
}

ElectronBinaryTests.register();
