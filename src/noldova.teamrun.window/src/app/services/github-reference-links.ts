/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { GitHubNames } from "@noldova/git.github.protocol";
import { HostReference, ReferenceKind } from "@noldova/git.hosting.protocol";
import type { GitRemote } from "@noldova/git.protocol";
import { LinkReferenceMatch } from "@noldova/ui.components.angular";

import { Resources } from "../../resources";
import { GitHubReferenceLink } from "../models/github-reference-link";

export class GitHubReferenceLinks {
  private static readonly kinds: ReadonlyMap<string, ReferenceKind> = new Map([
    [Resources.gitHubIssuesSegment, ReferenceKind.Issue],
    [Resources.gitHubPullSegment, ReferenceKind.PullRequest]
  ]);

  public static of(url: string): GitHubReferenceLink | null {
    const address = URL.parse(url);
    if (Object.isNull(address) || address.protocol !== Resources.gitHubReferenceProtocol || address.hostname !== Resources.gitHubReferenceHost
      || address.port.length > 0 || address.username.length > 0 || address.password.length > 0)
      return null;
    const segments = address.pathname.split(Resources.slash).slice(1);
    if (segments.at(-1) === String.empty)
      segments.pop();
    const [owner = String.empty, repository = String.empty, segment = String.empty, number = String.empty, ...rest] = segments;
    const kind = GitHubReferenceLinks.kinds.get(segment);
    if (Object.isUndefined(kind) || rest.length > 0 || !Resources.gitHubOwnerPattern.test(owner)
      || !Resources.gitHubRepositoryPattern.test(repository) || !Resources.gitHubNumberPattern.test(number))
      return null;
    return new GitHubReferenceLink(new HostReference(GitHubNames.moduleId, owner, repository, Number(number)), kind);
  }

  public static inText(text: string, home: string | null = null): readonly LinkReferenceMatch[] {
    return [...text.matchAll(Resources.gitHubTextReferencePattern)].flatMap(t => {
      const reference = !t[0].startsWith(Resources.gitHubTextNumberMark) ? t[0] : Object.isNull(home) ? null : `${home}${t[0]}`;
      return Object.isNull(reference) ? [] : [new LinkReferenceMatch(t.index, t[0].length, Resources.formatGitHubTextAddress(reference))];
    });
  }

  public static homeOf(remote: GitRemote | null): string | null {
    const path = remote?.host === Resources.gitHubReferenceHost ? remote.path : null;
    return Object.isNull(path) || !Resources.gitHubHomePattern.test(path) ? null : path;
  }
}
