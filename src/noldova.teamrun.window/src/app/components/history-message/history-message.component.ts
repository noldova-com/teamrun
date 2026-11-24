/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  type InputSignal,
  type OnInit,
  output,
  type OutputEmitterRef,
  type Signal,
  signal,
  untracked,
  type WritableSignal
} from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import {
  ApprovalKind, ApprovalStatus, type Conversation, DetailKind, FileChangeReader, type FileEdit, MentionResolver, type Message, MessageAuthor, type MessageDetail, MessageStatus, type Page,
  PermissionPayload, type ReplyPlan, TeammateMention, WrittenImageReader
} from "@noldova/teamrun.protocol";
import {
  ButtonComponent,
  ButtonSize,
  ButtonVariant,
  ChipComponent,
  ChipKind,
  DialogService,
  IconButtonComponent,
  type ILinkReferenceSource,
  LinkOpenEvent,
  MarkdownLinkSchemes,
  type MentionCandidate,
  MessageActionDirective,
  MessageAttachment as AttachmentBlock,
  MessageAuthor as Author,
  MessageAuthorKind,
  type MessageBlock,
  MessageComponent,
  MessageFooterEndDirective,
  MessageFooterPlacement,
  MessageImageDirective,
  MessageLayout,
  MessageSlot,
  MessageSlotDirective,
  MessageStatus as Status,
  MessageText,
  MessageTimeFormat,
  OverlayAlignment,
  OverlaySide,
  PopoverTriggerDirective,
  type ShellRun,
  ShellRunOutputDirective,
  type ShellRunState,
  SpinnerComponent,
  TooltipDirective
} from "@noldova/ui.components.angular";

import { ChatAction } from "../../enums/chat-action";
import { ReplyActivity } from "../../enums/reply-activity";
import { SegmentKind } from "../../enums/segment-kind";
import { ActivityEntry } from "../../models/activity-entry";
import { ApprovalGroup } from "../../models/approval-group";
import type { IRowReveal } from "../../interfaces/i-row-reveal";
import type { IShellRunAt } from "../../interfaces/i-shell-run-at";
import type { ActivityStep } from "../../models/activity-step";
import { ScrollReveal } from "../../models/scroll-reveal";
import { ApprovalPermission } from "../../models/approval-permission";
import { ChatIds } from "../../models/chat-ids";
import { ChatLinks } from "../../models/chat-links";
import { KeyedImage } from "../../models/keyed-image";
import { KeyedMissingImage } from "../../models/keyed-missing-image";
import { MarkdownImageSource } from "../../models/markdown-image-source";
import { MessageControlState } from "../../models/message-control-state";
import type { ModelCatalog } from "../../models/model-catalog";
import type { ReplySegment } from "../../models/reply-segment";
import type { ReplyStats } from "../../models/reply-stats";
import type { SustainHandover } from "../../models/sustain-handover";
import { TimedSegment } from "../../models/timed-segment";
import { TitleReveal } from "../../models/title-reveal";
import type { WakeReceived } from "../../models/wake-received";
import { Resources } from "../../../resources";
import { BackgroundTaskStoreService } from "../../services/background-task-store.service";
import { ChatStoreService } from "../../services/chat-store.service";
import { ChatTerminals } from "../../services/chat-terminals";
import { CommandTargetsService } from "../../services/command-targets.service";
import { ConversationActions } from "../../services/conversation-actions";
import { ClockService } from "../../services/clock.service";
import { FormatterService } from "../../services/formatter.service";
import { GitHubReferenceSource } from "../../services/github-reference-source";
import { MotionPreferenceService } from "../../services/motion-preference.service";
import { PaintPacerService } from "../../services/paint-pacer.service";
import { UsageFormatterService } from "../../services/usage-formatter.service";
import { TeammateCandidates } from "../../services/teammate-candidates";
import { ViewedImage } from "../../models/viewed-image";
import { ImageViewerService } from "../../services/image-viewer.service";
import { ReplyLinksService } from "../../services/reply-links.service";
import { ActivityBlockComponent } from "../activity-block/activity-block.component";
import { EditedFilesComponent } from "../edited-files/edited-files.component";
import { ImagePreviewComponent } from "../image-preview/image-preview.component";
import { InlineTerminalComponent } from "../inline-terminal/inline-terminal.component";
import { PageCardComponent } from "../pages/page-card/page-card.component";
import { PlanCardComponent } from "../plan-card/plan-card.component";
import { ReplyApprovalsComponent } from "../reply-approvals/reply-approvals.component";
import { ReplyStatsComponent } from "../reply-stats/reply-stats.component";
import { RewindDialogComponent } from "../rewind-dialog/rewind-dialog.component";
import { TeammateDialogComponent } from "../teammate-dialog/teammate-dialog.component";
import { WakeLineComponent } from "../wake-line/wake-line.component";

