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

class ClearWorkLabelsTests {
  private static readonly SCRIPT_TIMEOUT: number = 30_000;
  private static readonly WORKFLOW: string = "clear-work-labels.yml";
  private static readonly STEP: string = "Remove the in progress and paused labels";

  public static register(): void {
    test("closing a labelled issue removes the labels it carries in one edit and reports a failed removal", { timeout: ClearWorkLabelsTests.SCRIPT_TIMEOUT }, async t => {
      const script = (await WorkflowFileFixture.readAsync(ClearWorkLabelsTests.WORKFLOW)).readStepScript(ClearWorkLabelsTests.STEP);
      const cases: readonly (readonly [string, string, string])[] = [
        ["true", "true", "--remove-label in progress --remove-label paused"],
        ["true", "false", "--remove-label in progress"],
        ["false", "true", "--remove-label paused"]
      ];
      for (const [inProgress, paused, removals] of cases) {
        for (const status of [0, 1]) {
          const doubles = await CommandDoublesFixture.createAsync();
          t.after(() => doubles.disposeAsync());
          doubles.respond("gh", `issue edit 5 --repo noldova-com/teamrun ${removals}`, "", status);

          const result = await doubles.runAsync(script, { GH_TOKEN: "fixture-token", ISSUE_NUMBER: "5", GITHUB_REPOSITORY: "noldova-com/teamrun", IN_PROGRESS: inProgress, PAUSED: paused });

          assert.equal(result.status, status, result.stderr);
          assert.deepEqual(await doubles.readCallsAsync(), [`gh issue edit 5 --repo noldova-com/teamrun ${removals}`]);
        }
      }
    });

    test("only closed issues that carry either label start the job, which may write issues and nothing else", async () => {
      const text = (await WorkflowFileFixture.readAsync(ClearWorkLabelsTests.WORKFLOW)).text;
      assert.ok(text.includes("  issues:\n    types: [closed]\n"));
      assert.ok(text.includes("    if: contains(github.event.issue.labels.*.name, 'in progress') || contains(github.event.issue.labels.*.name, 'paused')\n"));
      assert.ok(text.includes("          IN_PROGRESS: ${{ contains(github.event.issue.labels.*.name, 'in progress') }}\n"));
      assert.ok(text.includes("          PAUSED: ${{ contains(github.event.issue.labels.*.name, 'paused') }}\n"));
      assert.ok(text.includes("permissions:\n  issues: write\n\n"));
    });
  }
}

ClearWorkLabelsTests.register();
