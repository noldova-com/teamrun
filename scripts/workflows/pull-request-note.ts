/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type IPullRequestComment from "./interfaces/i-pull-request-comment.ts";

export default class PullRequestNote {
  private static readonly PREFIX: string = "pull-request-watch";
  private static readonly MARKER_PATTERN: RegExp = /^<!-- pull-request-watch:[a-z-]+:[0-9a-f]{40} -->/;
  private static readonly KIND_PATTERN: RegExp = /^<!-- pull-request-watch:([a-z-]+):[0-9a-f]{40} -->.*$/s;
  private static readonly HEAD_PATTERN: RegExp = /^<!-- pull-request-watch:[a-z-]+:([0-9a-f]{40}) -->.*$/s;
  private static readonly HEADING: string = "**Pull request watch:**";
  private static readonly CLEARED: string = "**Cleared:** this finding no longer applies.";

  public readonly id: number;
  public readonly kind: string;
  public readonly head: string;
  public readonly isCleared: boolean;

  private readonly body: string;

  private constructor(id: number, kind: string, head: string, body: string) {
    this.id = id;
    this.kind = kind;
    this.head = head;
    this.body = body;
    this.isCleared = body.includes(PullRequestNote.CLEARED);
  }

  public static compose(comment: IPullRequestComment, head: string): string {
    return `<!-- ${PullRequestNote.PREFIX}:${comment.kind}:${head} -->\n${PullRequestNote.HEADING} ${comment.text}`;
  }

  public static parse(id: number, body: string): PullRequestNote | null {
    return PullRequestNote.MARKER_PATTERN.test(body)
      ? new PullRequestNote(id, body.replace(PullRequestNote.KIND_PATTERN, "$1"), body.replace(PullRequestNote.HEAD_PATTERN, "$1"), body)
      : null;
  }

  public get clearedBody(): string {
    return `${this.body}\n\n${PullRequestNote.CLEARED}`;
  }

  public matches(kind: string, head: string): boolean {
    return this.kind === kind && this.head === head;
  }
}
