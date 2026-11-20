/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Component, computed, DestroyRef, effect, ElementRef, EnvironmentInjector, forwardRef, inject, Injector, input, type InputSignal, type Signal, signal, untracked,
  viewChild, type WritableSignal
} from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { type Message, MessageAuthor, type MessageDetail } from "@noldova/teamrun.protocol";
import {
  ButtonComponent, ButtonVariant, VirtualListAlign, VirtualListComponent, type VirtualListJump, VirtualListKind, VirtualListPosition, VirtualRowDirective
} from "@noldova/ui.components.angular";

import type { IRowReveal } from "../../interfaces/i-row-reveal";
import type { ConversationHistorySource } from "../../models/conversation-history-source";
import type { MessageFocus } from "../../models/message-focus";
import { ReadingPosition } from "../../models/reading-position";
import { ScrollReveal } from "../../models/scroll-reveal";
import { Resources } from "../../../resources";
import { BackgroundTaskStoreService } from "../../services/background-task-store.service";
import { ChatStoreService } from "../../services/chat-store.service";
import { ClockService } from "../../services/clock.service";
import { ConversationActions } from "../../services/conversation-actions";
import { FormatterService } from "../../services/formatter.service";
import { HistoryWarmUpService } from "../../services/history-warm-up.service";
import { HistoryMessageComponent } from "../history-message/history-message.component";
import { UsageHandOffLineComponent } from "../usage-hand-off-line/usage-hand-off-line.component";
import { WakeLineComponent } from "../wake-line/wake-line.component";

@Component({
  selector: "nol-teamrun-history",
  imports: [ButtonComponent, HistoryMessageComponent, UsageHandOffLineComponent, VirtualListComponent, VirtualRowDirective, WakeLineComponent],
  providers: [BackgroundTaskStoreService.provider, { provide: ScrollReveal.rows, useExisting: forwardRef(() => HistoryComponent) }],
  templateUrl: "./history.component.html",
  styleUrl: "./history.component.css"
})
export class HistoryComponent implements IRowReveal {
  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly clock: ClockService = inject(ClockService);
  private readonly tasks: BackgroundTaskStoreService = inject(BackgroundTaskStoreService);
  private readonly list: Signal<VirtualListComponent<Message> | undefined> = viewChild<VirtualListComponent<Message>>(VirtualListComponent);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private stopFlash: (() => void) | null = null;
  private stopSave: (() => void) | null = null;
  private rowWait: AbortController = new AbortController();
  private flashChatId: string | null = null;

  public readonly chatId: InputSignal<string> = input.required<string>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly feed: VirtualListKind = VirtualListKind.Feed;
  protected readonly outlined: ButtonVariant = ButtonVariant.Outlined;
  protected readonly source: WritableSignal<ConversationHistorySource | null> = signal(null);
  protected readonly position: WritableSignal<VirtualListPosition | null> = signal(null);
  protected readonly flashId: WritableSignal<string | null> = signal(null);
  protected readonly flashStart: WritableSignal<Date | null> = signal(null);
  protected readonly flashesPlan: WritableSignal<boolean> = signal(false);
  protected readonly flashStep: WritableSignal<number | null> = signal(null);
  protected readonly flashRowId: Signal<string | null> = computed(() => {
    const id = this.flashId();
    return Object.isNull(id) ? null : this.store.steeredIntoOf(id) ?? id;
  });
  protected readonly isHidden: (item: Message) => boolean = (item: Message): boolean => !Object.isNull(FormatterService.steeredIntoOf(item))
    || FormatterService.startsTurn(item);
  protected readonly isWake: (item: Message) => boolean = (item: Message): boolean => item.author === MessageAuthor.User
    && !Object.isNull(FormatterService.wakeReceivedOf(item));
  protected readonly usageHandOffOf: (item: Message) => MessageDetail | null = (item: Message): MessageDetail | null => FormatterService.usageHandOffOf(item);
  protected readonly isEmpty: Signal<boolean> = computed(() => this.source()?.length() === 0);
  protected readonly isBusy: Signal<boolean> = computed(() => this.store.isWorking(this.chatId()));
  protected readonly offersFolder: Signal<boolean> = computed(() => this.store.loaded() && this.store.projects().length === 0
    && Object.isNull(this.store.conversation(this.chatId())?.attachedFolder ?? null));

