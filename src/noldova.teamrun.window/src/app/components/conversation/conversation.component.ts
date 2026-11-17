/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgComponentOutlet } from "@angular/common";
import { Component, computed, createEnvironmentInjector, DestroyRef, effect, EnvironmentInjector, inject, input, type InputSignal, type Signal, type Type, untracked,
  viewChild } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { Announcer } from "@noldova/ui.components.angular";
import { provideCodeHighlighting } from "@noldova/ui.components.angular/code-highlighting";
import { provideMarkdown } from "@noldova/ui.components.angular/markdown";

import { Resources } from "../../../resources";
import { ChatStoreService } from "../../services/chat-store.service";
import { FormatterService } from "../../services/formatter.service";
import { GitHubReferenceSource } from "../../services/github-reference-source";
import { ReplyAnnouncements } from "../../services/reply-announcements";
import { ComposerComponent } from "../composer/composer.component";
import { ConversationMembersComponent } from "../conversation-members/conversation-members.component";
import { HistoryComponent } from "../history/history.component";

@Component({
  selector: "nol-teamrun-conversation",
  imports: [ComposerComponent, ConversationMembersComponent, NgComponentOutlet],
  providers: [ChatStoreService.provider],
  templateUrl: "./conversation.component.html",
  styleUrl: "./conversation.component.css",
  host: {
    "(focusin)": "activate()",
    "(pointerdown)": "activate(); leaveFocus($event)",
    "(keydown)": "composer().stopOnEscape($event)",
    "(document:keydown)": "stopOnPageEscape($event)",
    "(document:pointerdown)": "noteInteraction($event)",
    "(document:focusin)": "noteInteraction($event)"
  }
})
export class ConversationComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly isShown: Signal<boolean> = inject(WindowPartTokens.shown);
  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly formatter: FormatterService = inject(FormatterService);
  private readonly announcements: ReplyAnnouncements = new ReplyAnnouncements(inject(Announcer),
    t => this.formatter.authorLabel(t, this.store.kinds(), this.store.providers()));
  private readonly referenceSource: GitHubReferenceSource | null = GitHubReferenceSource.of(this.context);
  private readonly folder: Signal<string | null> = computed(() => this.store.folderOf(this.instance()));
  private shownTitle: string | null = null;
  private interactedInTeamRun: boolean = false;

  public readonly instance: InputSignal<string> = input.required<string>();
  public readonly title: InputSignal<string> = input<string>(String.empty);

  protected readonly composer: Signal<ComposerComponent> = viewChild.required(ComposerComponent);
  protected readonly history: Type<HistoryComponent> = HistoryComponent;
  protected readonly environment: EnvironmentInjector = createEnvironmentInjector([provideMarkdown(), provideCodeHighlighting({ preload: Resources.preloadedCodeLanguages })],
    inject(EnvironmentInjector));
  protected readonly historyInputs: Signal<Record<string, unknown>> = computed(() => ({ chatId: this.instance() }));

  public constructor() {
    const stopAnnouncing = this.store.onReplyEnded(t => this.announcements.ended(t));
    inject(DestroyRef).onDestroy(() => {
      stopAnnouncing();
      this.store.conversationOutOfView(this.instance());
      this.environment.destroy();
    });
    effect(() => {
      const instance = this.instance();
      if (this.isShown() && this.store.loaded())
        untracked(() => this.show(instance));
    });
    effect(() => {
      const instance = this.instance();
      if (this.store.loaded())
        untracked(() => void this.store.confirmConversation(instance));
    });
    effect(() => {
      const instance = this.instance();
      if (!this.store.loaded() || !this.store.isHistoryLoaded(instance))
        return;
      const onScreen = this.isShown() && this.store.screenConversationId() === instance;
      const [replies, approvals] = [this.store.workingReplies(), this.store.pendingApprovals()];
      untracked(() => this.announcements.update(instance, onScreen, replies, approvals, t => this.store.historyOf(instance)?.find(t) ?? null));
    });
    effect(() => {
      const folder = this.folder();
      untracked(() => this.referenceSource?.readHomeAgain(folder));
    });
    effect(() => {
      const id = this.instance();
      const title = this.store.conversation(id)?.title ?? null;
      untracked(() => this.follow(id, title));
    });
  }

  protected stopOnPageEscape(event: KeyboardEvent): void {
    if (event.target === document.body && this.interactedInTeamRun && this.isShown() && this.store.screenConversationId() === this.instance())
      this.composer().stopOnEscape(event);
  }

  protected noteInteraction(event: globalThis.Event): void {
    this.interactedInTeamRun = ConversationComponent.isInTeamRun(event.target);
  }

  protected leaveFocus(event: PointerEvent): void {
    if (!ConversationComponent.isWithin(event.target, Resources.planCardSelector))
      this.store.clearPlanFocus();
    const focus = this.store.subAgentFocus();
    if (!Object.isNull(focus) && !ConversationComponent.isWithin(event.target, Resources.formatSubAgentStepSelector(focus.messageId, focus.step)))
      this.store.clearSubAgentFocus();
  }

  protected activate(): void {
    void this.store.activateConversation(this.instance());
  }

  private show(instance: string): void {
    void this.store.conversationInView(instance);
  }

  private follow(id: string, title: string | null): void {
    const shown = this.shownTitle ?? this.title();
    this.shownTitle = title ?? shown;
    if (!Object.isNull(title) && title !== shown)
      this.context.updateDocument(Resources.conversationDocumentName, id, { title });
  }

  private static isWithin(target: EventTarget | null, selector: string): boolean {
    return target instanceof Element && !Object.isNull(target.closest(selector));
  }

  private static isInTeamRun(target: EventTarget | null): boolean {
    for (let element = target instanceof Element ? target : null; !Object.isNull(element); element = element.parentElement)
      if (element.localName.startsWith(Resources.teamRunTagPrefix))
        return true;
    return false;
  }
}
