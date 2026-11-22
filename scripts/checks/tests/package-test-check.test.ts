/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import { afterEach, describe, it } from "node:test";

import { PackageBuild } from "../../packages/package-build.ts";
import { ProcessEnd } from "../../processes/process-end.ts";
import { ProcessRunner } from "../../processes/process-runner.ts";
import { TestOptions } from "../../test-options.ts";
import { PackageTestCheck } from "../package-test-check.ts";
import { PackageTestEntry } from "../package-test-entry.ts";
import { PackageCheckRun } from "./fixtures/package-check-run.fixture.ts";

const folders: string[] = [];

class CompiledBuild extends PackageBuild {
  public override async compileTestsReportedAsync(): Promise<boolean> {
    return true;
  }
}

class RecordingRunner extends ProcessRunner {
  public readonly environments: NodeJS.ProcessEnv[] = [];

  private readonly production: string;

  public constructor(production: string) {
    super();
    this.production = production;
  }

  public override async runToEndAsync(_command: string, _commandArguments: readonly string[], _directory: string, environment?: NodeJS.ProcessEnv): Promise<ProcessEnd> {
    const recorded = environment ?? {};
    this.environments.push(recorded);
    const run = spawnSync(process.execPath, [path.join(this.production, "covered-file.js")], { env: { ...process.env, NODE_V8_COVERAGE: recorded[PackageTestEntry.COVERAGE_VARIABLE] } });
    assert.equal(run.status, 0);
    writeFileSync(String(recorded[PackageTestEntry.RESULT_VARIABLE]), JSON.stringify({ discovered: 1, selected: 1, wanted: 1, passed: 1, failed: 0, skipped: 0, unreached: 0, skips: [],
      files: ["@noldova/teamrun.sample/tests/sample.test.js"] }));
    return new ProcessEnd(0, null);
  }
}

const runAsync = async (args: readonly string[], isolatedTests: readonly string[] = []): Promise<PackageCheckRun> => {
  const root = mkdtempSync(path.join(tmpdir(), "package-test-check-"));
  folders.push(root);
  mkdirSync(path.join(root, "src", "noldova.teamrun.sample", "src"), { recursive: true });
  writeFileSync(path.join(root, "src", "noldova.teamrun.sample", "package.json"), JSON.stringify({ name: "@noldova/teamrun.sample", version: "__VERSION__", private: true, noldova: { isolatedTests } }));
  mkdirSync(path.join(root, "_build", "tests", "noldova.teamrun.sample"), { recursive: true });
  const production = path.join(root, "node_modules", "@noldova", "teamrun.sample");
  mkdirSync(production, { recursive: true });
  writeFileSync(path.join(production, "covered-file.js"), "const value = 1;\nglobalThis.coveredValue = value;\n");
  writeFileSync(path.join(production, "uncovered-file.js"), "globalThis.uncoveredValue = 2;\n");
  const runner = new RecordingRunner(production);
  const environment: NodeJS.ProcessEnv = { ...process.env, NOLDOVA_TEST_SHARDS: "1" };
  delete environment[PackageTestEntry.SKIP_DETAILS_VARIABLE];
  let text = "";
  const output = new Writable({ write: (chunk, _encoding, done): void => { text += String(chunk); done(); } });
  await new PackageTestCheck(root, new CompiledBuild(root, runner, environment), runner, environment, null, TestOptions.parse(args)).runAsync(output);
  assert.equal(runner.environments.length, 1 + isolatedTests.length);
  return new PackageCheckRun(runner.environments[0]?.[PackageTestEntry.SKIP_DETAILS_VARIABLE], text, runner.environments);
};

describe("PackageTestCheck with npm test's skip options", () => {
  afterEach(() => {
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  it("tells the test process to keep every test's details, and lists every file's coverage, without the options", async () => {
    const { variable, text } = await runAsync([]);

    assert.equal(variable, "false");
    assert.match(text, /[^n]covered-file\.js/u);
    assert.match(text, /uncovered-file\.js/u);
  });

  it("tells the test process to skip passing tests' details with --skip-test-details", async () => {
    const { variable, text } = await runAsync(["--skip-test-details"]);

    assert.equal(variable, "true");
    assert.match(text, /[^n]covered-file\.js/u);
  });

  it("leaves fully covered files out of the coverage table, and keeps incomplete ones, with --skip-coverage-details", async () => {
    const { variable, text } = await runAsync(["--skip-coverage-details"]);

    assert.equal(variable, "false");
    assert.doesNotMatch(text, /[^n]covered-file\.js/u);
    assert.match(text, /uncovered-file\.js/u);
  });
});

describe("PackageTestCheck with a package's isolated tests", () => {
  afterEach(() => {
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  it("tells the shards which files are isolated and has each process's place run the isolated files alone, one process each, before it takes test files", async () => {
    const { text, environments } = await runAsync([], ["services/b.test.ts", "a.test.ts"]);

    const isolated = JSON.stringify(["@noldova/teamrun.sample/a.test.js", "@noldova/teamrun.sample/services/b.test.js"]);
    assert.deepEqual(environments.map(t => [t[PackageTestEntry.ISOLATED_VARIABLE], t[PackageTestEntry.ALONE_VARIABLE], t[PackageTestEntry.CLAIMS_VARIABLE] !== undefined]), [
      [isolated, "@noldova/teamrun.sample/a.test.js", false],
      [isolated, "@noldova/teamrun.sample/services/b.test.js", false],
      [isolated, undefined, true]
    ]);
    assert.match(text, /Running the package tests in one process, after taking turns at 2 test files that run alone, each in a process of its own\./u);
    assert.match(text, /Test process 3 of 3 ran for/u);
  });

  it("names no isolated file when its package lists none", async () => {
    const { text, environments } = await runAsync([]);

    assert.deepEqual(environments.map(t => t[PackageTestEntry.ISOLATED_VARIABLE]), ["[]"]);
    assert.match(text, /Running the package tests in one process\./u);
  });

  it("names a single isolated file as one test file", async () => {
    const { text } = await runAsync([], ["a.test.ts"]);

    assert.match(text, /after taking turns at 1 test file that runs alone/u);
  });
});
