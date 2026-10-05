/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import CoverageRun from "../../checks/coverage-run.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";

class CoverageRunTests {
  public static register(): void {
    test("a project's arguments name it, its folders, its exclusions and its test folders, and the environment names the folder that records the coverage", () => {
      assert.deepEqual(CoverageRun.formatProjectArguments("alpha", "installed", "source", CoverageRun.NO_EXCLUSIONS, CoverageRun.NO_TEST_FOLDERS), ["alpha", "installed", "source", "[]", "[]"]);
      assert.deepEqual(CoverageRun.recordingIn({ KEPT: "yes" }, "reports"), { KEPT: "yes", NODE_V8_COVERAGE: "reports" });
      assert.equal(new CoverageRun("repository", new ProcessRunnerFixture()).locateService("a", "b.js"), path.join("repository", "node_modules", "@noldova", "teamrun-foundation-testing", "services", "a", "b.js"));
      assert.deepEqual(CoverageRun.formatProjectArguments("scripts", "scripts", "scripts", "[{\"file\":\"a.ts\",\"reason\":\"b\"}]", ["tests", "deep/tests"]), [
        "scripts", "scripts", "scripts", "[{\"file\":\"a.ts\",\"reason\":\"b\"}]", "[\"tests\",\"deep/tests\"]"
      ]);
    });

    test("foundation's coverage run measures the projects' reports with the given environment, and only exit code zero passes", async () => {
      const runner = new ProcessRunnerFixture([0, 1, null]);
      const run = new CoverageRun("repository", runner);
      const projects = CoverageRun.formatProjectArguments("alpha", "installed", "source", CoverageRun.NO_EXCLUSIONS, CoverageRun.NO_TEST_FOLDERS);

      assert.deepEqual([await run.measureAsync("reports", projects, { KEPT: "yes" }), await run.measureAsync("reports", projects, {}), await run.measureAsync("reports", projects, {})], [true, false, false]);
      assert.deepEqual(runner.runs[0], [
        process.execPath,
        "repository",
        "--disable-warning=ExperimentalWarning",
        path.join("repository", "node_modules", "@noldova", "teamrun-foundation-testing", "services", "coverage", "coverage-run-entry.js"),
        "reports",
        ...projects
      ]);
      assert.deepEqual(runner.environments[0], { KEPT: "yes" });
    });
  }
}

CoverageRunTests.register();
