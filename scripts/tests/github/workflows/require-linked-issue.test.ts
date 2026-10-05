/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import CommandDoublesFixture from "../../fixtures/command-doubles.fixture.ts";
import WorkflowFileFixture from "../../fixtures/workflow-file.fixture.ts";

class RequireLinkedIssueTests {
  private static readonly SCRIPT_TIMEOUT: number = 30_000;
  private static readonly REPOSITORY: string = "noldova-com/teamrun";
  private static readonly PULL_REQUEST: string = "7";
  private static readonly API_VERSION: string = "-H X-GitHub-Api-Version: 2026-03-10";
  private static readonly BODY_FILTER: string = "--jq (.body // \"\") | gsub(\"(?s)<!--.*?(-->|$)\"; \"\")";
  private static readonly OLD_BASH: string | false = CommandDoublesFixture.readBashMajorVersion() < 4
    ? "The workflow runs this script on Ubuntu with Bash 5; this host's Bash is older than 4 and lacks its case conversion."
    : false;
  private static readonly ISSUE_FILTER: string = "--jq if type == \"object\" and (has(\"pull_request\") | not) then .url else \"\" end";

  public static register(): void {
    test("every accepted form of a standalone tracking-issue line passes when it names an issue of this repository", { skip: RequireLinkedIssueTests.OLD_BASH, timeout: RequireLinkedIssueTests.SCRIPT_TIMEOUT }, async t => {
      for (const body of ["Issue: #12", "Issue #12", "issue:#12", "Closes #12", "FIXES: #12", "resolved #12", "Summary\r\n\r\nCloses #12\r\n", "Issue: #12\nCloses #13"]) {
        const result = await RequireLinkedIssueTests.runAsync(t, body, "12", `https://api.github.com/repos/${RequireLinkedIssueTests.REPOSITORY}/issues/12`);

        assert.equal(result.status, 0, `${JSON.stringify(body)}: ${result.stdout}${result.stderr}`);
        assert.equal(result.stdout, "Verified tracking issue #12.\n");
      }
    });

    test("a description without a standalone tracking-issue line fails before looking up an issue", { skip: RequireLinkedIssueTests.OLD_BASH, timeout: RequireLinkedIssueTests.SCRIPT_TIMEOUT }, async t => {
      for (const body of ["", "See #12", "Closes #12 and more", "Closes #0", "Issue: #", "Closes noldova-com/teamrun#12", "Does not close: #12."]) {
        const result = await RequireLinkedIssueTests.runAsync(t, body, null, "");

        assert.equal(result.status, 1, JSON.stringify(body));
        assert.match(result.stdout, /^::error::Add a standalone Issue #123/);
      }
    });

    test("a reference to a pull request, a transferred issue or an unreadable issue fails", { skip: RequireLinkedIssueTests.OLD_BASH, timeout: RequireLinkedIssueTests.SCRIPT_TIMEOUT }, async t => {
      const pullRequest = await RequireLinkedIssueTests.runAsync(t, "Closes #12", "12", "");
      const transferred = await RequireLinkedIssueTests.runAsync(t, "Closes #12", "12", "https://api.github.com/repos/someone/else/issues/40");
      const unreadable = await RequireLinkedIssueTests.runAsync(t, "Closes #12", "12", "", 1);

      assert.equal(pullRequest.status, 1);
      assert.match(pullRequest.stdout, /^::error::The reference must identify an issue in this repository/);
      assert.equal(transferred.status, 1);
      assert.match(transferred.stdout, /^::error::The reference must identify an issue in this repository/);
      assert.equal(unreadable.status, 1);
      assert.match(unreadable.stdout, /^::error::Could not verify the tracking issue/);
    });

    test("an unreadable pull request description fails", { skip: RequireLinkedIssueTests.OLD_BASH, timeout: RequireLinkedIssueTests.SCRIPT_TIMEOUT }, async t => {
      const doubles = await RequireLinkedIssueTests.createDoublesAsync(t);
      doubles.respond("gh", RequireLinkedIssueTests.formatCall("pulls", RequireLinkedIssueTests.PULL_REQUEST, RequireLinkedIssueTests.BODY_FILTER), "", 1);

      const result = await RequireLinkedIssueTests.runScriptAsync(doubles);

      assert.equal(result.status, 1);
      assert.match(result.stdout, /^::error::Could not read the PR description from GitHub\./);
    });

    test("the check reads the pull request with read-only permissions and runs for every change to its description", async () => {
      const text = (await WorkflowFileFixture.readAsync("require-linked-issue.yml")).text;
      assert.ok(text.includes("  pull_request:\n    branches: [main]\n    types: [opened, edited, synchronize, reopened, ready_for_review]\n"));
      assert.ok(text.includes("permissions:\n  issues: read\n  pull-requests: read\n"));
      assert.doesNotMatch(text, /: write|actions\/checkout/);
      assert.ok(text.includes("    name: Require linked issue\n"));
    });

    test("no workflow runs on pull_request_target", async () => {
      for (const workflow of await WorkflowFileFixture.readAllAsync())
        assert.doesNotMatch(workflow.text, /^\s*pull_request_target\s*:/m);
    });
  }

  private static formatCall(kind: string, number: string, filter: string): string {
    return `api repos/${RequireLinkedIssueTests.REPOSITORY}/${kind}/${number} ${RequireLinkedIssueTests.API_VERSION} ${filter}`;
  }

  private static async createDoublesAsync(t: TestContext): Promise<CommandDoublesFixture> {
    const doubles = await CommandDoublesFixture.createAsync();
    t.after(() => doubles.disposeAsync());
    doubles.forward("timeout");
    return doubles;
  }

  private static async runScriptAsync(doubles: CommandDoublesFixture): ReturnType<CommandDoublesFixture["runAsync"]> {
    const script = (await WorkflowFileFixture.readAsync("require-linked-issue.yml")).readStepScript("Verify the tracking issue");
    return doubles.runAsync(script, {
      GH_TOKEN: "fixture-token", PR_NUMBER: RequireLinkedIssueTests.PULL_REQUEST, GITHUB_REPOSITORY: RequireLinkedIssueTests.REPOSITORY
    });
  }

  private static async runAsync(t: TestContext, body: string, issue: string | null, issueUrl: string, issueStatus: number = 0): ReturnType<CommandDoublesFixture["runAsync"]> {
    const doubles = await RequireLinkedIssueTests.createDoublesAsync(t);
    doubles.respond("gh", RequireLinkedIssueTests.formatCall("pulls", RequireLinkedIssueTests.PULL_REQUEST, RequireLinkedIssueTests.BODY_FILTER), body);
    if (issue !== null)
      doubles.respond("gh", RequireLinkedIssueTests.formatCall("issues", issue, RequireLinkedIssueTests.ISSUE_FILTER), issueUrl, issueStatus);
    return RequireLinkedIssueTests.runScriptAsync(doubles);
  }
}

RequireLinkedIssueTests.register();