@Component({
  selector: "nol-teamrun-history-message",
  imports: [
    ActivityBlockComponent, ButtonComponent, ChipComponent, EditedFilesComponent, IconButtonComponent, ImagePreviewComponent, InlineTerminalComponent, MessageActionDirective, MessageComponent,
    MessageFooterEndDirective, MessageImageDirective, MessageSlotDirective, PageCardComponent, PlanCardComponent, PopoverTriggerDirective, ReplyApprovalsComponent,
    ReplyStatsComponent, ShellRunOutputDirective, SpinnerComponent, TooltipDirective, WakeLineComponent
  ],
  providers: [ImageViewerService.provider, BackgroundTaskStoreService.provider, ReplyLinksService],
  host: { "[attr.data-message-id]": "message().id", "[class.inline]": "replyRow() !== null", "(focusin)": "followApproval()" },
  templateUrl: "./history-message.component.html",
  styleUrls: ["../note-line.css", "./history-message.component.css"]
})
export class HistoryMessageComponent implements OnInit {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly formatter: FormatterService = inject(FormatterService);
  private readonly usage: UsageFormatterService = inject(UsageFormatterService);
  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly clock: ClockService = inject(ClockService);
  private readonly isShown: Signal<boolean> = inject(WindowPartTokens.shown);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly links: ReplyLinksService = inject(ReplyLinksService);
  private readonly tasks: BackgroundTaskStoreService = inject(BackgroundTaskStoreService);
  private readonly terminals: ChatTerminals | null = ChatTerminals.of(this.context);
  private readonly injector: Injector = inject(Injector);
  private readonly rowReveal: IRowReveal | null = inject(ScrollReveal.rows, { optional: true });
  private readonly hasStepLine: Signal<boolean> = computed(() => !Object.isNull(this.latestStep()));
  private readonly motion: MotionPreferenceService = inject(MotionPreferenceService);
  private readonly pacer: PaintPacerService = inject(PaintPacerService);
  private stopSlots: () => void = () => undefined;
  private readonly stepFrame: WritableSignal<number> = signal(0);
  private readonly stepReveal: TitleReveal = new TitleReveal(() => this.stepFrame.update(t => t + 1));
  private readonly shownSteps: Set<string> = new Set();
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private shownApprovals: readonly string[] = [];
  private focusedApprovalId: string | null = null;
  private focusingApprovalId: string | null = null;
  private readonly local: MessageControlState = new MessageControlState();
  private readonly chatIds: Map<number, ChatIds> = new Map();
  private readonly now: WritableSignal<number> = signal(this.clock.now());
  private initialKeys: ReadonlySet<number> = new Set();
  private filePaths: readonly string[] = [];

