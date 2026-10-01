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

class ClearInProgressLabelTests {
  private static readonly WORKFLOW: string = "clear-in-progress-label.yml";

  public static register(): void {
    test("closing a labelled issue removes its in progress label and reports a failed removal", async t => {
      const script = (await WorkflowFileFixture.readAsync(ClearInProgressLabelTests.WORKFLOW)).readStepScript("Remove the in progress label");
      for (const status of [0, 1]) {
        const doubles = await CommandDoublesFixture.createAsync();
        t.after(() => doubles.disposeAsync());
        doubles.respond("gh", "issue edit 5 --repo noldova-com/teamrun --remove-label in progress", "", status);

        const result = await doubles.runAsync(script, { GH_TOKEN: "fixture-token", ISSUE_NUMBER: "5", GITHUB_REPOSITORY: "noldova-com/teamrun" });

        assert.equal(result.status, status, result.stderr);
        assert.deepEqual(await doubles.readCallsAsync(), ["gh issue edit 5 --repo noldova-com/teamrun --remove-label in progress"]);
      }
    });

    test("only closed issues that carry the label start the job, which may write issues and nothing else", async () => {
      const text = (await WorkflowFileFixture.readAsync(ClearInProgressLabelTests.WORKFLOW)).text;
      assert.ok(text.includes("  issues:\n    types: [closed]\n"));
      assert.ok(text.includes("    if: contains(github.event.issue.labels.*.name, 'in progress')\n"));
      assert.ok(text.includes("permissions:\n  issues: write\n\n"));
    });
  }
}

ClearInProgressLabelTests.register();
