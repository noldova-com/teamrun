/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { InjectionToken, Injectable, inject } from "@angular/core";

import "@noldova/context.core";
import { AttachmentInput, type Draft, type MessageAttachment } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { DraftNotSavedException } from "../exceptions/draft-not-saved.exception";
import { DraftStaleException } from "../exceptions/draft-stale.exception";
import type { ComposerDraft } from "../models/composer-draft";
import { ChatStoreService } from "./chat-store.service";
import { ClockService } from "./clock.service";

@Injectable()
export class ComposerDraftService {
  public static readonly interval: InjectionToken<number> = new InjectionToken<number>(Resources.draftSaveIntervalToken,
    { providedIn: "root", factory: () => Resources.draftSaveInterval });

  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly clock: ClockService = inject(ClockService);
  private readonly saveInterval: number = inject(ComposerDraftService.interval);
  private readonly revisions: Map<string, number> = new Map();
  private readonly unread: Set<string> = new Set();
  private readonly unreadable: Set<string> = new Set();
  private readonly arrivals: Map<string, number> = new Map();
  private readonly staleWatchers: Set<(conversationId: string) => void> = new Set();
  private readonly pending: Map<string, ComposerDraft> = new Map();
  private cancelSave: (() => void) | null = null;
  private writing: Promise<boolean> = Promise.resolve(true);

  public async restore(conversationId: string): Promise<Draft | null> {
    this.unread.add(conversationId);
    let draft: Draft | null;
    try {
      await this.flush();
      draft = await this.store.readDraft(conversationId).catch((error: unknown) => {
        this.unreadable.add(conversationId);
        throw error;
      });
    }
    finally {
      this.unread.delete(conversationId);
    }
    this.unreadable.delete(conversationId);
    this.arrive(conversationId);
    if (Object.isNull(draft))
      this.revisions.delete(conversationId);
    else
      this.revisions.set(conversationId, draft.revision);
    return draft;
  }

  public onStale(watcher: (conversationId: string) => void): () => void {
    this.staleWatchers.add(watcher);
    return () => void this.staleWatchers.delete(watcher);
  }

  public schedule(draft: ComposerDraft): void {
    if (this.unread.has(draft.conversationId))
      return;
    this.pending.set(draft.conversationId, draft);
    this.cancelSave ??= this.clock.after(this.saveInterval, () => void this.flush());
  }

  public flush(): Promise<boolean> {
    this.cancelSave?.();
    this.cancelSave = null;
    const drafts = [...this.pending.values()];
    this.pending.clear();
    this.writing = this.writing.then(() => this.writeAll(drafts));
    return this.writing;
  }

  public async save(): Promise<void> {
    if (!await this.flush())
      throw new DraftNotSavedException();
  }

  public drop(conversationId: string): void {
    this.pending.delete(conversationId);
  }

  public arrivalsOf(conversationId: string): number {
    return this.arrivals.get(conversationId) ?? 0;
  }

  public async discard(conversationId: string, arrivals: number = this.arrivalsOf(conversationId)): Promise<void> {
    this.pending.delete(conversationId);
    await this.writing;
    const revision = this.revisions.get(conversationId);
    if (!Object.isUndefined(revision) && arrivals === this.arrivalsOf(conversationId) && await this.store.discardDraft(conversationId, revision))
      this.revisions.delete(conversationId);
  }

  private async writeAll(drafts: readonly ComposerDraft[]): Promise<boolean> {
    let isSaved = true;
    for (const draft of drafts)
      isSaved = await this.write(draft) && isSaved;
    return isSaved;
  }

  private async write(draft: ComposerDraft): Promise<boolean> {
    if (this.unreadable.has(draft.conversationId)) {
      let kept: Draft | null;
      try {
        kept = await this.store.readDraft(draft.conversationId);
      }
      catch {
        if (this.store.isDeleted(draft.conversationId)) {
          this.unreadable.delete(draft.conversationId);
          return true;
        }
        this.keep(draft);
        return false;
      }
      this.unreadable.delete(draft.conversationId);
      if (!Object.isNull(kept)) {
        this.yieldTo(draft.conversationId);
        return true;
      }
      this.revisions.delete(draft.conversationId);
    }
    const prepared: MessageAttachment[] = [];
    const grant = (file: File): Promise<string> => this.store.grantFile(file);
    let saved: Draft | null;
    try {
      saved = await this.store.saveDraft(draft.conversationId, () => draft.toParams(async attachment => {
        if (attachment.isSaved)
          return attachment.toInput(grant);
        const file = await this.store.prepareAttachment(await attachment.toInput(grant));
        prepared.push(file);
        return new AttachmentInput(file.name, file.mediaType, null, file.path);
      }, this.revisions.get(draft.conversationId) ?? 0));
    }
    catch (error) {
      if (!(error instanceof DraftStaleException))
        throw error;
      this.yieldTo(draft.conversationId);
      return true;
    }
    finally {
      for (const file of prepared)
        await this.store.discardAttachment(file);
    }
    if (Object.isNull(saved) && this.store.isDeleted(draft.conversationId))
      return true;
    if (Object.isNull(saved)) {
      this.keep(draft);
      return false;
    }
    this.revisions.set(draft.conversationId, saved.revision);
    draft.attachments.forEach((t, index) => t.markSaved(saved.attachments[index]!));
    return true;
  }

  private keep(draft: ComposerDraft): void {
    if (!this.pending.has(draft.conversationId))
      this.pending.set(draft.conversationId, draft);
  }

  private yieldTo(conversationId: string): void {
    this.revisions.delete(conversationId);
    this.arrive(conversationId);
    this.drop(conversationId);
    for (const watcher of this.staleWatchers)
      watcher(conversationId);
  }

  private arrive(conversationId: string): void {
    this.arrivals.set(conversationId, this.arrivalsOf(conversationId) + 1);
  }
}
