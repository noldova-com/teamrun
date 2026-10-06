/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type GitHubApi from "../repository/github-api.ts";
import GitHubException from "../repository/github.exception.ts";
import GitHubJson from "../repository/github-json.ts";
import type IOpenIssue from "./interfaces/i-open-issue.ts";
import NightlyFilingException from "./nightly-filing.exception.ts";
import type NightlyFinding from "./nightly-finding.ts";

export default class NightlyIssueFiler {
  public static readonly MAXIMUM_ISSUES: number = 10;
  public static readonly MANY_FAILURES_TITLE: string = "Nightly: more than ten failures";

  private static readonly OPEN_BUGS: string = "/issues?state=open&labels=bug&per_page=100";
  private static readonly ISSUES: string = "/issues";
  private static readonly LABEL: string = "bug";
  private static readonly AUTHOR: string = "github-actions[bot]";
  private static readonly TITLE_PREFIX: string = "Nightly: ";
  private static readonly MAXIMUM_TITLE_LENGTH: number = 256;
  private static readonly ELLIPSIS: string = "…";
  private static readonly INDENT: string = "    ";

  private readonly api: GitHubApi;
  private readonly repository: string;
  private readonly runUrl: string;

  public constructor(api: GitHubApi, repository: string, runUrl: string) {
    this.api = api;
    this.repository = repository;
    this.runUrl = runUrl;
  }

  public static titleOf(name: string): string {
    const title = `${NightlyIssueFiler.TITLE_PREFIX}${name}`;
    return title.length <= NightlyIssueFiler.MAXIMUM_TITLE_LENGTH ? title : `${title.slice(0, NightlyIssueFiler.MAXIMUM_TITLE_LENGTH - 1)}${NightlyIssueFiler.ELLIPSIS}`;
  }

  public async fileAsync(findings: readonly NightlyFinding[]): Promise<readonly string[]> {
    const lines: string[] = [];
    try {
      const open = await this.readOpenAsync();
      if (findings.length > NightlyIssueFiler.MAXIMUM_ISSUES) {
        const outcome = await this.fileOneAsync(open, NightlyIssueFiler.MANY_FAILURES_TITLE, this.describeMany(findings), this.describeManyAgain(findings));
        lines.push(`- ${findings.length} failures, too many for an issue each: ${outcome}`);
      }
      else
        for (const finding of findings)
          lines.push(`- ${finding.failure.name}: ${await this.fileOneAsync(open, NightlyIssueFiler.titleOf(finding.failure.name), this.describe(finding), this.describeAgain(finding))}`);
    }
    catch (error) {
      if (!(error instanceof GitHubException))
        throw error;
      throw new NightlyFilingException(lines, error);
    }
    return lines;
  }

  private async readOpenAsync(): Promise<readonly IOpenIssue[]> {
    return (await this.api.readPagesAsync(NightlyIssueFiler.OPEN_BUGS)).map((t, index) => GitHubJson.object(t, `issues[${index}]`))
      .filter(t => !("pull_request" in t) && GitHubJson.text(GitHubJson.child(t, "user", "issue"), "login", "issue's author") === NightlyIssueFiler.AUTHOR)
      .map(t => ({ number: GitHubJson.number(t, "number", "issue"), title: GitHubJson.text(t, "title", "issue") }));
  }

  private async fileOneAsync(open: readonly IOpenIssue[], title: string, body: string, comment: string): Promise<string> {
    const existing = open.find(t => t.title === title);
    if (existing === undefined) {
      const created = GitHubJson.object(await this.api.createAsync(NightlyIssueFiler.ISSUES, [["title", title], ["body", body], ["labels[]", NightlyIssueFiler.LABEL]]), "issue");
      return `opened #${GitHubJson.number(created, "number", "issue")}`;
    }
    await this.api.writeAsync("POST", `${NightlyIssueFiler.ISSUES}/${existing.number}/comments`, comment);
    return `commented on #${existing.number}`;
  }

  private describe({ failure, labels }: NightlyFinding): string {
    return [
      "The nightly run, which repeats every test and UI workflow five times on every target, failed here.",
      "",
      `- **Failing:** ${failure.name}`,
      `- **Jobs:** ${labels.join(", ")}`,
      `- **Failures:** ${failure.count}`,
      `- **Run:** ${this.runUrl}`,
      "",
      "First error:",
      "",
      NightlyIssueFiler.indent(failure.message),
      "",
      `A flaky failure is a bug: see [Flakiness and races](https://github.com/${this.repository}/blob/main/docs/TESTING.md#flakiness-and-races). Later nights that fail here comment on this issue.`
    ].join("\n");
  }

  private describeAgain({ failure, labels }: NightlyFinding): string {
    return [
      `It failed again in the nightly run ${this.runUrl}: ${failure.count} ${failure.count === 1 ? "failure" : "failures"} in ${labels.join(", ")}.`,
      "",
      "First error:",
      "",
      NightlyIssueFiler.indent(failure.message)
    ].join("\n");
  }

  private describeMany(findings: readonly NightlyFinding[]): string {
    return [
      `The nightly run ${this.runUrl} failed in ${findings.length} tests and workflows, more than the ${NightlyIssueFiler.MAXIMUM_ISSUES} it files one at a time, so they share this issue:`,
      "",
      ...NightlyIssueFiler.list(findings),
      "",
      "Later nights with that many failures comment on this issue."
    ].join("\n");
  }

  private describeManyAgain(findings: readonly NightlyFinding[]): string {
    return [`It failed again in the nightly run ${this.runUrl}, in ${findings.length} tests and workflows:`, "", ...NightlyIssueFiler.list(findings)].join("\n");
  }

  private static list(findings: readonly NightlyFinding[]): readonly string[] {
    return findings.map(t => `- ${t.failure.name} (${t.labels.join(", ")})`);
  }

  private static indent(text: string): string {
    return text.split("\n").map(t => `${NightlyIssueFiler.INDENT}${t}`).join("\n");
  }
}
