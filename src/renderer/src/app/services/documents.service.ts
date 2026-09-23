/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, effect, inject, untracked } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { OpenMode } from "../enums/open-mode";
import { ChatStore } from "./chat-store.service";
import { LayoutService } from "./layout.service";

@Injectable({ providedIn: "root" })
export class DocumentsService {
  private readonly store: ChatStore = inject(ChatStore);
  private readonly layout: LayoutService = inject(LayoutService);

  public constructor() {
    effect(() => {
      const conversationId = this.store.selectedConversationId();
      if (!Object.isNull(conversationId))
        untracked(() => this.layout.showDocument(conversationId));
    });
    effect(() => {
      if (!this.store.loaded())
        return;
      this.keepExistingDocuments();
    });
  }

  public show(conversationId: string): Promise<void> {
    return this.store.selectConversation(conversationId);
  }

  public async open(conversationId: string, mode: OpenMode): Promise<void> {
    const previousPreview = this.layout.previewDocument();
    this.layout.showDocument(conversationId, mode === OpenMode.DoubleClick);
    await this.store.selectConversation(conversationId);
    if (!Object.isNull(previousPreview) && !this.layout.documents().includes(previousPreview))
      this.store.forgetPosition(previousPreview);
  }

  public async keepOpen(conversationId: string): Promise<void> {
    await this.store.selectConversation(conversationId);
    this.layout.keepDocumentOpen(conversationId);
  }

  public async close(conversationId: string): Promise<void> {
    this.store.forgetPosition(conversationId);
    this.layout.closeDocument(conversationId);
    if (this.store.selectedConversationId() !== conversationId)
      return;
    const next = this.layout.activeDocument();
    if (Object.isNull(next))
      this.store.deselectConversation();
    else
      await this.store.selectConversation(next);
  }

  public closeAll(): void {
    for (const conversationId of [...this.layout.documents()]) {
      this.store.forgetPosition(conversationId);
      this.layout.closeDocument(conversationId);
    }
    this.store.deselectConversation();
  }

  public async restore(): Promise<void> {
    if (!this.store.loaded())
      return;
    this.keepExistingDocuments();
    const active = this.layout.activeDocument();
    if (!Object.isNull(active))
      await this.store.selectConversation(active);
  }

  private keepExistingDocuments(): void {
    const existing = this.store.projects().flatMap(t => this.store.conversationsOf(t.id)).map(t => t.id);
    untracked(() => this.layout.keepDocuments(existing));
  }
}
