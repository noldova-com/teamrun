/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, Injectable, InjectionToken, PendingTasks, effect, inject, signal } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import type { IComposerDraftStore } from "../interfaces/i-composer-draft-store";
import { ComposerAttachment } from "../models/composer-attachment";
import { ComposerDraft } from "../models/composer-draft";
import { Resources } from "../resources";
import { IndexedDbDraftStore } from "./indexed-db-draft-store";

export const COMPOSER_DRAFT_STORE = new InjectionToken<IComposerDraftStore>(Resources.draftInjectionName,
  { providedIn: "root", factory: () => new IndexedDbDraftStore(globalThis.indexedDB) });

@Injectable({ providedIn: "root" })
export class ComposerDraftsService {
  private readonly storage: IComposerDraftStore = inject(COMPOSER_DRAFT_STORE);
  private readonly tasks: PendingTasks = inject(PendingTasks);
  private readonly activeId = signal<string | null>(null);
  private readonly pending: Map<string, ComposerDraft> = new Map();
  private writing: Promise<boolean> | null = null;
  private generation: number = 0;
  private requestedId: string | null = null;
  private disposed: boolean = false;

  public readonly text = signal(String.empty);
  public readonly attachments = signal<readonly ComposerAttachment[]>([]);
  public readonly loading = signal(false);
  public readonly frozen = signal(false);
  public readonly preparing = signal(false);
  public readonly error = signal<string | null>(null);

  public constructor() {
    effect(() => {
      const id = this.activeId();
      const text = this.text();
      const attachments = this.attachments();
      if (!Object.isNull(id) && !this.loading())
        this.queue(new ComposerDraft(id, text, attachments.map(t => t.toDraft())));
    });
    inject(DestroyRef).onDestroy(() => {
      this.capture();
      this.disposed = true;
      this.generation += 1;
      this.releaseAttachments();
      void this.flush().finally(() => this.storage.close());
    });
  }

  public async select(conversationId: string | null): Promise<void> {
    if (this.disposed || conversationId === this.requestedId)
      return;
    this.capture();
    this.requestedId = conversationId;
    const generation = ++this.generation;
    this.activeId.set(null);
    this.loading.set(!Object.isNull(conversationId));
    if (Object.isNull(conversationId)) {
      this.releaseAttachments();
      this.text.set(String.empty);
      await this.flush();
      return;
    }
    const done = this.tasks.add();
    try {
      await this.flush();
      if (this.pending.size > 0)
        return;
      const draft = await this.storage.read(conversationId);
      if (generation !== this.generation || this.disposed)
        return;
      this.releaseAttachments();
      this.text.set(draft?.text ?? String.empty);
      this.attachments.set(draft?.attachments.map(t => ComposerAttachment.fromDraft(t)) ?? []);
      this.activeId.set(conversationId);
      this.loading.set(false);
      this.error.set(null);
    }
    catch {
      if (generation === this.generation)
        this.error.set(Resources.draftUnreadable);
    }
    finally {
      done();
    }
  }

  public async retry(): Promise<void> {
    if (this.loading()) {
      const id = this.requestedId;
      this.requestedId = null;
      await this.select(id);
    }
    else
      await this.flush();
  }

  public isReadyFor(conversationId: string | null): boolean {
    return this.isLoadedFor(conversationId) && !this.frozen();
  }

  public isLoadedFor(conversationId: string | null): boolean {
    return !Object.isNull(conversationId) && this.activeId() === conversationId && !this.loading();
  }

  public async forget(conversationId: string): Promise<void> {
    if (this.requestedId === conversationId) {
      this.generation += 1;
      this.requestedId = null;
      this.activeId.set(null);
      this.releaseAttachments();
      this.text.set(String.empty);
      this.loading.set(false);
    }
    this.pending.set(conversationId, new ComposerDraft(conversationId, String.empty, []));
    await this.flush();
  }

  public async sent(conversationId: string, text: string, attachments: readonly ComposerAttachment[]): Promise<void> {
    const snapshot = new ComposerDraft(conversationId, text, attachments.map(t => t.toDraft()));
    await this.flush();
    try {
      await this.storage.removeSent(snapshot);
      if (this.activeId() === conversationId) {
        if (this.text() === text)
          this.text.set(String.empty);
        if (this.attachments().length === snapshot.attachments.length
          && this.attachments().every((attachment, index) => attachment.toDraft().id === snapshot.attachments[index]?.id))
          this.releaseAttachments();
      }
      await this.flush();
    }
    catch {
      this.error.set(Resources.draftSaveFailed);
    }
  }

  public flush(): Promise<boolean> {
    this.capture();
    if (!Object.isNull(this.writing))
      return this.writing;
    this.writing = Promise.resolve().then(() => this.drain()).finally(() => { this.writing = null; });
    return this.writing;
  }

  private capture(): void {
    const id = this.activeId();
    if (!Object.isNull(id) && !this.loading() && !this.disposed)
      this.pending.set(id, new ComposerDraft(id, this.text(), this.attachments().map(t => t.toDraft())));
  }

  private queue(draft: ComposerDraft): void {
    this.pending.set(draft.conversationId, draft);
    void this.flush();
  }

  private async drain(): Promise<boolean> {
    for (const [id, draft] of this.pending) {
      this.pending.delete(id);
      try {
        await this.storage.write(draft);
      }
      catch {
        if (!this.pending.has(id))
          this.pending.set(id, draft);
        this.error.set(Resources.draftSaveFailed);
        return false;
      }
    }
    if (!this.loading())
      this.error.set(null);
    return !this.loading();
  }

  private releaseAttachments(): void {
    for (const attachment of this.attachments())
      attachment.dispose();
    this.attachments.set([]);
  }
}
