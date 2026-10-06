/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type GitHubApi from "../repository/github-api.ts";
import GitHubJson from "../repository/github-json.ts";
import FlakyIssueFiler from "./flaky-issue-filer.ts";

export default class FlakyWeek {
  private static readonly DAYS: number = 7;
  private static readonly DAY_MILLISECONDS: number = 86_400_000;
  private static readonly OCCURRENCE: RegExp = new RegExp(`${FlakyWeek.escape(FlakyIssueFiler.OCCURRENCE_MARKER)}(.*?)${FlakyWeek.escape(FlakyIssueFiler.MARKER_END)}`, "g");
  private static readonly TARGET_SEPARATOR: string = ", ";
  private static readonly NONE: string = "No test was flaky in the last seven days.";

  private readonly api: GitHubApi;
  private readonly now: Date;

  public constructor(api: GitHubApi, now: Date) {
    this.api = api;
    this.now = now;
  }

  public async summarizeAsync(): Promise<string> {
    const since = new Date(this.now.getTime() - FlakyWeek.DAYS * FlakyWeek.DAY_MILLISECONDS);
    const texts: string[] = [];
    const issues = (await this.api.readPagesAsync(`/issues?labels=bug&state=all&since=${since.toISOString()}&per_page=100`)).map((t, index) => GitHubJson.object(t, `issues[${index}]`))
      .filter(t => !("pull_request" in t));
    for (const issue of issues) {
      if (GitHubJson.date(issue, "created_at", "issue") >= since)
        texts.push(GitHubJson.nullableText(issue, "body", "issue") ?? "");
      const comments = await this.api.readPagesAsync(`/issues/${GitHubJson.number(issue, "number", "issue")}/comments?since=${since.toISOString()}&per_page=100`);
      texts.push(...comments.map((t, index) => GitHubJson.object(t, `comments[${index}]`)).filter(t => GitHubJson.date(t, "created_at", "comment") >= since).map(t => GitHubJson.text(t, "body", "comment")));
    }
    const tests = new Map<string, number>();
    const targets = new Map<string, number>();
    for (const occurrence of texts.flatMap(t => FlakyWeek.readOccurrences(t))) {
      tests.set(occurrence.name, (tests.get(occurrence.name) ?? 0) + 1);
      for (const target of new Set(occurrence.jobs.map(t => t.split(FlakyWeek.TARGET_SEPARATOR, 1).join(""))))
        targets.set(target, (targets.get(target) ?? 0) + 1);
    }
    if (tests.size === 0)
      return `### Flaky tests in the last seven days\n\n${FlakyWeek.NONE}\n`;
    return [
      "### Flaky tests in the last seven days",
      "",
      "| Test | Times flaky |",
      "|---|---|",
      ...FlakyWeek.rows(tests),
      "",
      "| Target | Times flaky |",
      "|---|---|",
      ...FlakyWeek.rows(targets),
      ""
    ].join("\n");
  }

  private static readOccurrences(text: string): readonly { name: string; jobs: readonly string[] }[] {
    return [...text.matchAll(FlakyWeek.OCCURRENCE)].flatMap(t => {
      try {
        const value: unknown = JSON.parse(String(t[1]));
        const fields = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
        const jobs = fields["jobs"];
        return typeof fields["name"] === "string" && Array.isArray(jobs) && jobs.every(u => typeof u === "string") ? [{ name: fields["name"], jobs: jobs as string[] }] : [];
      }
      catch {
        return [];
      }
    });
  }

  private static rows(counts: ReadonlyMap<string, number>): readonly string[] {
    return [...counts].sort(([firstName, first], [secondName, second]) => second - first || firstName.localeCompare(secondName)).map(([name, count]) => `| ${FlakyWeek.cell(name)} | ${count} |`);
  }

  private static cell(text: string): string {
    return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("|", "&#124;").replaceAll("`", "&#96;").replaceAll("@", "&#64;").replaceAll("\n", " ");
  }

  private static escape(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
