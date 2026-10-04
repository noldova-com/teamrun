/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import GitHubConfigurationCheck from "../../checks/github-configuration-check.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class GitHubConfigurationCheckTests {
  private static readonly SHA: string = "3d3c42e5aac5ba805825da76410c181273ba90b1";

  public static register(): void {
    test("actions pinned to a full commit SHA with their release version recorded pass, also with Windows line ends, and local actions need no pin", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const sha = GitHubConfigurationCheckTests.SHA;
      await repository.writeAsync({
        ".github/workflows/build.yml": [
          "jobs:",
          "  build:",
          "    steps:",
          `      - uses: actions/checkout@${sha} # v7.0.1`,
          `        uses: "actions/cache/restore@${sha}" # 6.1.0`,
          "      - uses: ./.github/actions/prepare",
          "      - run: echo \"uses: nothing@main\"",
          ""
        ].join("\r\n"),
        ".github/ISSUE_TEMPLATE/bug.yaml": "name: Bug\n",
        "docs/workflow.yml": "uses: actions/checkout@main\n"
      });
      const output = new TextOutputFixture();

      const check = GitHubConfigurationCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "Checked 2 GitHub configuration files.\n");
      assert.equal(check.title, "GitHub configuration");
    });

    test("an action on a tag, a branch or a short SHA, or without its release version recorded, fails with its line", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        ".github/workflows/build.yml": [
          "steps:",
          "  - uses: actions/checkout@v7",
          "  - uses: actions/setup-node@main # v6",
          "  - uses: actions/cache@3d3c42e # v6.1.0",
          `  - uses: actions/upload-artifact@${GitHubConfigurationCheckTests.SHA}`,
          `  - uses: 'actions/download-artifact@${GitHubConfigurationCheckTests.SHA}'#v7`,
          `  - uses: actions/upload-pages-artifact@${GitHubConfigurationCheckTests.SHA} # latest release`,
          ""
        ].join("\n")
      });
      const output = new TextOutputFixture();

      assert.equal(await GitHubConfigurationCheckTests.createCheck(repository).runAsync(output), false);
      const unpinned = "is not pinned to a full commit SHA; CODING-STANDARDS.md section 11 requires one.";
      const unrecorded = "does not record its release version, such as # v6.1.0, in a comment after the SHA; CODING-STANDARDS.md section 11 requires one.";
      assert.equal(output.text, [
        `.github/workflows/build.yml:2: the action "actions/checkout@v7" ${unpinned}`,
        `.github/workflows/build.yml:3: the action "actions/setup-node@main" ${unpinned}`,
        `.github/workflows/build.yml:4: the action "actions/cache@3d3c42e" ${unpinned}`,
        `.github/workflows/build.yml:5: the action "actions/upload-artifact@${GitHubConfigurationCheckTests.SHA}" ${unrecorded}`,
        `.github/workflows/build.yml:6: the action "actions/download-artifact@${GitHubConfigurationCheckTests.SHA}" ${unrecorded}`,
        `.github/workflows/build.yml:7: the action "actions/upload-pages-artifact@${GitHubConfigurationCheckTests.SHA}" ${unrecorded}`,
        "Checked 1 GitHub configuration files.",
        ""
      ].join("\n"));
    });
  }

  private static createCheck(repository: RepositoryFixture): GitHubConfigurationCheck {
    const directory = repository.directory;
    return new GitHubConfigurationCheck(directory, new RepositoryFiles(directory, new Git(directory, new ProcessRunner())));
  }
}

GitHubConfigurationCheckTests.register();
