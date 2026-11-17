/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type GitHubLook, type GitHubLookColor, GitHubLooks } from "@noldova/git.github.window";
import type { HostItem, HostPerson } from "@noldova/git.hosting.protocol";
import { LinkReference, LinkReferenceAuthor, LinkReferenceColor, LinkReferenceDiff, LinkReferenceImage, LinkReferenceState } from "@noldova/ui.components.angular";

import { Resources } from "../../resources";
import type { GitHubReferenceLink } from "../models/github-reference-link";

export class GitHubReferenceLooks {
  private static readonly mark: LinkReferenceImage = new LinkReferenceImage(GitHubLooks.mark);

  public static pendingOf(link: GitHubReferenceLink, look: GitHubLook): LinkReference {
    return new LinkReference(link.reference.text, look.kindLabel, new LinkReferenceImage(look.icon), { mark: GitHubReferenceLooks.mark });
  }

  public static of(item: HostItem, look: GitHubLook): LinkReference {
    const { reference, author, changes } = item;
    return new LinkReference(reference.text, look.kindLabel, new LinkReferenceImage(look.icon), {
      mark: GitHubReferenceLooks.mark,
      state: new LinkReferenceState(look.stateLabel, GitHubReferenceLooks.colorOf(look.light), GitHubReferenceLooks.colorOf(look.dark)),
      title: item.title,
      location: Resources.formatGitHubReferenceLocation(reference.owner, reference.repository, reference.number),
      author: Object.isNull(author) ? null : new LinkReferenceAuthor(author.login, author.avatar),
      time: new Date(item.closedAt ?? item.createdAt),
      diff: Object.isNull(changes) ? null : new LinkReferenceDiff(changes.additions, changes.deletions, changes.changedFiles),
      comments: Object.isNull(changes) ? item.comments : null,
      itemHref: item.url,
      locationHref: Resources.formatGitHubRepositoryAddress(reference.owner, reference.repository),
      authorHref: Object.isNull(author) ? null : GitHubReferenceLooks.addressOf(author),
      diffHref: Object.isNull(changes) ? null : Resources.formatGitHubPullFilesAddress(reference.owner, reference.repository, reference.number),
      commentsHref: Object.isNull(changes) ? item.url : null
    });
  }

  private static addressOf(person: HostPerson): string {
    return person.url ?? (person.login.endsWith(Resources.gitHubBotSuffix)
      ? Resources.formatGitHubAppAddress(person.login.slice(0, -Resources.gitHubBotSuffix.length))
      : Resources.formatGitHubPersonAddress(person.login));
  }

  private static colorOf(color: GitHubLookColor): LinkReferenceColor {
    return new LinkReferenceColor(color.color, color.background);
  }
}
