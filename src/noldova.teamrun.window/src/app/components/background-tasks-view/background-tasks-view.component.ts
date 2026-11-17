/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { afterNextRender, afterRenderEffect, Component, computed, effect, ElementRef, inject, Injector, type Signal, signal, untracked,
  viewChild, type WritableSignal } from "@angular/core";

import "@noldova/context.core";
import { type BackgroundTask, BackgroundTaskStatus } from "@noldova/teamrun.protocol";
import { ButtonComponent, ButtonVariant, IconButtonComponent, ScrollEndFollower, ToolCall, ToolCallComponent, ToolCallKind, ToolCallOutputState, ToolCallStatus,
  ToolCallViews, TooltipDirective } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { BackgroundTaskStoreService } from "../../services/background-task-store.service";
import { ChatStoreService } from "../../services/chat-store.service";

@Component({
  selector: "nol-teamrun-background-tasks-view",
  imports: [ButtonComponent, IconButtonComponent, NgTemplateOutlet, ToolCallComponent, TooltipDirective],
  providers: [ChatStoreService.provider, BackgroundTaskStoreService.provider],
  host: { "(scroll)": "see()" },
  templateUrl: "./background-tasks-view.component.html",
  styleUrl: "./background-tasks-view.component.css"
})
export class BackgroundTasksViewComponent {
  private static count: number = 0;
  private static readonly statuses: Readonly<Record<BackgroundTaskStatus, ToolCallStatus>> = {
    [BackgroundTaskStatus.Running]: ToolCallStatus.Running,
    [BackgroundTaskStatus.Completed]: ToolCallStatus.Succeeded,
    [BackgroundTaskStatus.Failed]: ToolCallStatus.Failed,
    [BackgroundTaskStatus.Stopped]: ToolCallStatus.Cancelled,
    [BackgroundTaskStatus.Ended]: ToolCallStatus.Cancelled
  };

  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly injector: Injector = inject(Injector);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly finishedToggle: Signal<ElementRef<HTMLButtonElement> | undefined> = viewChild("finishedToggle", { read: ElementRef });
  private readonly clearButton: Signal<ElementRef<HTMLButtonElement> | undefined> = viewChild("clearButton", { read: ElementRef });
  private readonly finishedList: Signal<ElementRef<HTMLElement> | undefined> = viewChild("finishedList", { read: ElementRef });
  private readonly views: WritableSignal<ReadonlyMap<string, ToolCallViews>> = signal(new Map());
  private readonly isAllShown: WritableSignal<boolean> = signal(false);
  private follower: ScrollEndFollower = new ScrollEndFollower(Resources.listFollowDistance);

  protected readonly resources: typeof Resources = Resources;
  protected readonly tasks: BackgroundTaskStoreService = inject(BackgroundTaskStoreService);
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly id: string = `${Resources.backgroundTasksIdPrefix}${BackgroundTasksViewComponent.count++}`;
  protected readonly isFinishedOpen: WritableSignal<boolean> = signal(true);
  protected readonly conversationId: Signal<string | null> = this.store.shownConversationId;
  private readonly all: Signal<readonly BackgroundTask[]> = computed(() => {
    const conversationId = this.conversationId();
    return Object.isNull(conversationId) ? [] : this.tasks.commandsOf(conversationId);
  });
  protected readonly running: Signal<readonly BackgroundTask[]> =
    computed(() => this.all().filter(t => t.isRunning).sort((a, b) => a.startedAt.localeCompare(b.startedAt)));
  protected readonly finished: Signal<readonly BackgroundTask[]> =
    computed(() => this.all().filter((t): t is BackgroundTask & { readonly endedAt: string } => !Object.isNull(t.endedAt))
      .sort((a, b) => a.endedAt.localeCompare(b.endedAt)));
  protected readonly shownFinished: Signal<readonly BackgroundTask[]> =
    computed(() => this.isAllShown() ? this.finished() : this.finished().slice(-Resources.finishedTasksShown));
  protected readonly calls: Signal<ReadonlyMap<string, ToolCall>> = computed(() => {
    const stopping = this.tasks.stopping();
    return new Map(this.all().map(t => [t.id, BackgroundTasksViewComponent.callOf(t, !stopping.has(t.id), this.outputStateOf(t))]));
  });
  protected readonly loadError: Signal<string | null> = computed(() => {
    const conversationId = this.conversationId();
    return Object.isNull(conversationId) ? null : this.tasks.loadErrorOf(conversationId);
  });
  protected readonly hasTasks: Signal<boolean> = computed(() => this.all().length > 0);
  protected readonly isEmpty: Signal<boolean> = computed(() => !this.hasTasks() && Object.isNull(this.loadError()));

