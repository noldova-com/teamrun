/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgComponentOutlet } from "@angular/common";
import { Component, computed, createEnvironmentInjector, DestroyRef, effect, EnvironmentInjector, inject, input, type InputSignal, type Signal, signal, type Type, untracked,
  type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { provideCodeHighlighting } from "@noldova/ui.components.angular/code-highlighting";
import { provideMarkdown } from "@noldova/ui.components.angular/markdown";

import { Resources } from "../../../resources";
import { ChatStoreService } from "../../services/chat-store.service";
import { OrganizationStoreService } from "../../services/organization-store.service";
import { ComposerComponent } from "../composer/composer.component";
import { HistoryComponent } from "../history/history.component";

@Component({
  selector: "nol-teamrun-organization-chat",
  imports: [ComposerComponent, NgComponentOutlet],
  providers: [OrganizationStoreService.provider],
  templateUrl: "./organization-chat.component.html",
  styleUrl: "./organization-chat.component.css"
})
export class OrganizationChatComponent {
  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly organizations: OrganizationStoreService = inject(OrganizationStoreService);
  private readonly opened: WritableSignal<ReadonlyMap<string, string>> = signal(new Map());
  private readonly opening: Set<string> = new Set();

  public readonly teammateId: InputSignal<string> = input.required<string>();

  protected readonly history: Type<HistoryComponent> = HistoryComponent;
  protected readonly environment: EnvironmentInjector = createEnvironmentInjector([provideMarkdown(), provideCodeHighlighting({ preload: Resources.preloadedCodeLanguages })],
    inject(EnvironmentInjector));
  protected readonly chatId: Signal<string | null> = computed(() => {
    const teammateId = this.teammateId();
    return this.store.organizationChatOf(teammateId)?.id ?? this.opened().get(teammateId) ?? null;
  });
  protected readonly historyInputs: Signal<Record<string, unknown>> = computed(() => ({ chatId: this.chatId() }));
  protected readonly error: Signal<string | null> = this.organizations.actionError;

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.environment.destroy());
    effect(() => {
      const teammateId = this.teammateId();
      if (this.store.loaded() && Object.isNull(this.chatId()))
        untracked(() => void this.open(teammateId));
    });
    effect(onCleanup => {
      const chatId = this.chatId();
      if (Object.isNull(chatId))
        return;
      untracked(() => void this.store.conversationInView(chatId));
      onCleanup(() => this.store.conversationOutOfView(chatId));
    });
  }

  private async open(teammateId: string): Promise<void> {
    if (this.opening.has(teammateId))
      return;
    this.opening.add(teammateId);
    try {
      const chat = await this.organizations.openOrganizationChat(teammateId);
      if (!Object.isNull(chat))
        this.opened.update(t => new Map(t).set(teammateId, chat.id));
    }
    finally {
      this.opening.delete(teammateId);
    }
  }
}