  public readonly message: InputSignal<Message> = input.required<Message>();
  public readonly labelId: InputSignal<string | null> = input<string | null>(null);
  public readonly flashStart: InputSignal<Date | null> = input<Date | null>(null);
  public readonly revealsPlan: InputSignal<boolean> = input<boolean>(false);
  public readonly revealsStep: InputSignal<number | null> = input<number | null>(null);
  public readonly awaitsFlash: InputSignal<boolean> = input<boolean>(false);
  public readonly flashedSteerId: InputSignal<string | null> = input<string | null>(null);
  public readonly replyRow: InputSignal<number | null> = input<number | null>(null);
  public readonly flashReady: OutputEmitterRef<void> = output<void>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly chatLinkSchemes: MarkdownLinkSchemes = new MarkdownLinkSchemes([Resources.chatLinkScheme]);
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly compact: ButtonSize = ButtonSize.Compact;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly below: OverlaySide = OverlaySide.below;
  protected readonly start: OverlayAlignment = OverlayAlignment.Start;
  protected readonly column: MessageLayout = MessageLayout.Column;
  protected readonly footerEnd: MessageFooterPlacement = MessageFooterPlacement.End;
  protected readonly clockTime: MessageTimeFormat = MessageTimeFormat.Clock;
  private readonly referenceSource: GitHubReferenceSource | null = GitHubReferenceSource.of(this.context);
  protected readonly references: Signal<ILinkReferenceSource | null> = computed(() => {
    const source = this.referenceSource;
    return Object.isNull(source) ? null : source.readerFor(source.homeOf(this.store.folderOf(this.message().conversationId))());
  });
  protected readonly state: Signal<MessageControlState> = computed(() => this.store.messageControlsOf(this.message().conversationId, this.message().id) ?? this.local);
  protected readonly isPerson: Signal<boolean> = computed(() => this.message().author === MessageAuthor.User);
  protected readonly runsShell: Signal<boolean> = computed(() => !this.isPerson() && !Object.isNull(this.terminals));
  protected readonly terminalOwner: Signal<string> = computed(() => ChatTerminals.ownerFor(this.message().conversationId));
  protected readonly runBlocks: Signal<ReadonlyMap<string, ReadonlySet<number>>> = computed(() =>
    this.terminals?.inlineTerminals?.blocksOf(this.terminalOwner(), this.message().id) ?? new Map());
  protected readonly bodyRunOutputs: Signal<ReadonlySet<number>> = computed(() => this.runBlocks().get(Resources.runBodySite) ?? new Set());
  protected readonly planRunOutputs: Signal<ReadonlySet<number>> = computed(() => this.runBlocks().get(Resources.runPlanSite) ?? new Set());
  protected readonly runStates: Signal<ReadonlyMap<string, ReadonlyMap<number, ShellRunState>>> = computed(() =>
    this.terminals?.inlineTerminals?.statesOf(this.terminalOwner(), this.message().id) ?? new Map());
  protected readonly bodyRunStates: Signal<ReadonlyMap<number, ShellRunState>> = computed(() => this.runStates().get(Resources.runBodySite) ?? new Map());
  protected readonly planRunStates: Signal<ReadonlyMap<number, ShellRunState>> = computed(() => this.runStates().get(Resources.runPlanSite) ?? new Map());
  protected readonly isActive: Signal<boolean> = computed(() => this.formatter.isActive(this.message()));
  protected readonly canStop: Signal<boolean> = computed(() => this.formatter.canStop(this.message()));
  protected readonly stopping: Signal<boolean> = computed(() => this.store.isCancelling(this.message().id));
  protected readonly isAsking: Signal<boolean> = computed(() => this.formatter.waitsOn(this.message(), this.askers()) && this.store.isAsking(this.message().id));
  protected readonly askers: Signal<ReadonlySet<string | null> | null> = computed(() => {
    const pending = this.store.pendingApprovalsOf(this.message().id);
    return pending.length === 0 ? null : new Set(pending.map(t => ApprovalPermission.subAgentOf(t)));
  });
  protected readonly asked: Signal<readonly PermissionPayload[]> = computed(() => this.store.pendingApprovalsOf(this.message().id)
    .filter(t => t.kind === ApprovalKind.Permission).map(t => PermissionPayload.fromJson(t.payload)));
  protected readonly segments: Signal<readonly ReplySegment[]> = computed(() => this.isPerson() ? [] : this.formatter.segments(this.message()));
  protected readonly activitySegments: Signal<readonly ReplySegment[]> = computed(() => this.segments().filter(t => t.kind === SegmentKind.Activity));
  protected readonly errorSegments: Signal<readonly ReplySegment[]> = computed(() => this.segments().filter(t => t.detail?.kind === DetailKind.Error));
  protected readonly stoppedErrors: Signal<ReadonlySet<MessageDetail | null>> = computed(() =>
    new Set(this.message().details.filter(t => t.kind === DetailKind.Error && FormatterService.stopsSustain(t))));
  protected readonly timedSegments: Signal<readonly TimedSegment[]> = computed(() => this.segments().flatMap(t =>
    (Object.isNull(t.detail) ? t.entries.map(u => u.detail) : [t.detail]).slice(0, 1).map(u => new TimedSegment(t.key, Date.parse(u.createdAt)))));
  protected readonly hasActivity: Signal<boolean> = computed(() => this.activitySegments().length > 0);
  protected readonly isActivityOpen: Signal<boolean> = computed(() => this.state().activityChoice() ?? false);
  protected readonly foldedKeys: Signal<ReadonlySet<number>> = computed(() => {
    const segments = this.segments();
    const lastActivity = segments.findLastIndex(t => t.kind === SegmentKind.Activity);
    return this.isActive() || HistoryMessageComponent.statusOf(this.message().status) !== Status.Complete ? new Set()
      : new Set(segments.filter((t, index) => index < lastActivity && t.detail?.kind === DetailKind.Text).map(t => t.key));
  });
  protected readonly stepEntries: Signal<readonly ActivityEntry[]> = computed(() => this.segments().flatMap(t => this.foldedKeys().has(t.key)
    ? [new ActivityEntry(t.requiredDetail, null)] : t.kind === SegmentKind.Activity ? t.entries : []));
  protected readonly latestStep: Signal<ActivityStep | null> = computed(() => !this.isActive() || this.isActivityOpen() ? null
    : this.formatter.latestStepOf(this.message(), this.stepEntries(), this.rootPath(), this.areStepsGrowing()));
  protected readonly edits: Signal<readonly FileEdit[]> = computed(() => new FileChangeReader().editsOf(this.message()));
  protected readonly rootPath: Signal<string | null> = computed(() => this.store.folderOf(this.message().conversationId));
  protected readonly pageCards: Signal<readonly { readonly pageId: string; readonly page: Page | null }[]> = computed(() => {
    const message = this.message();
    const cards = new Map<string, { readonly pageId: string; readonly page: Page | null }>();
    for (const entry of this.formatter.activity(message)) {
      const step = PageCardComponent.stepOf(entry.detail.payload, entry.detail.text, entry.result?.text ?? null);
      if (Object.isNull(step))
        continue;
      if (Object.isNull(step.page) && !this.formatter.isStepRunning(message, entry))
        continue;
      cards.delete(step.pageId);
      cards.set(step.pageId, step);
    }
    return [...cards.values()];
  });
  protected readonly writtenImages: Signal<readonly ViewedImage[]> = computed(() => {
    const message = this.message();
    const rootPath = this.rootPath();
    return this.isPerson() || this.isActive() || Object.isNull(rootPath) ? []
      : new WrittenImageReader().pathsOf(message, rootPath).map(t => ViewedImage.written(message.conversationId, message.id, t));
  });
  protected readonly markdownImageSources: Signal<readonly MarkdownImageSource[]> = computed(() => {
    const message = this.message();
    const rootPath = this.rootPath();
    const reader = new WrittenImageReader();
    return this.isPerson() || this.isActive() ? [] : reader.markdownImageSourcesOf(message).flatMap((t, i) => {
      const path = Object.isNull(rootPath) ? null : reader.markdownImagePathOf(t, rootPath);
      const image = Object.isNull(path) ? ViewedImage.fromDataUrl(message.conversationId, message.id, i, t) : ViewedImage.written(message.conversationId, message.id, path);
      return Object.isNull(image) ? [] : [new MarkdownImageSource(t, image)];
    });
  });
  protected readonly markdownImages: Signal<readonly ViewedImage[]> = computed(() => this.markdownImageSources().map(t => t.image)
    .filter((t, i, all) => all.findIndex(u => u.key === t.key) === i));
  protected readonly generatedImages: Signal<ReadonlyMap<number, ViewedImage>> = computed(() => {
    const message = this.message();
    const rootPath = this.rootPath();
    const images = new Map<number, ViewedImage>();
    for (const t of this.segments().filter(u => u.kind === SegmentKind.Image)) {
      const image = this.formatter.generatedImageOf(message, t.requiredDetail, rootPath);
      if (!Object.isNull(image))
        images.set(t.key, image);
    }
    return images;
  });
  protected readonly missingImages: Signal<readonly KeyedMissingImage[]> = computed(() => {
    const message = this.message();
    const rootPath = this.rootPath();
    return this.segments().filter(t => t.kind === SegmentKind.Image).flatMap(t => {
      const missing = this.formatter.missingImageOf(message, t.requiredDetail, rootPath);
      return Object.isNull(missing) ? [] : [new KeyedMissingImage(t.key, missing)];
    });
  });
  protected readonly plan: Signal<ReplyPlan | null> = computed(() => this.formatter.planOf(this.message()));
  protected readonly planSegment: Signal<ReplySegment | undefined> = computed(() => this.segments().find(t => t.kind === SegmentKind.Plan));
  protected readonly isPlanOpen: Signal<boolean> = computed(() => this.state().expansion.plan());
  protected readonly approvalGroups: Signal<readonly ApprovalGroup[]> = computed(() => {
    const timed = this.timedSegments();
    const groups = new Map<number, string[]>();
    for (const approval of this.store.approvalsOf(this.message().id).filter(t => t.kind === ApprovalKind.Question || t.status === ApprovalStatus.Pending)) {
      const createdAt = Date.parse(approval.createdAt);
      const key = timed.findLast(t => t.at <= createdAt)?.key ?? -1;
      groups.set(key, [...(groups.get(key) ?? []), approval.id]);
    }
    const shown: ApprovalGroup[] = [];
    groups.forEach((ids, key) => shown.push(new ApprovalGroup(key, ids)));
    return shown;
  });
  protected readonly awaitsPlanApproval: Signal<boolean> = computed(() => this.store.awaitsPlanApproval(this.message()));
  protected readonly approvingPlan: WritableSignal<boolean> = signal(false);
  protected readonly folderLinks: WritableSignal<ReadonlySet<string>> = signal(new Set());
  protected readonly generatedImageEntries: Signal<readonly KeyedImage[]> = computed(() => {
    const entries: KeyedImage[] = [];
    this.generatedImages().forEach((image, key) => entries.push(new KeyedImage(key, image)));
    return entries;
  });
  protected readonly generatedImageList: Signal<readonly ViewedImage[]> = computed(() => [...this.generatedImages().values()]);
  protected readonly attachedImages: Signal<readonly ViewedImage[]> = computed(() => {
    const message = this.message();
    return message.attachments.filter(t => t.isImage).map(t => ViewedImage.of(message.conversationId, t));
  });
  protected readonly author: Signal<Author> = computed(() => this.authorOf(this.message()));
  protected readonly time: Signal<Date> = computed(() => new Date(this.message().createdAt));
  protected readonly replyProvider: Signal<string | null> = computed(() => this.formatter.replyProvider(this.message(), this.store.kinds()));
  protected readonly catalog: Signal<ModelCatalog | undefined> = computed(() => this.store.loadedCatalogOf(this.message()));
  protected readonly modelLine: Signal<string | null> = computed(() => this.isPerson() ? null : this.formatter.modelLine(this.message(), this.store.kinds(), this.catalog()));
  protected readonly stats: Signal<ReplyStats | null> = computed(() => this.isPerson() || this.isActive() ? null : this.usage.statsOf(this.message(), this.modelLine()));
  protected readonly statsLabel: Signal<string | null> = computed(() => this.stats()?.label ?? null);
  protected readonly statusLabel: Signal<string | null> = computed(() => this.isAsking() ? Resources.awaitingAnswerLabel
    : Resources.messageStatusLabels[this.formatter.waitsOn(this.message(), this.askers()) ? MessageStatus.AwaitingApproval : this.message().status]);
  protected readonly statusKind: Signal<ChipKind> = computed(() => this.message().status === MessageStatus.Failed ? ChipKind.Failed : ChipKind.Status);
  protected readonly taskKind: ChipKind = ChipKind.Status;
  protected readonly isOutside: Signal<boolean> = computed(() => this.message().sender?.outside === true);
  protected readonly runningTasksLabel: Signal<string | null> = computed(() => {
    const message = this.message();
    const count = this.isPerson() ? 0 : this.tasks.runningCountOf(message.conversationId, message.id);
    return count > 0 ? Resources.formatRunningTasks(count) : null;
  });
  protected readonly mentions: Signal<readonly MentionCandidate[]> = computed(() => {
    const candidates = new TeammateCandidates().of(this.store.teammates(), t => ({ unavailable: this.store.isTeammateUnavailable(t.id) }));
    const message = this.message();
    if (message.author === MessageAuthor.User && Object.isNull(message.sender))
      return candidates;
    const text = message.details.filter(t => t.kind === DetailKind.Text).map(t => t.text).join(Resources.lineSeparator);
    const named = new Set(MentionResolver.resolveTeammateText(text, candidates.map(t => new TeammateMention(t.id, t.name))).map(t => t.teammateId));
    return candidates.filter(t => named.has(t.id) && t.id !== message.sender?.teammateId);
  });
  protected readonly status: Signal<Status> = computed(() => HistoryMessageComponent.statusOf(this.message().status));
  protected readonly activityLabel: Signal<string> = computed(() => {
    const message = this.message();
    const activity = this.stopping() ? ReplyActivity.Stopping : this.store.savingCheckpointReplies().has(message.id) ? ReplyActivity.SavingCheckpoint
      : this.store.thinkingReplies().has(message.id) ? ReplyActivity.Thinking : null;
    return this.formatter.activityLabel(message, this.now(), activity);
  });
  protected readonly wakeNote: Signal<readonly string[] | null> = computed(() => this.formatter.wakeNoteOf(this.message()));
  protected readonly wakeReceived: Signal<WakeReceived | null> = computed(() => FormatterService.wakeReceivedOf(this.message()));
  protected readonly resumeNote: Signal<string | null> = computed(() => this.message().details.find(t => this.formatter.isResumeNote(t))?.text ?? null);
  protected readonly sustainNotes: Signal<readonly { readonly sequence: number; readonly glyph: string; readonly text: string; readonly handover: SustainHandover | null }[]> =
    computed(() => this.message().details
      .filter(t => this.formatter.isSustainNote(t))
      .map(t => ({ sequence: t.sequence, glyph: FormatterService.stopsSustain(t) ? Resources.usageStoppedGlyph : Resources.usageHandedOffGlyph, text: t.text,
        handover: FormatterService.stopsSustain(t) ? null : FormatterService.handoverOf(t) })));
  protected readonly handOffNote: Signal<string | null> = computed(() => this.message().details.find(t => this.formatter.isHandOffNote(t))?.text ?? null);
  protected readonly steers: Signal<readonly Message[]> = computed(() => this.isPerson() ? [] : this.store.steersOf(this.message().id));
  protected readonly ownFlashStart: Signal<Date | null> = computed(() => Object.isNull(this.flashedSteerId()) ? this.flashStart() : null);
  protected readonly senderLine: Signal<string | null> = computed(() => {
    const sender = this.message().sender;
    if (Object.isNull(sender))
      return null;
    if (sender.outside)
      return Resources.outsideSenderLine;
    const chat = this.senderChat();
    return Object.isNull(chat) ? Resources.senderChatGone : Resources.formatSenderChat(chat.title);
  });
  protected readonly senderChat: Signal<Conversation | null> = computed(() => {
    const sender = this.message().sender;
    return Object.isNull(sender) || sender.outside ? null : this.store.conversation(sender.conversationId);
  });
  protected readonly blocks: Signal<readonly MessageBlock[]> = computed(() => this.isPerson() ? this.ownBlocks() : this.replyBlocks());
  protected readonly areSlotsShown: WritableSignal<boolean> = signal(true);
  protected readonly copyText: Signal<string | null> = computed(() => this.isPerson() ? null
    : this.formatter.answers(this.message()).map(t => t.text).filter(t => !String.isNullOrWhitespace(t)).join(Resources.paragraphSeparator));

