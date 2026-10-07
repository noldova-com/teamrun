/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ProcessResult from "../../processes/process-result.ts";
import GitHubException from "../../repository/github.exception.ts";
import GitHubApi from "../../repository/github-api.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";

class GitHubApiTests {
  private static readonly REPOSITORY: string = "noldova-com/teamrun";
  private static readonly GH_PATTERN: RegExp = /(^|[/\\])gh(\.exe)?$/;

  public static register(): void {
    test("a read asks the repository's endpoint and returns the parsed answer", async () => {
      const runner = new ProcessRunnerFixture([], [new ProcessResult(0, "{\"default_branch\":\"main\"}", "")]);

      assert.deepEqual(await new GitHubApi(GitHubApiTests.REPOSITORY, runner, "work").readAsync("/pulls/5"), { default_branch: "main" });

      const [command, directory, ...gitHubArguments] = runner.captured[0] ?? [];
      assert.match(command ?? "", GitHubApiTests.GH_PATTERN);
      assert.equal(directory, "work");
      assert.deepEqual(gitHubArguments, ["api", "repos/noldova-com/teamrun/pulls/5"]);
    });

    test("a paged read asks for every page and joins them", async () => {
      const runner = new ProcessRunnerFixture([], [new ProcessResult(0, "[[1,2],[3]]", "")]);

      assert.deepEqual(await new GitHubApi(GitHubApiTests.REPOSITORY, runner, "work").readPagesAsync("/pulls?state=open"), [1, 2, 3]);

      assert.deepEqual((runner.captured[0] ?? []).slice(2), ["api", "--paginate", "--slurp", "repos/noldova-com/teamrun/pulls?state=open"]);
    });

    test("a write sends the method and the text as a raw field", async () => {
      const runner = new ProcessRunnerFixture([], [new ProcessResult(0, "{}", "")]);

      await new GitHubApi(GitHubApiTests.REPOSITORY, runner, "work").writeAsync("PATCH", "/issues/comments/9", "line one\nline two");

      assert.deepEqual((runner.captured[0] ?? []).slice(2), ["api", "--method", "PATCH", "repos/noldova-com/teamrun/issues/comments/9", "--raw-field", "body=line one\nline two"]);
    });

    test("a post sends the method without a body", async () => {
      const runner = new ProcessRunnerFixture([], [new ProcessResult(0, "", "")]);

      await new GitHubApi(GitHubApiTests.REPOSITORY, runner, "work").postAsync("/actions/runs/9/cancel");

      assert.deepEqual((runner.captured[0] ?? []).slice(2), ["api", "--method", "POST", "repos/noldova-com/teamrun/actions/runs/9/cancel"]);
    });

    test("a change sends text as raw fields and flags as typed fields, a delete sends only the method, and an upload goes through gh's release upload", async () => {
      const runner = new ProcessRunnerFixture([], [new ProcessResult(0, "{\"id\":7}", ""), new ProcessResult(0, "", ""), new ProcessResult(0, "", "")]);
      const api = new GitHubApi(GitHubApiTests.REPOSITORY, runner, "work");

      assert.deepEqual(await api.sendAsync("POST", "/releases", [["tag_name", "v0.0.2"], ["body", "a=b"]], [["draft", true]]), { id: 7 });
      await api.deleteAsync("/releases/assets/9");
      await api.uploadAsync("v0.0.2", "out/TeamRun-linux-x64.AppImage");

      assert.deepEqual(runner.captured.map(t => t.slice(2)), [
        ["api", "--method", "POST", "repos/noldova-com/teamrun/releases", "--raw-field", "tag_name=v0.0.2", "--raw-field", "body=a=b", "--field", "draft=true"],
        ["api", "--method", "DELETE", "repos/noldova-com/teamrun/releases/assets/9"],
        ["release", "upload", "v0.0.2", "out/TeamRun-linux-x64.AppImage", "--repo", "noldova-com/teamrun"]
      ]);
    });

    test("a failed upload keeps the HTTP status that leads gh's message", async () => {
      const runner = new ProcessRunnerFixture([], [new ProcessResult(1, "", "HTTP 502: Bad Gateway (https://uploads.github.com/)\n")]);

      await assert.rejects(new GitHubApi(GitHubApiTests.REPOSITORY, runner, "work").uploadAsync("v0.0.2", "TeamRun-linux-x64.AppImage"),
        (error: unknown) => error instanceof GitHubException && error.status === 502);
    });

    test("a failed request keeps the HTTP status GitHub answered with, when gh names one", async () => {
      const runner = new ProcessRunnerFixture([], [
        new ProcessResult(1, "", "gh: Cannot cancel a workflow run that is completed. (HTTP 409)\n"),
        new ProcessResult(1, "", "error connecting to api.github.com\n")
      ]);
      const api = new GitHubApi(GitHubApiTests.REPOSITORY, runner, "work");

      await assert.rejects(api.postAsync("/actions/runs/9/cancel"), t => t instanceof GitHubException && t.status === 409);
      await assert.rejects(api.postAsync("/actions/runs/9/cancel"), t => t instanceof GitHubException && t.status === null);
    });

    test("an optional read returns nothing for a missing resource and passes any other failure on", async () => {
      const runner = new ProcessRunnerFixture([], [
        new ProcessResult(1, "", "gh: Not Found (HTTP 404)\n"),
        new ProcessResult(1, "", "gh: Server Error (HTTP 500)\n"),
        new ProcessResult(0, "{\"status\":\"ahead\"}", "")
      ]);
      const api = new GitHubApi(GitHubApiTests.REPOSITORY, runner, "work");

      assert.equal(await api.readOptionalAsync("/git/ref/tags/v0.0.2"), null);
      await assert.rejects(api.readOptionalAsync("/git/ref/tags/v0.0.2"), t => t instanceof GitHubException && t.status === 500);
      assert.deepEqual(await api.readOptionalAsync("/compare/a...main"), { status: "ahead" });
    });

    test("a tag is read from the references that start with its name, taking only the one that names it exactly, and is missing when none does", async () => {
      const runner = new ProcessRunnerFixture([], [
        new ProcessResult(0, JSON.stringify([{ ref: "refs/tags/v0.0.10", object: { sha: "b" } }, { ref: "refs/tags/v0.0.1", object: { sha: "a" } }]), ""),
        new ProcessResult(0, JSON.stringify([{ ref: "refs/tags/v0.0.10", object: { sha: "b" } }]), ""),
        new ProcessResult(0, "[]", "")
      ]);
      const api = new GitHubApi(GitHubApiTests.REPOSITORY, runner, "work");

      assert.deepEqual(await api.readTagAsync("v0.0.1"), { ref: "refs/tags/v0.0.1", object: { sha: "a" } });
      assert.equal(await api.readTagAsync("v0.0.1"), null);
      assert.equal(await api.readTagAsync("v0.0.1"), null);
      assert.equal(runner.captured[0]?.at(-1), "repos/noldova-com/teamrun/git/matching-refs/tags/v0.0.1");
    });

    test("a failed command and an answer that is not JSON are refused with the cause", async () => {
      const failing = new ProcessRunnerFixture([], [new ProcessResult(1, "", "HTTP 403: Resource not accessible\n")]);
      const text = new ProcessRunnerFixture([], [new ProcessResult(0, "<html>", ""), new ProcessResult(0, "<html>", "")]);

      await assert.rejects(
        new GitHubApi(GitHubApiTests.REPOSITORY, failing, "work").readAsync("/pulls/5"),
        t => t instanceof GitHubException && /^"gh api repos\/noldova-com\/teamrun\/pulls\/5" failed with exit code 1: HTTP 403: Resource not accessible$/.test(t.message));
      await assert.rejects(
        new GitHubApi(GitHubApiTests.REPOSITORY, text, "work").readAsync("/pulls/5"),
        t => t instanceof GitHubException && t.message === "GitHub's answer for /pulls/5 is not JSON." && t.cause instanceof SyntaxError);
      await assert.rejects(new GitHubApi(GitHubApiTests.REPOSITORY, text, "work").readPagesAsync("/pulls"), new GitHubException("GitHub's answer for /pulls is not JSON."));
    });

    test("pages that are not arrays are refused", async () => {
      const runner = new ProcessRunnerFixture([], [new ProcessResult(0, "{}", ""), new ProcessResult(0, "[{}]", "")]);
      const api = new GitHubApi(GitHubApiTests.REPOSITORY, runner, "work");

      await assert.rejects(api.readPagesAsync("/pulls"), new GitHubException("/pulls must be an array."));
      await assert.rejects(api.readPagesAsync("/pulls"), new GitHubException("/pulls must be an array."));
    });
  }
}

GitHubApiTests.register();
