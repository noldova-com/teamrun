/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";

import type FlakyTest from "../checks/flaky-test.ts";
import type GitHubApi from "../repository/github-api.ts";
import GitHubException from "../repository/github.exception.ts";
import GitHubJson from "../repository/github-json.ts";
import FlakyFilingException from "./flaky-filing.exception.ts";
import type FlakyOccurrence from "./flaky-occurrence.ts";
import type FlakyRedactor from "./flaky-redactor.ts";

export default class FlakyIssueFiler {
  public static readonly MAXIMUM_ISSUES: number = 10;
  public static readonly MANY_TESTS_TITLE: string = "Flaky: more than ten tests in one run";
  public static readonly OCCURRENCE_MARKER: string = "<!-- flaky-occurrence: ";
  public static readonly MARKER_END: string = " -->";

  private static readonly KEY_MARKER: string = "<!-- flaky-test: ";
  private static readonly OPEN_BUGS: string = "/issues?state=open&labels=bug&per_page=100";
  private static readonly MILESTONES: string = "/milestones?state=open&per_page=100";
  private static readonly MILESTONE: string = "Shell";
  private static readonly ISSUES: string = "/issues";
  private static readonly LABEL: string = "bug";
  private static readonly TITLE_PREFIX: string = "Flaky: ";
  private static readonly MAXIMUM_TITLE_LENGTH: number = 256;
  private static readonly ELLIPSIS: string = "…";
  private static readonly FIX_MILLISECONDS: number = 24 * 3_600_000;
  private static readonly WORD_CHARACTER: RegExp = /[\p{L}\p{N}_]/u;
  private static readonly BACKTICK: string = "`";
  private static readonly NEUTRAL_BACKTICK: string = String.fromCodePoint(0x2cb);
  private static readonly MENTION: string = "@";
  private static readonly NEUTRAL_MENTION: string = `@${String.fromCodePoint(0x200b)}`;
  private static readonly FENCE: string = "```text";
  private static readonly FENCE_END: string = "```";

  private readonly api: GitHubApi;
  private readonly repository: string;
  private readonly runUrl: string;
  private readonly redactor: FlakyRedactor;
  private readonly now: Date;

  public constructor(api: GitHubApi, repository: string, runUrl: string, redactor: FlakyRedactor, now: Date) {
    this.api = api;
    this.repository = repository;
    this.runUrl = runUrl;
    this.redactor = redactor;
    this.now = now;
  }

  public static keyOf(test: FlakyTest): string {
    return createHash("sha256").update(JSON.stringify([test.runner, test.file, test.name])).digest("hex");
  }

  public static titleOf(name: string): string {
    const title = `${FlakyIssueFiler.TITLE_PREFIX}${name}`;
    return title.length <= FlakyIssueFiler.MAXIMUM_TITLE_LENGTH ? title : `${title.slice(0, FlakyIssueFiler.MAXIMUM_TITLE_LENGTH - 1)}${FlakyIssueFiler.ELLIPSIS}`;
  }

  public static names(text: string, name: string): boolean {
    for (let index = text.indexOf(name); index >= 0; index = text.indexOf(name, index + 1))
      if (!FlakyIssueFiler.WORD_CHARACTER.test(text.charAt(index - 1)) && !FlakyIssueFiler.WORD_CHARACTER.test(text.charAt(index + name.length)))
        return true;
    return false;
  }

  public static formatOccurrence(name: string, jobs: readonly string[]): string {
    const value = JSON.stringify({ name, jobs }).replaceAll(">", "\\u003e").replaceAll("@", "\\u0040");
    return `${FlakyIssueFiler.OCCURRENCE_MARKER}${value}${FlakyIssueFiler.MARKER_END}`;
  }

  public async fileAsync(occurrences: readonly FlakyOccurrence[]): Promise<readonly string[]> {
    const lines: string[] = [];
    try {
      const open = await this.readOpenAsync();
      const milestone = await this.readMilestoneAsync();
      if (occurrences.length > FlakyIssueFiler.MAXIMUM_ISSUES) {
        const existing = open.find(t => t.title === FlakyIssueFiler.MANY_TESTS_TITLE);
        const outcome = existing === undefined
          ? await this.openAsync(FlakyIssueFiler.MANY_TESTS_TITLE, this.describeMany(occurrences), milestone)
          : await this.commentAsync(existing.number, this.describeManyAgain(occurrences));
        lines.push(`- ${occurrences.length} flaky tests, too many for an issue each: ${outcome}`);
      }
      else
        for (const occurrence of occurrences)
          lines.push(`- ${occurrence.test.name}: ${await this.fileOneAsync(open, milestone, occurrence)}`);
    }
    catch (error) {
      if (!(error instanceof GitHubException))
        throw error;
      throw new FlakyFilingException(lines, error);
    }
    return lines;
  }

  private async readOpenAsync(): Promise<readonly { number: number; title: string; body: string }[]> {
    return (await this.api.readPagesAsync(FlakyIssueFiler.OPEN_BUGS)).map((t, index) => GitHubJson.object(t, `issues[${index}]`))
      .filter(t => !("pull_request" in t))
      .map(t => ({ number: GitHubJson.number(t, "number", "issue"), title: GitHubJson.text(t, "title", "issue"), body: GitHubJson.nullableText(t, "body", "issue") ?? "" }));
  }

