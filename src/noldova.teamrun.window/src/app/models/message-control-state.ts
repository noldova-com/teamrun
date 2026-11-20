/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, untracked, type WritableSignal } from "@angular/core";
import "@noldova/context.core";

import { QuestionDraft } from "./question-draft";
import { ReplyExpansion } from "./reply-expansion";

export class MessageControlState {
  private readonly wrapping: Map<number, Set<number>>;
  private readonly drafts: WritableSignal<ReadonlyMap<string, QuestionDraft>>;

  public readonly activityChoice: WritableSignal<boolean | null>;
  public readonly wakeChoice: WritableSignal<boolean | null>;
  public readonly expansion: ReplyExpansion;

  public constructor() {
    this.wrapping = new Map();
    this.drafts = signal(new Map());
    this.activityChoice = signal(null);
    this.wakeChoice = signal(null);
    this.expansion = new ReplyExpansion();
  }

  public get hasChanges(): boolean {
    return !Object.isNull(this.activityChoice()) || !Object.isNull(this.wakeChoice()) || this.expansion.hasChanges || [...this.wrapping.values()].some(t => t.size > 0)
      || [...this.drafts().values()].some(t => t.hasChanges);
  }

  public draftOf(approvalId: string): QuestionDraft | null {
    return this.drafts().get(approvalId) ?? null;
  }

  public draftFor(approvalId: string): QuestionDraft {
    const kept = untracked(() => this.drafts().get(approvalId));
    if (!Object.isUndefined(kept))
      return kept;
    const draft = new QuestionDraft();
    this.drafts.update(t => new Map(t).set(approvalId, draft));
    return draft;
  }

  public dropDraft(approvalId: string): void {
    if (untracked(() => this.drafts().has(approvalId)))
      this.drafts.update(t => {
        const kept = new Map(t);
        kept.delete(approvalId);
        return kept;
      });
  }

  public wrappingFor(sequence: number): Set<number> {
    let wrapped = this.wrapping.get(sequence);
    if (Object.isUndefined(wrapped)) {
      wrapped = new Set();
      this.wrapping.set(sequence, wrapped);
    }
    return wrapped;
  }
}
