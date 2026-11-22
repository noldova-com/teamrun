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
import { type AttachmentInput, MessageAuthor, MessageStatus, OrganizationTarget, OrganizationTargetKind } from "@noldova/teamrun.protocol";
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
  private readonly latest: WritableSignal<ReadonlyMap<string, MessageStatus>> = signal(new Map());
  private readonly opening: Map<string, Promise<string | null>> = new Map();
  private readonly reached: Set<string> = new Set();
  private readonly reading: Set<string> = new Set();
  private readonly sending: WritableSignal<boolean> = signal(false);
  private readonly stopAsked: WritableSignal<boolean> = signal(false);
  private readonly sentTo: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly skipped: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly replying: Signal<readonly string[]> = computed(() => [...this.sentTo()].filter(t => !Object.isNull(this.store.runningReplyOf(t))));
  private readonly running: Signal<boolean> = computed(() => this.sending() || this.replying().length > 0);
  private retrying: string | null = null;

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
  protected readonly fanOutKey: Signal<string> = computed(() => Resources.formatOrganizationFanOutKey(this.organizations.id(), [...this.recipients()].sort()));
  protected readonly fanOut: ComposerFanOut = new ComposerFanOut((text, settings, attachments, sources) => this.sendToEach(text, settings, attachments, sources),
    computed(() => Resources.formatOrganizationReach(this.recipients().length)), this.running, computed(() => this.stopAsked() && this.running()), () => this.stop());
  protected readonly rows: Signal<readonly OrganizationRecipientRow[]> = computed(() => this.recipients()
    .flatMap(id => this.store.teammates().filter(t => t.id === id)).map(teammate => {
    const chatId = this.chatOf(teammate.id);
    const status = this.skipped().has(teammate.id) ? MessageStatus.Cancelled
      : Object.isNull(chatId) ? undefined : this.store.runningReplyOf(chatId)?.status ?? this.ended().get(chatId) ?? this.latest().get(chatId);
    return new OrganizationRecipientRow(teammate.id, teammate.name,
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
    effect(() => {
      const chatIds = this.recipients().flatMap(t => this.chatOf(t) ?? []);
      untracked(() => chatIds.filter(t => !this.reading.has(t)).forEach(t => void this.read(t)));
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
    const organizationId = this.organizations.id();
    return this.store.organizationChatOf(organizationId, teammateId)?.id ?? this.opened().get(Resources.formatOrganizationChatKey(organizationId, teammateId)) ?? null;
  }

  private open(teammateId: string): Promise<string | null> {
    const key = Resources.formatOrganizationChatKey(this.organizations.id(), teammateId);
    const pending = this.opening.get(key);
    if (!Object.isUndefined(pending))
      return pending;
    const opening = this.organizations.openOrganizationChat(teammateId).then(chat => {
      this.opening.delete(key);
      if (Object.isNull(chat))
        return null;
      this.opened.update(t => new Map(t).set(key, chat.id));
      return chat.id;
    });
    this.opening.set(key, opening);
    return opening;
  }

  private async read(chatId: string): Promise<void> {
    this.reading.add(chatId);
    try {
      const message = await this.store.latestMessageOf(chatId);
      if (!Object.isNull(message) && message.author !== MessageAuthor.User)
        this.latest.update(t => new Map(t).set(chatId, message.status));
    }
    catch {
      this.reading.delete(chatId);
    }
  }

  private async sendToEach(text: string, settings: ComposerSettings, attachments: readonly AttachmentInput[], sources: readonly string[]): Promise<boolean> {
    const retrying = Resources.formatOrganizationFanOutRetry(this.fanOutKey(), text, sources);
    if (this.retrying !== retrying) {
      this.retrying = retrying;
      this.reached.clear();
    }
    this.stopAsked.set(false);
    this.sentTo.set(new Set());
    this.skipped.set(new Set());
    this.sending.set(true);
    try {
      let isSent = true;
      const unreached = this.recipients().filter(t => !this.reached.has(t));
      for (const [index, teammateId] of unreached.entries()) {
        const chatId = this.stopAsked() ? null : this.chatOf(teammateId) ?? await this.open(teammateId);
        if (this.stopAsked()) {
          this.skipped.set(new Set(unreached.slice(index)));
          break;
        }
        if (!Object.isNull(chatId) && await this.deliver(text, settings.withResponder(teammateId), chatId, attachments, teammateId)) {
          this.reached.add(teammateId);
          this.sentTo.update(t => new Set(t).add(chatId));
        }
        else
          isSent = false;
      }
      const isStopped = this.stopAsked();
      if (isStopped)
        await this.stopReplies();
      if (isSent || isStopped) {
        this.retrying = null;
        this.reached.clear();
      }
      return isSent || isStopped;
    }
    finally {
      this.sending.set(false);
    }
  }

  private async stop(): Promise<void> {
    this.stopAsked.set(true);
    if (!this.sending())
      await this.stopReplies();
  }

  private async stopReplies(): Promise<void> {
    await Promise.all(this.replying().map(t => this.store.stop(t)));
    this.stopAsked.set(false);
  }

  private deliver(text: string, settings: ComposerSettings, chatId: string, attachments: readonly AttachmentInput[], teammateId: string): Promise<boolean> {
    return Object.isNull(this.store.runningReplyOf(chatId)) ? this.store.send(text, settings, chatId, attachments, [], teammateId)
      : this.store.addWaiting(text, settings, chatId, this.store.whileReplying(), attachments, [], teammateId);
  }
}
