/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgComponentOutlet } from "@angular/common";
import { Component, computed, createEnvironmentInjector, DestroyRef, effect, EnvironmentInjector, inject, model, type ModelSignal, type Signal, signal, type Type,
  untracked, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { type AttachmentInput, type MessageStatus, OrganizationTarget, OrganizationTargetKind } from "@noldova/teamrun.protocol";
import { provideCodeHighlighting } from "@noldova/ui.components.angular/code-highlighting";
import { provideMarkdown } from "@noldova/ui.components.angular/markdown";

import { Resources } from "../../../resources";
import { ComposerFanOut } from "../../models/composer-fan-out";
import type { ComposerSettings } from "../../models/composer-settings";
import { OrganizationRecipientRow } from "../../models/organization-recipient-row";
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
  private readonly ended: WritableSignal<ReadonlyMap<string, MessageStatus>> = signal(new Map());
  private readonly opening: Map<string, Promise<string | null>> = new Map();

  public readonly target: ModelSignal<OrganizationTarget> = model.required<OrganizationTarget>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly history: Type<HistoryComponent> = HistoryComponent;
  protected readonly environment: EnvironmentInjector = createEnvironmentInjector([provideMarkdown(), provideCodeHighlighting({ preload: Resources.preloadedCodeLanguages })],
    inject(EnvironmentInjector));
  protected readonly teammateId: Signal<string | null> = computed(() => {
    const target = this.target();
    return target.kind === OrganizationTargetKind.Teammate ? target.id : null;
  });
  protected readonly chatId: Signal<string | null> = computed(() => {
    const teammateId = this.teammateId();
    return Object.isNull(teammateId) ? null : this.chatOf(teammateId);
  });
  protected readonly title: Signal<string> = computed(() => {
    const target = this.target();
    switch (target.kind) {
      case OrganizationTargetKind.Teammate:
        return Resources.formatOrganizationChat(this.store.teammate(target.id)?.name ?? Resources.organizationRemovedTeammate);
      case OrganizationTargetKind.Department:
        return Resources.formatOrganizationChat(this.organizations.organization().departments.find(t => t.id === target.id)?.name
          ?? Resources.organizationDeletedDepartment);
      case OrganizationTargetKind.Leaders:
        return Resources.organizationLeadersChat;
      case OrganizationTargetKind.Everyone:
        return Resources.formatOrganizationChat(Resources.organizationEveryoneTitle);
    }
  });
  protected readonly historyInputs: Signal<Record<string, unknown>> = computed(() => ({ chatId: this.chatId() }));
  protected readonly error: Signal<string | null> = this.organizations.actionError;
  protected readonly recipients: Signal<readonly string[]> = computed(() =>
    this.organizations.organization().recipientsOf(this.target(), this.store.teammates().map(t => t.id)));
  protected readonly fanOutKey: Signal<string> = computed(() => Resources.formatOrganizationFanOutKey([...this.recipients()].sort()));
  protected readonly fanOut: ComposerFanOut = new ComposerFanOut((text, settings, attachments) => this.sendToEach(text, settings, attachments));
  protected readonly rows: Signal<readonly OrganizationRecipientRow[]> = computed(() => this.recipients().map(id => {
    const chatId = this.chatOf(id);
    const status = Object.isNull(chatId) ? undefined : this.store.runningReplyOf(chatId)?.status ?? this.ended().get(chatId);
    return new OrganizationRecipientRow(id, this.store.teammate(id)?.name ?? id,
      Object.isUndefined(status) ? Resources.organizationRecipientNoReply : Resources.organizationRecipientStatusLabels[status]);
  }));

  public constructor() {
    const stopWatching = this.store.onReplyEnded(t => this.ended.update(u => new Map(u).set(t.conversationId, t.status)));
    inject(DestroyRef).onDestroy(() => {
      stopWatching();
      this.environment.destroy();
    });
    effect(() => {
      const teammateId = this.teammateId();
      if (!Object.isNull(teammateId) && this.store.loaded() && Object.isNull(this.chatId()))
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

  protected choose(teammateId: string): void {
    this.target.set(OrganizationTarget.teammate(teammateId));
  }

  private chatOf(teammateId: string): string | null {
    return this.store.organizationChatOf(teammateId)?.id ?? this.opened().get(teammateId) ?? null;
  }

  private open(teammateId: string): Promise<string | null> {
    const pending = this.opening.get(teammateId);
    if (!Object.isUndefined(pending))
      return pending;
    const opening = this.organizations.openOrganizationChat(teammateId).then(chat => {
      this.opening.delete(teammateId);
      if (Object.isNull(chat))
        return null;
      this.opened.update(t => new Map(t).set(teammateId, chat.id));
      return chat.id;
    });
    this.opening.set(teammateId, opening);
    return opening;
  }

  private async sendToEach(text: string, settings: ComposerSettings, attachments: readonly AttachmentInput[]): Promise<boolean> {
    let isSent = true;
    for (const teammateId of this.recipients()) {
      const chatId = this.chatOf(teammateId) ?? await this.open(teammateId);
      isSent = !Object.isNull(chatId) && await this.store.send(text, settings.withResponder(teammateId), chatId, attachments, [], teammateId) && isSent;
    }
    return isSent;
  }
}
