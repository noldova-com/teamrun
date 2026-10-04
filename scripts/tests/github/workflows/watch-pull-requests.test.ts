/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import WorkflowFileFixture from "../../fixtures/workflow-file.fixture.ts";

class WatchPullRequestsWorkflowTests {
  private static readonly WORKFLOW: string = "watch-pull-requests.yml";

  public static register(): void {
    test("the workflow runs on every push to main, every 15 minutes, when a build and test run completes and on request", async () => {
      const text = (await WorkflowFileFixture.readAsync(WatchPullRequestsWorkflowTests.WORKFLOW)).text;

      assert.ok(text.includes("on:\n  push:\n    branches: [main]\n  schedule:\n    - cron: '*/15 * * * *'\n  workflow_run:\n    workflows: [Build and test]\n    types: [completed]\n  workflow_dispatch:\n"));
    });

    test("the workflow reads the repository and checks, cancels runs, writes pull request comments, and holds no secret besides its own token", async () => {
      const text = (await WorkflowFileFixture.readAsync(WatchPullRequestsWorkflowTests.WORKFLOW)).text;

      assert.ok(text.includes("permissions:\n  actions: write\n  checks: read\n  contents: read\n  pull-requests: write\n\n"));
      assert.deepEqual(text.match(/^\s+\w[\w-]*: write$/gm), ["  actions: write", "  pull-requests: write"]);
      assert.deepEqual([...text.matchAll(/\$\{\{ ([^}]+) \}\}/g)].map(t => t[1] ?? "").filter(t => t.startsWith("secrets.")), []);
      assert.ok(text.includes("        env:\n          GH_TOKEN: ${{ github.token }}\n        run: node scripts/watch-pull-requests.ts\n"));
    });

    test("one run at a time checks out the whole history, to merge a pull request's head, without keeping the credentials", async () => {
      const text = (await WorkflowFileFixture.readAsync(WatchPullRequestsWorkflowTests.WORKFLOW)).text;

      assert.ok(text.includes("concurrency:\n  group: ${{ github.workflow }}\n  cancel-in-progress: false\n"));
      assert.ok(/uses: actions\/checkout@[0-9a-f]{40} # v[\d.]+\n {8}with:\n {10}persist-credentials: false\n {10}fetch-depth: 0\n/.test(text));
      assert.equal(text.split("\n").filter(t => t.includes("uses: actions/setup-node@")).length, 3);
    });
  }
}

WatchPullRequestsWorkflowTests.register();
