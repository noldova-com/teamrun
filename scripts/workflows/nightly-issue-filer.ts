/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type GitHubApi from "../repository/github-api.ts";
import GitHubJson from "../repository/github-json.ts";
import type NightlyFinding from "./nightly-finding.ts";

export default class NightlyIssueFiler {
  public static readonly MAXIMUM_ISSUES: number = 10;

  private static readonly OPEN_BUGS: string = "/issues?state=open&labels=bug&per_page=100";
  private static readonly ISSUES: string = "/issues";
  private static readonly LABEL: string = "bug";
  private static readonly TITLE_PREFIX: string = "Nightly: ";
  private static readonly MAXIMUM_TITLE_LENGTH: number = 256;
  private static readonly ELLIPSIS: string = "…";

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
    if (findings.length > NightlyIssueFiler.MAXIMUM_ISSUES) {
      const number = await this.openAsync(`${NightlyIssueFiler.TITLE_PREFIX}${findings.length} tests and workflows failed in one run`, this.describeMany(findings));
      return [`- ${findings.length} failures, too many for an issue each: opened #${number}`];
    }
    const open = (await this.api.readPagesAsync(NightlyIssueFiler.OPEN_BUGS)).map((t, index) => GitHubJson.object(t, `issues[${index}]`))
      .filter(t => !("pull_request" in t))
      .map(t => ({ number: GitHubJson.number(t, "number", "issue"), title: GitHubJson.text(t, "title", "issue") }));
    const lines: string[] = [];
    for (const finding of findings) {
      const title = NightlyIssueFiler.titleOf(finding.failure.name);
      const existing = open.find(t => t.title === title);
      if (existing === undefined)
        lines.push(`- ${finding.failure.name}: opened #${await this.openAsync(title, this.describe(finding))}`);
      else {
        await this.api.writeAsync("POST", `${NightlyIssueFiler.ISSUES}/${existing.number}/comments`, this.describeAgain(finding));
        lines.push(`- ${finding.failure.name}: commented on #${existing.number}`);
      }
    }
    return lines;
  }

  private async openAsync(title: string, body: string): Promise<number> {
    const created = GitHubJson.object(await this.api.createAsync(NightlyIssueFiler.ISSUES, [["title", title], ["body", body], ["labels[]", NightlyIssueFiler.LABEL]]), "issue");
    return GitHubJson.number(created, "number", "issue");
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
      `    ${failure.message}`,
      "",
      `A flaky failure is a bug: see [Flakiness and races](https://github.com/${this.repository}/blob/main/docs/TESTING.md#flakiness-and-races). Later nights that fail here comment on this issue.`
    ].join("\n");
  }

  private describeAgain({ failure, labels }: NightlyFinding): string {
    return [`It failed again in the nightly run ${this.runUrl}: ${failure.count} ${failure.count === 1 ? "failure" : "failures"} in ${labels.join(", ")}.`, "", "First error:", "", `    ${failure.message}`].join("\n");
  }

  private describeMany(findings: readonly NightlyFinding[]): string {
    return [
      `The nightly run ${this.runUrl} failed in ${findings.length} tests and workflows, more than the ${NightlyIssueFiler.MAXIMUM_ISSUES} it files one at a time, so they share this issue:`,
      "",
      ...findings.map(t => `- ${t.failure.name} (${t.labels.join(", ")})`)
    ].join("\n");
  }
}
