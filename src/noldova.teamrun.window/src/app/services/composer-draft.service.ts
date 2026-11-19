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
  private readonly arrivals: Map<string, number> = new Map();
  private readonly staleWatchers: Set<(conversationId: string) => void> = new Set();
  private latest: ComposerDraft | null = null;
  private cancelSave: (() => void) | null = null;
  private writing: Promise<boolean> = Promise.resolve(true);

  public async restore(conversationId: string): Promise<Draft | null> {
    this.unread.add(conversationId);
    await this.flush();
    const draft = await this.store.readDraft(conversationId);
    this.unread.delete(conversationId);
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
    this.latest = draft;
    this.cancelSave ??= this.clock.after(this.saveInterval, () => void this.flush());
  }

  public flush(): Promise<boolean> {
    this.cancelSave?.();
    this.cancelSave = null;
    const draft = this.latest;
    this.latest = null;
    this.writing = this.writing.then(() => Object.isNull(draft) ? true : this.write(draft));
    return this.writing;
  }

  public async save(): Promise<void> {
    if (!await this.flush())
      throw new DraftNotSavedException();
  }

  public drop(conversationId: string): void {
    if (this.latest?.conversationId === conversationId)
      this.latest = null;
  }

  public arrivalsOf(conversationId: string): number {
    return this.arrivals.get(conversationId) ?? 0;
  }

  public async discard(conversationId: string, arrivals: number = this.arrivalsOf(conversationId)): Promise<void> {
    if (this.latest?.conversationId === conversationId)
      this.latest = null;
    await this.writing;
    const revision = this.revisions.get(conversationId);
    if (!Object.isUndefined(revision) && arrivals === this.arrivalsOf(conversationId) && await this.store.discardDraft(conversationId, revision))
      this.revisions.delete(conversationId);
  }

  private async write(draft: ComposerDraft): Promise<boolean> {
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
      this.revisions.delete(draft.conversationId);
      this.arrive(draft.conversationId);
      this.drop(draft.conversationId);
      for (const watcher of this.staleWatchers)
        watcher(draft.conversationId);
      return true;
    }
    finally {
      for (const file of prepared)
        await this.store.discardAttachment(file);
    }
    if (Object.isNull(saved) && this.store.isDeleted(draft.conversationId))
      return true;
    if (Object.isNull(saved)) {
      this.latest ??= draft;
      return false;
    }
    this.revisions.set(draft.conversationId, saved.revision);
    draft.attachments.forEach((t, index) => t.markSaved(saved.attachments[index]!));
    return true;
  }

  private arrive(conversationId: string): void {
    this.arrivals.set(conversationId, this.arrivalsOf(conversationId) + 1);
  }
}
