/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IComposerDraftStore } from "../../src/app/interfaces/i-composer-draft-store";
import type { ComposerDraft } from "../../src/app/models/composer-draft";

export class MemoryDraftStore implements IComposerDraftStore {
  public readonly drafts: Map<string, ComposerDraft> = new Map();
  public failWrites: boolean = false;
  public failReads: boolean = false;
  public closed: boolean = false;

  public read(conversationId: string): Promise<ComposerDraft | null> {
    return this.failReads ? Promise.reject(new Error("read failed")) : Promise.resolve(this.drafts.get(conversationId) ?? null);
  }

  public write(draft: ComposerDraft): Promise<void> {
    if (this.failWrites)
      return Promise.reject(new Error("write failed"));
    if (draft.text.length === 0 && draft.attachments.length === 0)
      this.drafts.delete(draft.conversationId);
    else
      this.drafts.set(draft.conversationId, draft);
    return Promise.resolve();
  }

  public close(): void {
    this.closed = true;
  }

  public removeSent(draft: ComposerDraft): Promise<void> {
    const stored = this.drafts.get(draft.conversationId);
    if (stored?.text === draft.text && stored.attachments.map(t => t.id).join() === draft.attachments.map(t => t.id).join())
      this.drafts.delete(draft.conversationId);
    return Promise.resolve();
  }
}
