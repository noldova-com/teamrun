/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitHubLooks } from "@noldova/git.github.window";
import { HostChanges, HostItem, HostPerson, HostReference, ReferenceKind, ReferenceState } from "@noldova/git.hosting.protocol";
import type { LinkReference } from "@noldova/ui.components.angular";

import { GitHubReferenceLink } from "../../../src/app/models/github-reference-link";
import { GitHubReferenceLooks } from "../../../src/app/services/github-reference-looks";

describe("GitHubReferenceLooks", () => {
  const openedAt = Date.parse("2026-11-01T09:30:00.000Z");
  const closedAt = Date.parse("2026-11-07T18:05:00.000Z");
  const avatar = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGNoCrgPRwzEcQC6IhsRLJyGqgAAAABJRU5ErkJggg==";
  const reference = new HostReference("git-github", "octocat", "hello-world", 42);
  const changes = new HostChanges(106, 1, 7, "monalisa/fix-greeting", "main", "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d");
  const itemOf = (kind: ReferenceKind, state: ReferenceState, author: HostPerson | null = new HostPerson("monalisa", avatar, null)): HostItem =>
    new HostItem(reference, kind, state, "Fix the greeting", `https://github.com/octocat/hello-world/${kind === ReferenceKind.Issue ? "issues" : "pull"}/42`, author,
      openedAt, state === ReferenceState.Open || state === ReferenceState.Draft ? null : closedAt, 3, kind === ReferenceKind.Issue ? null : changes);
  const lookOf = (item: HostItem): LinkReference => {
    const look = GitHubLooks.of(item.kind, item.state);
    if (look === null)
      throw new Error(`GitHub has no look for ${item.kind} ${item.state}.`);
    return GitHubReferenceLooks.of(item, look);
  };
  const shown = (chip: LinkReference): readonly unknown[] =>
    [chip.reference, chip.kind, chip.state?.label ?? null, chip.icon.url, chip.icon.isMonochrome, chip.mark?.url ?? null, chip.title, chip.location];
  const kinds: readonly (readonly [ReferenceKind, ReferenceState, string, string])[] = [
    [ReferenceKind.PullRequest, ReferenceState.Open, "Pull request", "Open"],
    [ReferenceKind.PullRequest, ReferenceState.Draft, "Pull request", "Draft"],
    [ReferenceKind.PullRequest, ReferenceState.Merged, "Pull request", "Merged"],
    [ReferenceKind.PullRequest, ReferenceState.Closed, "Pull request", "Closed"],
    [ReferenceKind.Issue, ReferenceState.Open, "Issue", "Open"],
    [ReferenceKind.Issue, ReferenceState.ClosedDone, "Issue", "Closed"],
    [ReferenceKind.Issue, ReferenceState.ClosedNotPlanned, "Issue", "Closed"]
  ];

  it("draws each kind in each state with GitHub's mark, the state's label, icon and colours in both modes, and the item's title and place", () => {
    const chips = kinds.map(([kind, state]) => lookOf(itemOf(kind, state)));

    expect(chips.map(shown)).toEqual(kinds.map(([kind, state, kindLabel, stateLabel]) => ["octocat/hello-world#42", kindLabel, stateLabel,
      GitHubLooks.of(kind, state)?.icon, true, GitHubLooks.mark, "Fix the greeting", "octocat/hello-world #42"]));
    expect(chips.map(t => [t.state?.light.color, t.state?.light.background, t.state?.dark.color, t.state?.dark.background])).toEqual(kinds.map(([kind, state]) => {
      const look = GitHubLooks.of(kind, state);
      return [look?.light.color, look?.light.background, look?.dark.color, look?.dark.background];
    }));
    expect(new Set(chips.map(t => t.icon.url)).size).toBe(7);
    expect(chips.filter(t => t.state?.light.color === "#8250DF").map(t => [t.kind, t.state?.label, t.state?.dark.color]))
      .toEqual([["Pull request", "Merged", "#A371F7"], ["Issue", "Closed", "#A371F7"]]);
  });

  it("gives a pull request's card its lines and files and no comment count, and an issue's card its comments and no lines", () => {
    const pull = lookOf(itemOf(ReferenceKind.PullRequest, ReferenceState.Open));
    const issue = lookOf(itemOf(ReferenceKind.Issue, ReferenceState.Open));

    expect([pull.diff?.added, pull.diff?.removed, pull.diff?.files, pull.comments]).toEqual([106, 1, 7, null]);
    expect([issue.diff, issue.comments]).toEqual([null, 3]);
    expect([pull.time?.toISOString(), pull.author?.name, pull.author?.image]).toEqual(["2026-11-01T09:30:00.000Z", "monalisa", avatar]);
  });

  it("dates a merged or closed item by when it was merged or closed, and an open or draft one by when it was opened", () => {
    expect(kinds.map(([kind, state]) => lookOf(itemOf(kind, state)).time?.toISOString())).toEqual(kinds.map(([, state]) =>
      state === ReferenceState.Open || state === ReferenceState.Draft ? "2026-11-01T09:30:00.000Z" : "2026-11-07T18:05:00.000Z"));
  });

  it("names an author GitHub has no picture of by their login alone, and leaves the author out when GitHub no longer knows them", () => {
    const pictureless = lookOf(itemOf(ReferenceKind.Issue, ReferenceState.Open, new HostPerson("octocat", null, null)));
    const gone = lookOf(itemOf(ReferenceKind.Issue, ReferenceState.Open, null));

    expect([pictureless.author?.name, pictureless.author?.image, gone.author]).toEqual(["octocat", null, null]);
  });

  it("gives each card part of a pull request its own GitHub page: the item, the repository, the author and the changed files, and no comments page", () => {
    const pull = lookOf(itemOf(ReferenceKind.PullRequest, ReferenceState.Merged));

    expect([pull.itemHref, pull.locationHref, pull.authorHref, pull.diffHref, pull.commentsHref]).toEqual(["https://github.com/octocat/hello-world/pull/42",
      "https://github.com/octocat/hello-world", "https://github.com/monalisa", "https://github.com/octocat/hello-world/pull/42/files", null]);
  });

  it("gives each card part of an issue its own GitHub page: the item, the repository, the author and its comments, and no changed files", () => {
    const issue = lookOf(itemOf(ReferenceKind.Issue, ReferenceState.ClosedNotPlanned));

    expect([issue.itemHref, issue.locationHref, issue.authorHref, issue.diffHref, issue.commentsHref]).toEqual(["https://github.com/octocat/hello-world/issues/42",
      "https://github.com/octocat/hello-world", "https://github.com/monalisa", null, "https://github.com/octocat/hello-world/issues/42"]);
  });

  it("takes the item's page from GitHub's answer, not from the reference, and links a [bot] author with no profile page to its app's page", () => {
    const moved = new HostItem(reference, ReferenceKind.Issue, ReferenceState.Open, "Fix the greeting", "https://github.com/octo-org/greetings/issues/9",
      new HostPerson("greeting-helper[bot]", null, null), openedAt, null, 3, null);

    const chip = lookOf(moved);

    expect([chip.itemHref, chip.commentsHref, chip.authorHref, chip.locationHref]).toEqual(["https://github.com/octo-org/greetings/issues/9",
      "https://github.com/octo-org/greetings/issues/9", "https://github.com/apps/greeting-helper", "https://github.com/octocat/hello-world"]);
  });

  it("links the author's profile page as GitHub gives it, for an app whose login has no [bot] suffix and for a person", () => {
    const app = new HostPerson("greeting-helper", avatar, "https://github.com/apps/greeting-helper");
    const person = new HostPerson("monalisa", avatar, "https://github.com/monalisa-profile");

    expect([app, person].map(t => lookOf(itemOf(ReferenceKind.PullRequest, ReferenceState.Open, t)).authorHref))
      .toEqual(["https://github.com/apps/greeting-helper", "https://github.com/monalisa-profile"]);
  });

  it("leaves the author's part without a page when GitHub no longer knows the author", () => {
    expect(lookOf(itemOf(ReferenceKind.PullRequest, ReferenceState.Open, null)).authorHref).toBeNull();
  });

  it("draws an item still being read with its reference, its kind's icon, GitHub's mark and no state, title or card parts", () => {
    const look = GitHubLooks.of(ReferenceKind.PullRequest, ReferenceState.Open);
    if (look === null)
      throw new Error("GitHub has no look for an open pull request.");

    const pending = GitHubReferenceLooks.pendingOf(new GitHubReferenceLink(reference, ReferenceKind.PullRequest), look);

    expect([...shown(pending), pending.author, pending.time, pending.diff, pending.comments])
      .toEqual(["octocat/hello-world#42", "Pull request", null, look.icon, true, GitHubLooks.mark, null, null, null, null, null, null]);
    expect([pending.itemHref, pending.locationHref, pending.authorHref, pending.diffHref, pending.commentsHref]).toEqual([null, null, null, null, null]);
  });
});
