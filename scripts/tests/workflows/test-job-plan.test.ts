/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import TestPart from "../../test-part.ts";
import BuildMatrix from "../../workflows/build-matrix.ts";
import TestJobPlan from "../../workflows/test-job-plan.ts";

class TestJobPlanTests {
  public static register(): void {
    test("a target that splits its tests builds once and runs every part in its own job, and only the Angular part builds again and keeps the Angular output", () => {
      const linux = new BuildMatrix("workflow_dispatch").targets.find(t => t.name === "Linux x64");
      assert.ok(linux !== undefined);

      const jobs = TestJobPlan.plan(linux);

      assert.deepEqual(jobs, [
        { part: "packages", name: "Package tests", prebuilt: true, build: false, angular: false },
        { part: "scripts", name: "Script tests", prebuilt: true, build: false, angular: false },
        { part: "angular-and-checks", name: "Angular tests and checks", prebuilt: true, build: true, angular: true }
      ]);
      assert.deepEqual(jobs.map(t => t.part), TestPart.ALL);
    });

    test("a target that doesn't split builds and runs the complete gate in one job", () => {
      const macos = new BuildMatrix("workflow_dispatch").targets.find(t => t.name === "macOS ARM64");
      assert.ok(macos !== undefined);

      assert.deepEqual(TestJobPlan.plan(macos), [{ part: "", name: "Build and test", prebuilt: false, build: true, angular: true }]);
    });

    test("Linux and Windows split their tests, and macOS, whose runners the organization limits most, runs each target's tests in one job", () => {
      assert.deepEqual(new BuildMatrix("workflow_dispatch").targets.map(t => `${t.name}: ${t.splitsTests}`), [
        "Linux x64: true", "Linux ARM64: true", "Windows x64: true", "Windows ARM64: true", "macOS x64: false", "macOS ARM64: false"
      ]);
    });
  }
}

TestJobPlanTests.register();