  public constructor() {
    effect(() => {
      const conversationId = this.conversationId();
      this.store.resyncs();
      untracked(() => this.isAllShown.set(false));
      if (!Object.isNull(conversationId))
        untracked(() => this.tasks.watch(conversationId));
    });
    effect(() => {
      this.conversationId();
      this.follower = new ScrollEndFollower(Resources.listFollowDistance);
    });
    afterRenderEffect(() => {
      const isOpen = this.isFinishedOpen();
      if (this.running().length + (isOpen ? this.shownFinished().length : 0) > 0 && this.host.isConnected)
        this.follower.follow(this.host);
    });
  }

  protected see(): void {
    this.follower.see(this.host);
  }

  protected viewsOf(task: BackgroundTask): ToolCallViews {
    return this.views().get(task.id) ?? ToolCallViews.empty;
  }

  protected remember(task: BackgroundTask, views: ToolCallViews): void {
    this.views.update(t => new Map([...t, [task.id, views]]));
  }

  protected finishedCountOf(conversationId: string): number {
    return this.finished().length + this.tasks.unlistedOf(conversationId);
  }

  protected toggleFinished(): void {
    this.isFinishedOpen.update(t => !t);
  }

  protected async showMore(conversationId: string): Promise<void> {
    const shown = this.shownFinished().length;
    this.isAllShown.set(true);
    if (shown === this.finished().length)
      await this.tasks.loadMore(conversationId);
    afterNextRender(() => {
      const rows = [...this.finishedList()?.nativeElement.querySelectorAll<HTMLElement>(`[${Resources.taskIdAttribute}]`) ?? []];
      rows.at(-shown - 1)?.querySelector<HTMLElement>(Resources.taskToggleSelector)?.focus();
    }, { injector: this.injector });
  }

  protected async stop(task: BackgroundTask): Promise<void> {
    const owner = this.host.ownerDocument;
    const hadFocus = this.rowOf(task.id)?.contains(owner.activeElement) === true;
    const keepFocus = (): void => {
      if (hadFocus)
        afterNextRender(() => {
          if (Object.isNull(owner.activeElement) || owner.activeElement === owner.body)
            (this.rowOf(task.id)?.querySelector<HTMLElement>(Resources.taskToggleSelector) ?? this.finishedToggle()?.nativeElement)?.focus();
        }, { injector: this.injector });
    };
    const stopped = this.tasks.stop(task);
    keepFocus();
    await stopped;
    keepFocus();
  }

  protected async clear(conversationId: string): Promise<void> {
    const button = this.clearButton()?.nativeElement;
    const hadFocus = !Object.isUndefined(button) && button.ownerDocument.activeElement === button;
    await this.tasks.clearFinished(conversationId);
    if (hadFocus)
      afterNextRender(() => {
        const owner = button.ownerDocument;
        if (button.disabled && [button, owner.body].includes(owner.activeElement as HTMLElement))
          this.finishedToggle()!.nativeElement.focus();
      }, { injector: this.injector });
  }

  protected retry(conversationId: string): void {
    this.tasks.retry(conversationId);
  }

  private outputStateOf(task: BackgroundTask): ToolCallOutputState {
    if (task.output === String.empty)
      return ToolCallOutputState.None;
    if (this.tasks.outputLoading().has(task.id))
      return ToolCallOutputState.Loading;
    return this.tasks.outputFailed().has(task.id) ? ToolCallOutputState.Failed : ToolCallOutputState.Idle;
  }

  private rowOf(taskId: string): HTMLElement | null {
    return this.host.querySelector<HTMLElement>(`[${Resources.taskIdAttribute}="${taskId}"]`);
  }

  private static callOf(task: BackgroundTask, canStop: boolean, outputState: ToolCallOutputState): ToolCall {
    const exitCode = task.exitCode;
    const title = task.commandCut ? `${task.command}${Resources.ellipsis}` : task.command;
    return new ToolCall(task.id, title, ToolCallKind.RunCommand, BackgroundTasksViewComponent.statuses[task.status], {
      startedAt: new Date(task.startedAt),
      ...(Object.isNull(task.endedAt) || task.endedAt === task.startedAt ? {} : { endedAt: new Date(task.endedAt) }),
      ...(Object.isNull(task.output) || task.output.length === 0 ? { outputState } : { output: task.output }),
      ...(Object.isNull(exitCode) || exitCode === 0 ? {} : { error: Resources.formatExitCode(exitCode) }),
      canCancel: task.isRunning && canStop
    });
  }
}
