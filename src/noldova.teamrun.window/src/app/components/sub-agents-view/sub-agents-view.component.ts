/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { NgTemplateOutlet } from "@angular/common";
import { afterRenderEffect, Component, computed, effect, ElementRef, inject, type Signal, signal, untracked,
  type WritableSignal } from "@angular/core";

import "@noldova/context.core";
import { type BackgroundTask, DetailKind, type Provider, ProviderAbility, type ProviderKind, ReplyPanel, type ReplySummary } from "@noldova/teamrun.protocol";
import { AvatarComponent, AvatarSize, ButtonComponent, ButtonVariant, IconButtonComponent, ScrollEndFollower, SpinnerComponent,
  TooltipDirective } from "@noldova/ui.components.angular";

import { AbilityRefusal } from "../../models/ability-refusal";
import { MessageFocus } from "../../models/message-focus";
import { SubAgentCard } from "../../models/sub-agent-card";
import { Resources } from "../../../resources";
import { BackgroundTaskStoreService } from "../../services/background-task-store.service";
import { ChatStoreService } from "../../services/chat-store.service";
import { ClockService } from "../../services/clock.service";
import { FormatterService } from "../../services/formatter.service";
import { ReplyHistoryService } from "../../services/reply-history.service";

@Component({
  selector: "nol-teamrun-sub-agents-view",
  imports: [AvatarComponent, ButtonComponent, IconButtonComponent, NgTemplateOutlet, SpinnerComponent, TooltipDirective],
  providers: [BackgroundTaskStoreService.provider, ChatStoreService.provider, ReplyHistoryService],
  host: { "(scroll)": "see()" },
  templateUrl: "./sub-agents-view.component.html",
  styleUrl: "./sub-agents-view.component.css"
})
export class SubAgentsViewComponent {
  private static count: number = 0;

  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private follower: ScrollEndFollower = new ScrollEndFollower(Resources.listFollowDistance);
  private readonly formatter: FormatterService = inject(FormatterService);
  private readonly clock: ClockService = inject(ClockService);
  private readonly now: WritableSignal<number> = signal(this.clock.now());
  private readonly cards: Signal<readonly SubAgentCard[]> = computed(() => {
    const source = this.history.source();
    if (Object.isNull(source))
      return [];
    source.changes();
    const kinds = this.store.kinds();
    const providers = this.store.providers();
    return source.items.flatMap(t => this.cardsOf(t, kinds, providers)).sort((a, b) => a.startedAt - b.startedAt);
  });

  protected readonly resources: typeof Resources = Resources;
  protected readonly history: ReplyHistoryService = inject(ReplyHistoryService);
  protected readonly tasks: BackgroundTaskStoreService = inject(BackgroundTaskStoreService);
  protected readonly id: string = `${Resources.subAgentsIdPrefix}${SubAgentsViewComponent.count++}`;
  protected readonly small: AvatarSize = AvatarSize.Small;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly running: Signal<readonly SubAgentCard[]> = computed(() => this.cards().filter(t => t.agent.isRunning));
  protected readonly finished: Signal<readonly SubAgentCard[]> = computed(() => this.cards().filter(t => !t.agent.isRunning));
  protected readonly hasRunning: Signal<boolean> = computed(() => this.running().length > 0);
  protected readonly stops: Signal<ReadonlyMap<string, BackgroundTask>> = computed(() => new Map(this.running().flatMap(card => {
    const task = this.tasks.subAgentTaskOf(card.focus.conversationId, card.focus.messageId, card.agent.toolUseId);
    return Object.isNull(task) ? [] : [[card.key, task] as const];
  })));
  protected readonly selected: Signal<MessageFocus | null> = this.store.subAgentFocus;
  protected readonly isEmpty: Signal<boolean> = computed(() => this.cards().length === 0 && !this.history.loading() && Object.isNull(this.history.error()));

  public constructor() {
    effect(() => {
      const conversationId = this.store.shownConversationId();
      this.store.resyncs();
      untracked(() => this.history.select(conversationId, ReplyPanel.SubAgents));
    });
    effect(() => {
      const conversationId = this.store.shownConversationId();
      if (!Object.isNull(conversationId))
        untracked(() => this.tasks.watch(conversationId));
    });
    effect(() => {
      if (!Object.isNull(this.history.source()))
        untracked(() => void this.history.loadAll());
    });
    effect(onCleanup => {
      if (!this.hasRunning())
        return;
      untracked(() => this.now.set(this.clock.now()));
      onCleanup(this.clock.every(Resources.clockIntervalMilliseconds, () => this.now.set(this.clock.now())));
    });
    effect(() => {
      this.store.shownConversationId();
      this.follower = new ScrollEndFollower(Resources.listFollowDistance);
    });
    afterRenderEffect(() => {
      if (this.cards().length > 0 && this.host.isConnected)
        this.follower.follow(this.host);
    });
  }

  protected see(): void {
    this.follower.see(this.host);
  }

  protected metaOf(card: SubAgentCard): readonly string[] {
    const agent = card.agent;
    const elapsed = agent.isRunning ? this.now() - card.startedAt : agent.durationMs;
    return [
      Object.isNull(agent.type) || agent.type === agent.description ? null : agent.type,
      card.model,
      Object.isNull(elapsed) ? null : Resources.formatDuration(elapsed),
      Object.isNull(agent.toolUses) ? null : Resources.formatToolCount(agent.toolUses),
      Object.isNull(agent.tokens) ? null : Resources.formatCompactTokens(agent.tokens),
      Resources.subAgentEndLabels[agent.status]
    ].filter(t => !Object.isNull(t));
  }

  protected glyphOf(card: SubAgentCard): string {
    return Resources.subAgentStatusGlyphs[card.agent.status];
  }

  protected choose(card: SubAgentCard): void {
    this.store.showSubAgent(card.focus);
  }

  protected stop(event: Event, card: SubAgentCard, task: BackgroundTask): void {
    event.stopPropagation();
    if (Object.isNull(card.stopRefusal))
      void this.tasks.stop(task);
  }

  private cardsOf(summary: ReplySummary, kinds: readonly ProviderKind[], providers: readonly Provider[]): readonly SubAgentCard[] {
    const preview = summary.preview;
    const author = this.formatter.authorLabel(preview, kinds, providers);
    const initials = this.formatter.authorInitials(preview.teammateId, author);
    const isUnavailable = this.store.isReplyAuthorUnavailable(preview.teammateId);
    const catalog = this.store.loadedCatalogOf(preview);
    const stopRefusal = AbilityRefusal.of(kinds.find(t => t.id === preview.provenance?.requested.kind), ProviderAbility.StopSubAgent, Resources.stopSubAgentAction);
    return preview.details.filter(t => t.kind === DetailKind.SubAgent && Object.isNull(t.parentSequence)).flatMap(t => {
      const agent = this.formatter.subAgentOf(t);
      return Object.isNull(agent) ? [] : [new SubAgentCard(new MessageFocus(preview.conversationId, preview.id, preview.sequence, false, t.sequence), agent,
        Date.parse(t.createdAt), author, initials, this.store.teammateColor(preview.teammateId), isUnavailable, FormatterService.subAgentModel(agent, catalog),
        agent.isTeamRun ? null : stopRefusal)];
    });
  }
}
