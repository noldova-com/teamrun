/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import CommandDoublesFixture from "../../fixtures/command-doubles.fixture.ts";
import WorkflowFileFixture from "../../fixtures/workflow-file.fixture.ts";

class RequireLinkedIssueMergeGroupTests {
  private static readonly WORKFLOW: string = "require-linked-issue-merge-group.yml";

  public static register(): void {
    test("a merge group passes the linked-issue check and says why in the summary", async t => {
      const script = (await WorkflowFileFixture.readAsync(RequireLinkedIssueMergeGroupTests.WORKFLOW)).readStepScript("Accept the merge group's pull requests");
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());

      const result = await doubles.runAsync(script, { GITHUB_STEP_SUMMARY: "summary.md" });

      assert.equal(result.status, 0, result.stderr);
      assert.match(await doubles.readFileAsync("summary.md"), /^The merge queue admits only pull requests whose linked-issue check passed/);
    });

    test("the merge group check has the pull request check's name and no permissions", async () => {
      const text = (await WorkflowFileFixture.readAsync(RequireLinkedIssueMergeGroupTests.WORKFLOW)).text;
      const pullRequestCheck = (await WorkflowFileFixture.readAsync("require-linked-issue.yml")).text;
      assert.ok(text.includes("    name: Require linked issue\n"));
      assert.ok(pullRequestCheck.includes("    name: Require linked issue\n"));
      assert.ok(text.includes("  merge_group:\n    types: [checks_requested]\n    branches: [main]\n"));
      assert.ok(text.includes("permissions: {}\n"));
    });
  }
}

RequireLinkedIssueMergeGroupTests.register();