  public constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stepReveal.dispose();
      this.stopSlots();
    });
    effect(() => {
      const id = this.message().id;
      const state = this.state();
      state.hasChanges;
      untracked(() => this.store.rememberMessageControls(id, state, this.message().conversationId));
    });
    effect(() => {
      const step = this.revealsStep();
      const state = this.state();
      if (Object.isNull(step) || Object.isNull(this.flashStart()))
        return;
      untracked(() => {
        state.activityChoice.set(true);
        state.expansion.activity.update(t => t.has(step) ? t : new Set([...t, step]));
      });
    });
    effect(() => {
      const shown = this.approvalGroups().flatMap(t => t.ids);
      const pending = new Set(this.store.pendingApprovalsOf(this.message().id).map(t => t.id));
      untracked(() => this.keepApprovalFocus(shown.filter(t => pending.has(t)), shown));
    });
    effect(() => {
      const step = this.latestStep();
      if (this.isActivityOpen())
        this.stepEntries().forEach(t => this.shownSteps.add(String(t.detail.sequence)));
      const titles = new Map<string, string>();
      if (!Object.isNull(step))
        titles.set(String(step.sequence), step.title);
      this.stepReveal.follow(titles, this.shownSteps, this.isActive(), !this.motion.reduced());
      titles.forEach((_, key) => this.shownSteps.add(key));
      this.stepFrame.update(t => t + 1);
    });
    effect(() => {
      this.hasStepLine();
      untracked(() => this.holdReaderBelowStepLine());
    });
    effect(onCleanup => {
      const row = this.replyRow();
      if (Object.isNull(row) || Object.isNull(this.flashStart()))
        return;
      const render = untracked(() => afterNextRender(() => this.rowReveal?.revealPart(row, this.host), { injector: this.injector }));
      onCleanup(() => render.destroy());
    });
    effect(onCleanup => {
      if (!this.awaitsFlash())
        return;
      const render = untracked(() => afterNextRender(() => this.flashReady.emit(), { injector: this.injector }));
      onCleanup(() => render.destroy());
    });
    effect(onCleanup => {
      if (!this.isActive() || !this.isShown())
        return;
      this.now.set(this.clock.now());
      onCleanup(this.clock.every(Resources.clockIntervalMilliseconds, () => this.now.set(this.clock.now())));
    });
  }

  public ngOnInit(): void {
    if (this.store.takeArrived(this.message().id)) {
      this.areSlotsShown.set(false);
      this.stopSlots = this.pacer.afterPaint(() => this.areSlotsShown.set(true));
    }
    this.initialKeys = new Set(this.segments().map(t => t.key));
    if (!this.areStepsEntering())
      this.stepEntries().forEach(t => this.shownSteps.add(String(t.detail.sequence)));
  }

  protected stepTitleOf(step: ActivityStep): string {
    this.stepFrame();
    return this.stepReveal.shownOf(String(step.sequence), step.title);
  }

  protected areStepsEntering(): boolean {
    return !this.activitySegments().some(t => this.initialKeys.has(t.key));
  }

  protected areStepsGrowing(): boolean {
    return this.isActive() && this.segments().at(-1)?.kind === SegmentKind.Activity;
  }

  protected errorSlotOf(segment: ReplySegment): string {
    return Resources.formatErrorSlot(segment.key);
  }

  protected imageSlotOf(key: number): string {
    return Resources.formatImageSlot(key);
  }

  protected planSlotOf(key: number): string {
    return Resources.formatPlanSlot(key);
  }

  protected approvalsSlotOf(key: number): string {
    return Resources.formatApprovalsSlot(key);
  }

  protected approachApproval(approvalId: string): void {
    this.focusingApprovalId = approvalId;
  }

  protected followApproval(): void {
    this.focusedApprovalId = this.focusingApprovalId;
    this.focusingApprovalId = null;
  }

  protected markdownImageOf(source: string): ViewedImage | null {
    const sources = this.markdownImageSources();
    const rootPath = this.rootPath();
    const path = sources.length === 0 || Object.isNull(rootPath) ? null : new WrittenImageReader().markdownImagePathOf(source, rootPath);
    return sources.find(t => Object.isNull(path) ? t.source === source.trim() : t.image.path === path)?.image ?? null;
  }

  protected isWebAddress(source: string): boolean {
    return Resources.webAddressPattern.test(source.trim());
  }

  protected openImageLink(event: MouseEvent, source: string): void {
    if (event.type === Resources.auxclickEventName && event.button !== Resources.middleButton)
      return;
    event.preventDefault();
    this.openLink(new LinkOpenEvent(source.trim(), event));
  }

  protected togglePlan(): void {
    const open = !this.isPlanOpen();
    this.state().expansion.plan.set(open);
    if (!open)
      return;
    this.store.focusPlan(this.message());
    this.context.showView(Resources.planViewName);
  }

  protected async approvePlan(): Promise<void> {
    this.approvingPlan.set(true);
    try {
      await this.store.approvePlan(this.message());
    }
    finally {
      this.approvingPlan.set(false);
    }
  }

  protected isHandoverOpen(sequence: number): boolean {
    return this.state().expansion.handovers().has(sequence);
  }

  protected toggleHandover(sequence: number): void {
    this.state().expansion.handovers.update(t => t.has(sequence) ? new Set([...t].filter(s => s !== sequence)) : new Set([...t, sequence]));
  }

  protected toggleActivity(): void {
    this.state().activityChoice.set(!this.isActivityOpen());
  }

  protected runShell(run: ShellRun, site: string = Resources.runBodySite): void {
    this.terminals?.run(this.message().conversationId, run, { messageId: this.message().id, site, block: run.block });
  }

  protected runStepShell(at: IShellRunAt): void {
    this.runShell(at.run, at.site);
  }

  protected openLink(opened: LinkOpenEvent): void {
    this.links.openLink(opened.url, opened.gesture);
  }

  protected showChatPage(): void {
    this.links.showChatPage(this.message().conversationId);
  }

  protected openAttachment(path: string): void {
    const name = this.message().attachments.find(t => t.path === path)?.name;
    void this.context.openFileAsync(path).catch(() => this.showInFolderAsync(path, name, true));
  }

  protected openFile(target: string): void {
    this.links.openFile(target, this.message(), this.rootPath(), [...this.markdownImages(), ...this.writtenImages()]);
  }

  protected markFolders(targets: readonly string[]): void {
    this.filePaths = targets;
    const rootPath = this.rootPath();
    const located = targets.flatMap(t => {
      const path = ReplyLinksService.pathOf(t, rootPath);
      return Object.isNull(path) ? [] : [{ target: t, path }];
    });
    void this.store.linkedFoldersAsync(this.message(), located.map(t => t.path)).then(folders => {
      if (this.filePaths === targets)
        this.folderLinks.set(new Set(located.filter(t => folders.has(t.path)).map(t => t.target)));
    });
  }

  protected openSenderChat(chat: Conversation): void {
    ConversationActions.open(this.context, this.store, chat);
  }

  protected cancel(): void {
    void this.store.cancel(this.message().id);
  }

  protected offersModelChoice(segment: ReplySegment): boolean {
    return !Object.isNull(segment.detail) && this.formatter.offersModelChoice(segment.detail);
  }

  protected usedUpNote(segment: ReplySegment): string | null {
    const provenance = this.message().provenance;
    const until = this.formatter.usedUpUntilOf(segment.detail);
    if (Object.isUndefined(until) || Object.isNull(provenance))
      return null;
    const provider = this.formatter.providerLine(provenance.requested.kind, this.store.providers().find(t => t.id === provenance.providerId), this.store.kinds());
    return Resources.formatUsedUpTurn(provider, this.usage.usedUpState(until));
  }

  protected chooseModel(): void {
    const message = this.message();
    const teammate = this.store.teammates().find(t => t.id === message.teammateId);
    if (Object.isUndefined(teammate)) {
      CommandTargetsService.of(this.context).openComposerSettings(message.conversationId);
      return;
    }
    const dialog = this.dialogs.open(TeammateDialogComponent, ".nol-teamrun-teammate-name");
    dialog.componentRef?.setInput("store", this.store);
    dialog.componentRef?.setInput("teammate", teammate);
    dialog.componentInstance?.closed.subscribe(() => dialog.close());
  }

  protected rewind(): void {
    const dialog = this.dialogs.open(RewindDialogComponent, ".nol-teamrun-confirm");
    dialog.componentRef?.setInput("store", this.store);
    dialog.componentRef?.setInput("message", this.message());
    dialog.componentInstance?.closed.subscribe(() => dialog.close());
  }

  private async showInFolderAsync(path: string, name: string = ReplyLinksService.nameOf(path), isAttachment: boolean = false): Promise<void> {
    const conversationId = this.message().conversationId;
    try {
      await this.context.showInFolderAsync(path);
    }
    catch {
      const gone = isAttachment && !await this.store.hasAttachment(conversationId, path).catch(() => true);
      if (this.store.isDeleted(conversationId))
        return;
      if (gone)
        this.store.reportNotice(ChatAction.OpenAttachment, path, Resources.formatAttachmentGone(name), conversationId);
      else
        this.store.reportFailure(ChatAction.ShowInFolder, path, Resources.formatShowInFolderFailed(name), conversationId);
    }
  }

  private holdReaderBelowStepLine(): void {
    const view = this.host.closest(Resources.listViewportSelector);
    const line = this.host.querySelector(Resources.stepLineSelector) ?? this.host.querySelector(Resources.workingLineSelector);
    if (Object.isNull(view) || Object.isNull(line))
      return;
    const { top } = view.getBoundingClientRect();
    if (line.getBoundingClientRect().bottom > top)
      return;
    const part = [...this.host.querySelectorAll(Resources.anyElementSelector)].find(t => {
      const box = t.getBoundingClientRect();
      return box.height > 0 && box.bottom > top && (line.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    });
    if (!Object.isUndefined(part))
      this.rowReveal?.holdPart(this.message().sequence, part);
  }

  private replyBlocks(): readonly MessageBlock[] {
    const segments = this.segments();
    const blocks: MessageBlock[] = [];
    if (this.message().author === MessageAuthor.Provider || this.hasActivity())
      blocks.push(new MessageSlot(Resources.activitySlot));
    if (this.hasActivity() && this.isActivityOpen())
      blocks.push(new MessageSlot(Resources.stepsSlot));
    const latest = this.timedSegments().at(-1)?.key ?? -1;
    const unplaced = new Set(this.approvalGroups().map(t => t.key));
    const approvalsAfter = (key: number): readonly MessageBlock[] => key !== latest && unplaced.delete(key) ? [new MessageSlot(this.approvalsSlotOf(key))] : [];
    blocks.push(...this.attachmentBlocks(), ...approvalsAfter(-1));
    for (const segment of segments)
      blocks.push(...this.steersBefore(segment.key), ...this.segmentBlocks(segment), ...approvalsAfter(segment.key));
    blocks.push(...this.steersBefore(null));
    if (this.pageCards().length > 0)
      blocks.push(new MessageSlot(Resources.pagesSlot));
    if (this.edits().length > 0)
      blocks.push(new MessageSlot(Resources.filesSlot));
    if (this.writtenImages().length > 0)
      blocks.push(new MessageSlot(Resources.writtenImagesSlot));
    if (unplaced.has(latest))
      blocks.push(new MessageSlot(this.approvalsSlotOf(latest)));
    const wake = [...Object.isNull(this.wakeReceived()) ? [] : [new MessageSlot(Resources.wakeReceivedSlot)],
      ...Object.isNull(this.wakeNote()) ? [] : [new MessageSlot(Resources.wakeNoteSlot)]];
    const resume = Object.isNull(this.resumeNote()) ? [] : [new MessageSlot(Resources.resumeNoteSlot)];
    const sustain = this.sustainNotes().length === 0 ? [] : [new MessageSlot(Resources.sustainNoteSlot)];
    return [...wake, ...resume, ...sustain, ...blocks];
  }

  private linkedText(key: number, text: string): string {
    const ids = (this.chatIds.get(key) ?? ChatIds.none).extendedTo(text);
    this.chatIds.set(key, ids);
    return ChatLinks.linked(ids, t => this.store.conversation(t)?.title ?? null, this.status() !== Status.Streaming);
  }

  private keepApprovalFocus(open: readonly string[], shown: readonly string[]): void {
    const before = this.shownApprovals;
    const focusedId = this.focusedApprovalId;
    this.shownApprovals = shown;
    if (Object.isNull(focusedId) || open.includes(focusedId))
      return;
    this.focusedApprovalId = null;
    if (!this.host.contains(this.host.ownerDocument.activeElement))
      return;
    const index = before.indexOf(focusedId);
    const nextId = [...before.slice(index + 1), ...before.slice(0, index).reverse()].find(t => open.includes(t));
    afterNextRender(() => {
      const card = Object.isUndefined(nextId) ? null : this.host.querySelector<HTMLElement>(`[${Resources.approvalIdAttribute}="${nextId}"]`);
      (card?.querySelector<HTMLElement>(Resources.questionControlSelector) ?? card ?? this.host.closest<HTMLElement>(Resources.replyArticleSelector))?.focus();
    }, { injector: this.injector });
  }

  private segmentBlocks(segment: ReplySegment): readonly MessageBlock[] {
    if (this.foldedKeys().has(segment.key))
      return [];
    if (segment.detail?.kind === DetailKind.Error)
      return [new MessageSlot(this.errorSlotOf(segment))];
    if (!Object.isNull(segment.detail) && this.formatter.isAnswer(segment.detail))
      return [new MessageText(this.linkedText(segment.key, segment.detail.text))];
    if (segment.kind === SegmentKind.Plan)
      return this.planBlocks(segment.key);
    if (this.generatedImages().has(segment.key) || this.missingImages().some(t => t.key === segment.key))
      return [new MessageSlot(this.imageSlotOf(segment.key))];
    return [];
  }

  private planBlocks(key: number): readonly MessageBlock[] {
    return [new MessageSlot(this.planSlotOf(key))];
  }

  private steersBefore(key: number | null): readonly MessageBlock[] {
    const placeOf = (steer: Message): number | null => this.timedSegments().find(t => t.at > Date.parse(steer.createdAt))?.key ?? null;
    return this.steers().filter(t => placeOf(t) === key).map(t => new MessageSlot(Resources.formatSteerSlot(t.id)));
  }

  private ownBlocks(): readonly MessageBlock[] {
    return [...this.attachmentBlocks(), ...this.message().details.filter(t => t.kind === DetailKind.Text).map(t => new MessageText(t.text))];
  }

  private attachmentBlocks(): readonly MessageBlock[] {
    const files = this.message().attachments.filter(t => !t.isImage).map(t => new AttachmentBlock(t.path, t.name, t.size, t.mediaType, null, t.path));
    return this.attachedImages().length > 0 ? [new MessageSlot(Resources.attachedImagesSlot), ...files] : files;
  }

  private authorOf(message: Message): Author {
    const name = this.formatter.authorLabel(message, this.store.kinds(), this.store.providers());
    switch (message.author) {
      case MessageAuthor.User: {
        const sender = message.sender;
        if (Object.isNull(sender))
          return new Author(Resources.personAuthorId, name, MessageAuthorKind.Person);
        const shown = sender.outside ? JSON.stringify(sender.name) : name;
        return new Author(sender.teammateId ?? shown, shown, MessageAuthorKind.Agent, null, this.formatter.authorInitials(sender.teammateId, name),
            this.store.teammateColor(sender.teammateId), null, !Object.isNull(sender.teammateId) && this.store.isTeammateUnavailable(sender.teammateId));
      }
      case MessageAuthor.Provider: {
        return this.formatter.replyAuthor(message, this.store.kinds(), this.store.providers(), this.store.isReplyAuthorUnavailable(message.teammateId), this.store.teammateColor(message.teammateId));
      }
      default:
        return new Author(Resources.moduleId, name, MessageAuthorKind.System);
    }
  }

  private static statusOf(status: MessageStatus): Status {
    switch (status) {
      case MessageStatus.Pending:
      case MessageStatus.Running:
      case MessageStatus.AwaitingApproval:
        return Status.Streaming;
      case MessageStatus.Failed:
        return Status.Error;
      case MessageStatus.Cancelled:
      case MessageStatus.Interrupted:
        return Status.Cancelled;
      default:
        return Status.Complete;
    }
  }
}