  public constructor() {
    effect(onCleanup => {
      const id = this.chatId();
      if (this.store.loaded())
        onCleanup(untracked(() => this.store.showConversation(id)));
    });
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this.endFlash());
    inject(HistoryWarmUpService).schedule(inject(EnvironmentInjector), inject(Injector), destroyRef);
    effect(() => {
      const id = this.chatId();
      untracked(() => this.tasks.watch(id));
    });
    effect(() => {
      const id = this.chatId();
      if (!Object.isNull(this.flashChatId) && this.flashChatId !== id)
        untracked(() => this.endFlash());
    });
    effect(() => {
      const history = this.store.historyOf(this.chatId());
      if (!Object.isNull(history))
        untracked(() => this.start(history));
    });
    effect(() => {
      const focus = this.store.focus();
      const list = this.list();
      const count = this.source()?.length() ?? 0;
      if (!Object.isUndefined(list) && !Object.isNull(focus) && focus.conversationId === this.chatId() && focus.sequence < count)
        untracked(() => this.reveal(list, focus));
    });
  }

  public revealPart(index: number, part: Element): void {
    this.list()?.reveal(index, VirtualListAlign.Nearest, part);
  }

  public holdPart(index: number, part: Element): void {
    this.list()?.hold(index, part);
  }

  protected openFolder(): Promise<void> {
    return ConversationActions.openProject(this.context, this.store);
  }

  protected jumpToLatest(jump: VirtualListJump): void {
    if (this.source()?.holdsNewest() !== false)
      return;
    jump.holdForSource();
    void this.store.showLatest(this.chatId()).then(isShown => {
      if (!isShown)
        jump.release();
    });
  }

  protected remember(position: VirtualListPosition): void {
    if (!Object.isNull(position.key))
      this.store.rememberPosition(this.chatId(), new ReadingPosition(position.key, position.index, position.distance, position.isFollowing));
    else if (position.isFollowing)
      this.store.rememberPosition(this.chatId(), null);
    else
      return;
    this.saveSoon();
  }

  protected startFlash(): void {
    this.rowWait.abort();
    this.flashStart.set(new Date(this.clock.now()));
    this.stopFlash = this.clock.after(Resources.flashMilliseconds, () => this.endFlash());
  }

  private saveSoon(): void {
    if (!Object.isNull(this.stopSave))
      this.stopSave();
    this.stopSave = this.clock.after(Resources.positionSaveMilliseconds, () => {
      this.stopSave = null;
      void this.store.savePositions();
    });
  }

  private reveal(list: VirtualListComponent<Message>, focus: MessageFocus): void {
    list.reveal(this.source()?.find(this.store.steeredIntoOf(focus.messageId) ?? focus.messageId)?.sequence ?? focus.sequence, VirtualListAlign.Start);
    this.endFlash();
    this.flashId.set(focus.messageId);
    this.flashesPlan.set(focus.isPlan);
    this.flashStep.set(focus.step);
    this.flashChatId = focus.conversationId;
    this.rowWait = new AbortController();
    for (const type of Resources.viewMoveEvents)
      this.host.addEventListener(type, () => this.endFlash(), { passive: true, signal: this.rowWait.signal });
    this.store.focusMessage(null);
  }

  private endFlash(): void {
    if (!Object.isNull(this.stopFlash))
      this.stopFlash();
    this.stopFlash = null;
    this.rowWait.abort();
    this.flashChatId = null;
    this.flashId.set(null);
    this.flashesPlan.set(false);
    this.flashStep.set(null);
    this.flashStart.set(null);
  }

  private start(source: ConversationHistorySource): void {
    const pending = this.store.pendingPositionOf(this.chatId());
    this.store.consumePosition(this.chatId());
    this.position.set(Object.isNull(pending) ? null : new VirtualListPosition(pending.sequence, pending.messageId, pending.distance, pending.isFollowing));
    this.source.set(source);
  }
}