  private async readMilestoneAsync(): Promise<number | null> {
    const milestone = (await this.api.readPagesAsync(FlakyIssueFiler.MILESTONES)).map((t, index) => GitHubJson.object(t, `milestones[${index}]`))
      .find(t => GitHubJson.text(t, "title", "milestone") === FlakyIssueFiler.MILESTONE);
    return milestone === undefined ? null : GitHubJson.number(milestone, "number", "milestone");
  }

  private async fileOneAsync(open: readonly { number: number; title: string; body: string }[], milestone: number | null, occurrence: FlakyOccurrence): Promise<string> {
    const key = `${FlakyIssueFiler.KEY_MARKER}${FlakyIssueFiler.keyOf(occurrence.test)}${FlakyIssueFiler.MARKER_END}`;
    const existing = open.find(t => t.body.includes(key)) ?? open.find(t => FlakyIssueFiler.names(t.title, occurrence.test.name));
    return existing === undefined
      ? await this.openAsync(FlakyIssueFiler.titleOf(occurrence.test.name), this.describe(key, occurrence), milestone)
      : await this.commentAsync(existing.number, this.describeAgain(occurrence));
  }

  private async openAsync(title: string, body: string, milestone: number | null): Promise<string> {
    const created = GitHubJson.object(await this.api.sendAsync("POST", FlakyIssueFiler.ISSUES, [["title", title], ["body", body], ["labels[]", FlakyIssueFiler.LABEL]],
      milestone === null ? [] : [["milestone", milestone]]), "issue");
    return `opened #${GitHubJson.number(created, "number", "issue")}`;
  }

  private async commentAsync(issue: number, body: string): Promise<string> {
    await this.api.writeAsync("POST", `${FlakyIssueFiler.ISSUES}/${issue}/comments`, body);
    return `commented on #${issue}`;
  }

  private describe(key: string, { test, jobs }: FlakyOccurrence): string {
    return [
      key,
      `This test failed and then passed when it ran again in the same job, so it is flaky. A flaky test is a bug: see [Flakiness and races](https://github.com/${this.repository}/blob/main/docs/TESTING.md#flakiness-and-races). Its fix is due within 24 hours, by ${new Date(this.now.getTime() + FlakyIssueFiler.FIX_MILLISECONDS).toISOString()}.`,
      "",
      `- **Runner:** ${test.runner}`,
      `- **File:** ${FlakyIssueFiler.neutralize(test.file)}`,
      `- **Jobs:** ${jobs.join(", ")}`,
      `- **Run:** ${this.runUrl}`,
      "",
      "Test:",
      "",
      ...FlakyIssueFiler.fence(test.name),
      "",
      "First failure:",
      "",
      ...FlakyIssueFiler.fence(this.redactor.redact(test.failure)),
      "",
      "Later runs where it is flaky again comment on this issue.",
      FlakyIssueFiler.formatOccurrence(test.name, jobs)
    ].join("\n");
  }

  private describeAgain({ test, jobs }: FlakyOccurrence): string {
    return [
      `It was flaky again in ${this.runUrl}, in ${jobs.join(", ")}.`,
      "",
      "First failure:",
      "",
      ...FlakyIssueFiler.fence(this.redactor.redact(test.failure)),
      FlakyIssueFiler.formatOccurrence(test.name, jobs)
    ].join("\n");
  }

  private describeMany(occurrences: readonly FlakyOccurrence[]): string {
    return [
      `The run ${this.runUrl} had ${occurrences.length} flaky tests, more than the ${FlakyIssueFiler.MAXIMUM_ISSUES} it files one at a time, so they share this issue:`,
      "",
      ...FlakyIssueFiler.list(occurrences),
      "",
      "Later runs with that many flaky tests comment on this issue."
    ].join("\n");
  }

  private describeManyAgain(occurrences: readonly FlakyOccurrence[]): string {
    return [`The run ${this.runUrl} had ${occurrences.length} flaky tests again:`, "", ...FlakyIssueFiler.list(occurrences)].join("\n");
  }

  private static list(occurrences: readonly FlakyOccurrence[]): readonly string[] {
    return [
      ...occurrences.map(t => `- ${FlakyIssueFiler.neutralize(t.test.name)} (${t.jobs.join(", ")})`),
      ...occurrences.map(t => FlakyIssueFiler.formatOccurrence(t.test.name, t.jobs))
    ];
  }

  private static fence(text: string): readonly string[] {
    return [FlakyIssueFiler.FENCE, FlakyIssueFiler.neutralize(text), FlakyIssueFiler.FENCE_END];
  }

  private static neutralize(text: string): string {
    return text.replaceAll(FlakyIssueFiler.BACKTICK, FlakyIssueFiler.NEUTRAL_BACKTICK).replaceAll(FlakyIssueFiler.MENTION, FlakyIssueFiler.NEUTRAL_MENTION);
  }
}
