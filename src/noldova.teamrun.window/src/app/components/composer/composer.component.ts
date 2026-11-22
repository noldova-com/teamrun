/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Component,
  DestroyRef,
  PendingTasks,
  ElementRef,
  Injector,
  type InputSignal,
  type Signal,
  type WritableSignal,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  viewChildren
} from "@angular/core";

import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import {
  AttachmentInput,
  AuthStatus,
  ChatMemberSettings,
  type ConversationResponder,
  type Draft,
  type Message,
  type MessageAttachment,
  MessageDelivery,
  MentionResolver,
  NameOrder,
  ProviderAbility,
  type ProviderKind,
  type ProviderMode,
  type ProviderModel,
  type ProviderSpeed,
  Resources as ProtocolResources,
  type Teammate,
  TeammateMention,
  TeammateName,
  type WaitingMessage
} from "@noldova/teamrun.protocol";
import {
  ButtonComponent,
  ButtonVariant,
  ContextMenuTriggerDirective,
  DialogService,
  FieldMessageComponent,
  FileBadgeComponent,
  IconButtonComponent,
  type IMentionCandidateOptions,
  type MentionCandidate,
  MentionFieldDirective,
  MentionValue,
  MenuComponent,
  MenuGroupActionDirective,
  MenuGroupComponent,
  MenuItemComponent,
  MenuOpensOnDirective,
  MenuSeparatorComponent,
  MenuTriggerDirective,
  OverlayAlignment,
  SplitButtonComponent,
  TooltipDirective
} from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { ImageOpenMode } from "../../enums/image-open-mode";
import { SendKey } from "../../enums/send-key";
import { DraftUnreadableException } from "../../exceptions/draft-unreadable.exception";
import type { IComposerDrafts } from "../../interfaces/i-composer-drafts";
import { AbilityRefusal } from "../../models/ability-refusal";
import { AccessWidths } from "../../models/access-widths";
import { CatalogReads } from "../../models/catalog-reads";
import { CatalogSource } from "../../models/catalog-source";
import type { ChatContext } from "../../models/chat-context";
import { ChatThread } from "../../models/chat-thread";
import { ComposerAttachment } from "../../models/composer-attachment";
import { ComposerBar } from "../../models/composer-bar";
import { ComposerDraft } from "../../models/composer-draft";
import type { ComposerFanOut } from "../../models/composer-fan-out";
import { ComposerSettings } from "../../models/composer-settings";
import { ConfirmRequest } from "../../models/confirm-request";
import { FoldWidths } from "../../models/fold-widths";
import { ImageViewerData } from "../../models/image-viewer-data";
import { ModelCatalog } from "../../models/model-catalog";
import { ProviderChoice } from "../../models/provider-choice";
import { RefusedMode } from "../../models/refused-mode";
import type { RewoundDraft } from "../../models/rewound-draft";
import { TeammateModelSettings } from "../../models/teammate-model-settings";
import { ViewedImage } from "../../models/viewed-image";
import { ChatStoreService } from "../../services/chat-store.service";
import { CommandTargetsService } from "../../services/command-targets.service";
import { ComposerChoicesService } from "../../services/composer-choices.service";
import { ComposerDefaultService } from "../../services/composer-default.service";
import { ComposerDraftService } from "../../services/composer-draft.service";
import { EngineResync } from "../../services/engine-resync";
import { ImageViewerService } from "../../services/image-viewer.service";
import { KeptComposerDraftService } from "../../services/kept-composer-draft.service";
import { PlanUsageStatus } from "../../services/plan-usage-status";
import { ProviderSignOut } from "../../services/provider-sign-out";
import { TeammateCandidates } from "../../services/teammate-candidates";
import { UnrestrictedModeConfirmation } from "../../services/unrestricted-mode-confirmation";
import { UsageFormatterService } from "../../services/usage-formatter.service";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";
import { ContextGaugeComponent } from "../context-gauge/context-gauge.component";
import { ImageDialogComponent } from "../image-dialog/image-dialog.component";
import { ProviderDialogComponent } from "../provider-dialog/provider-dialog.component";
import { TeammateDialogComponent } from "../teammate-dialog/teammate-dialog.component";
import { WaitingMessagesComponent } from "../waiting-messages/waiting-messages.component";

@Component({
  selector: "nol-teamrun-composer",
  imports: [
    ButtonComponent,
    ContextGaugeComponent,
    ContextMenuTriggerDirective,
    FieldMessageComponent,
    FileBadgeComponent,
    IconButtonComponent,
    MentionFieldDirective,
    MenuComponent,
    MenuGroupActionDirective,
    MenuGroupComponent,
    MenuItemComponent,
    MenuOpensOnDirective,
    MenuSeparatorComponent,
    MenuTriggerDirective,
    SplitButtonComponent,
    TooltipDirective,
    WaitingMessagesComponent
  ],
  providers: [ChatStoreService.provider, ComposerDefaultService.provider, ComposerDraftService, KeptComposerDraftService, ImageViewerService.provider],
  templateUrl: "./composer.component.html",
  styleUrl: "./composer.component.css",
  host: {
    "[class.nol-teamrun-composer-fan-out]": "isFanOut()"
  }
})
export class ComposerComponent {
  private readonly box: Signal<ElementRef<HTMLTextAreaElement>> = viewChild.required<ElementRef<HTMLTextAreaElement>>("box");
  private readonly retry: Signal<ElementRef<HTMLButtonElement> | undefined> = viewChild("retry", { read: ElementRef });
  private readonly picker: Signal<MenuTriggerDirective> = viewChild.required("picker", { read: MenuTriggerDirective });
  private readonly pickerButton: Signal<ElementRef<HTMLButtonElement>> = viewChild.required("picker", { read: ElementRef });
  private readonly line: Signal<ElementRef<HTMLElement> | undefined> = viewChild("line", { read: ElementRef });
  private readonly pickerLabel: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("pickerLabel");
  private readonly pickerShort: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("pickerShort");
  private readonly accessLabel: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("accessLabel");
  private readonly accessMark: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("accessMark");
  private readonly pickerSummary: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("pickerSummary");
  private readonly pickerGlyph: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("pickerGlyph");
  private readonly barEnd: Signal<ElementRef<HTMLElement>> = viewChild.required("end", { read: ElementRef });
  private readonly form: Signal<ElementRef<HTMLFormElement>> = viewChild.required<ElementRef<HTMLFormElement>>("form");
  private readonly card: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("card");
  private readonly bar: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("bar");
  private readonly addButton: Signal<ElementRef<HTMLButtonElement>> = viewChild.required("add", { read: ElementRef });
  private readonly accessButton: Signal<ElementRef<HTMLButtonElement>> = viewChild.required("access", { read: ElementRef });
  private readonly accessMenu: Signal<MenuTriggerDirective> = viewChild.required("access", { read: MenuTriggerDirective });
  private readonly permissionsRow: Signal<ElementRef<HTMLButtonElement> | undefined> = viewChild("permissionsRow", { read: ElementRef });
  private readonly gauge: Signal<ContextGaugeComponent | undefined> = viewChild(ContextGaugeComponent);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector: Injector = inject(Injector);
  private readonly fitObserver: ResizeObserver = new ResizeObserver(() => this.refold());
  private wideInset: number = 0;
  private tightInset: number = 0;
  private accessMinimum: number = 0;
  private accessNeeds: AccessWidths = new AccessWidths(0, 0, 0);
  private readonly frameTooltips: Signal<readonly TooltipDirective[]> = viewChildren("frame", { read: TooltipDirective });
  private readonly teammateMentions: Signal<readonly TeammateMention[]>;
  private readonly choices: ComposerChoicesService = inject(ComposerChoicesService);
  private readonly defaults: ComposerDefaultService = inject(ComposerDefaultService);
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly shown: Signal<boolean> = inject(WindowPartTokens.shown, { optional: true }) ?? signal(true);
  private readonly usage: UsageFormatterService = inject(UsageFormatterService);
  private readonly focusOnShow: WritableSignal<boolean> = signal(false);
  private readonly chatDrafts: ComposerDraftService = inject(ComposerDraftService);
  private readonly keptDrafts: KeptComposerDraftService = inject(KeptComposerDraftService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly viewer: ImageViewerService = inject(ImageViewerService);
  private readonly tasks: PendingTasks = inject(PendingTasks);
  private readonly ownChoice: Signal<ComposerSettings | null>;
  private readonly keptChoice: Signal<ConversationResponder | null | undefined>;
  private catalogGeneration: number = 0;
  private readonly resynced: WritableSignal<number> = signal(0);
  private readonly catalogReads: CatalogReads = new CatalogReads();
  private catalogsResynced: number = 0;
  private reconcileProvider: string | null = null;
  private keptConversationId: string | null = null;
  private lastKept: ConversationResponder | null | undefined = undefined;
  private restorations: number = 0;
  private shownConversationId: string = String.empty;

  protected readonly resources: typeof Resources = Resources;
  protected readonly variants: typeof ButtonVariant = ButtonVariant;
  protected readonly alignments: typeof OverlayAlignment = OverlayAlignment;
  protected readonly folds: typeof ComposerBar = ComposerBar;
  protected readonly fold: WritableSignal<number> = signal(ComposerBar.unfolded);
  protected readonly opensAtRefresh: WritableSignal<boolean> = signal(false);
  protected readonly store: ChatStoreService = inject(ChatStoreService);
  protected readonly canCopy: boolean = this.viewer.canCopy;
  protected readonly copying: Signal<boolean> = this.viewer.copying;
  protected readonly alternative: Signal<ImageOpenMode> =
    computed(() => this.viewer.openMode() === ImageOpenMode.Popup ? ImageOpenMode.Tab : ImageOpenMode.Popup);
  protected readonly value: WritableSignal<string> = signal(String.empty);
  private readonly editingSignal: WritableSignal<WaitingMessage | null> = signal(null);
  protected readonly editing: Signal<WaitingMessage | null> = computed(() => {
    const editing = this.editingSignal();
    return !Object.isNull(editing) && this.store.waitingOf(this.conversationId()).some(t => t.id === editing.id) ? editing : null;
  });
  protected readonly deliveries: readonly MessageDelivery[] = Object.values(MessageDelivery);
  protected readonly isMac: boolean = navigator.platform.startsWith(Resources.macPlatformPrefix);
  protected readonly text: Signal<string> = computed(() => MentionValue.parse(this.value()).text);
  protected readonly attachments: WritableSignal<readonly ComposerAttachment[]> = signal([]);
  protected readonly attachmentError: WritableSignal<string | null> = signal(null);
  protected readonly filesRefused: WritableSignal<boolean> = signal(false);
  protected readonly signOutNote: WritableSignal<string | null> = signal(null);
  protected readonly signOutFailure: WritableSignal<string | null> = signal(null);
  protected readonly preparing: WritableSignal<boolean> = signal(false);
  protected readonly restoring: WritableSignal<boolean> = signal(true);
  protected readonly dropping: WritableSignal<boolean> = signal(false);
  protected readonly kind: WritableSignal<string | null> = signal(null);
  protected readonly model: WritableSignal<string | null> = signal(null);
  protected readonly effort: WritableSignal<string | null> = signal(null);
  protected readonly speed: WritableSignal<string | null> = signal(null);
  protected readonly mode: WritableSignal<string | null> = signal(null);
  protected readonly providerId: WritableSignal<string | null> = signal(null);
  protected readonly responderId: WritableSignal<string | null> = signal(null);
  protected readonly catalog: WritableSignal<ModelCatalog> = signal(ComposerComponent.emptyCatalog());
  protected readonly modelsLoading: WritableSignal<boolean> = signal(false);
  protected readonly runningReply: Signal<Message | null>;
  protected readonly stopping: Signal<boolean>;
  protected readonly activeResponderId: Signal<string | null>;
  protected readonly responder: Signal<Teammate | null>;
  protected readonly memberSettings: Signal<ChatMemberSettings | null>;
  protected readonly memberTeammates: Signal<readonly Teammate[]>;
  protected readonly candidates: Signal<readonly MentionCandidate[]>;
  protected readonly chosenKind: Signal<string | null>;
  protected readonly chosenDescriptor: Signal<ProviderKind | undefined>;
  protected readonly chosenProvider: Signal<string | null>;
  private readonly ownProvider: Signal<string | null>;
  protected readonly needsProvider: Signal<boolean>;
  protected readonly chosenModel: Signal<string | null>;
  protected readonly chosenEffort: Signal<string | null>;
  protected readonly selectedModel: Signal<ProviderModel | undefined>;
  protected readonly effortLevels: Signal<readonly string[]>;
  protected readonly recommendedEffort: Signal<string | null>;
  protected readonly selectedEffort: Signal<string | null>;
  protected readonly effortName: Signal<string>;
  protected readonly speeds: Signal<readonly ProviderSpeed[]>;
  protected readonly chosenSpeed: Signal<string | null>;
  protected readonly defaultSpeed: Signal<string | null>;
  private readonly thread: Signal<ChatThread | null>;
  private readonly catalogFolder: Signal<string | null>;
  protected readonly speedNote: Signal<string | null>;
  protected readonly chosenMode: Signal<string | null>;
  protected readonly selectedMode: Signal<ProviderMode | undefined>;
  protected readonly modeName: Signal<string>;
  protected readonly defaultModeId: Signal<string | null>;
  protected readonly defaultModeTag: Signal<string>;
  protected readonly permissionsTitle: Signal<string>;
  protected readonly unrestricted: Signal<boolean>;
  protected readonly planFirstOffered: Signal<boolean>;
  protected readonly planFirstRefusal: Signal<string | null>;
  protected readonly refusedModes: Signal<readonly RefusedMode[]>;
  protected readonly planFirst: Signal<boolean>;
  protected readonly accessName: Signal<string>;
  protected readonly accessGlyph: Signal<string>;
  protected readonly providers: Signal<readonly ProviderChoice[]>;
  protected readonly otherProviders: Signal<readonly ProviderChoice[]>;
  protected readonly selectedProvider: Signal<ProviderChoice | undefined>;
  protected readonly pickedProvider: Signal<ProviderChoice | undefined>;
  private readonly chosenProfileDir: Signal<string | null>;
  protected readonly chatContext: Signal<ChatContext | null>;
  protected readonly contextTeammate: Signal<string>;
  protected readonly imagesUnsupported: Signal<boolean>;
  protected readonly imagesLeftOut: Signal<readonly string[]>;
  protected readonly canCompose: Signal<boolean>;
  protected readonly canSend: Signal<boolean>;
  protected readonly unavailableReason: Signal<string | null>;
  protected readonly unlistedReason: Signal<string | null>;
  protected readonly defaultModelName: Signal<string | null>;
  protected readonly defaultModelLabel: Signal<string>;
  protected readonly planNote: Signal<string | null>;
  protected readonly summary: Signal<string>;
  protected readonly who: Signal<string>;
  protected readonly buttonLabel: Signal<string>;
  protected readonly providerLine: Signal<string | null>;
  protected readonly hasEfforts: Signal<boolean>;
  protected readonly effortRefusal: Signal<string | null>;
  protected readonly speedRefusal: Signal<string | null>;
  protected readonly modelName: Signal<string | null>;
  private readonly catalogs: WritableSignal<ReadonlyMap<string, ModelCatalog>> = signal(new Map());
  private readonly defaultLabel: Signal<string>;

  public readonly conversationId: InputSignal<string> = input.required<string>();
  public readonly teammateId: InputSignal<string | null> = input<string | null>(null);
  public readonly fanOut: InputSignal<ComposerFanOut | null> = input<ComposerFanOut | null>(null);
  public readonly whileReplying: InputSignal<MessageDelivery | null> = input<MessageDelivery | null>(null);

  protected readonly isFanOut: Signal<boolean> = computed(() => !Object.isNull(this.fanOut()));
  protected readonly replyingDelivery: Signal<MessageDelivery> = computed(() => this.whileReplying() ?? this.store.whileReplying());

  public constructor() {
    const store = this.store;
    this.teammateMentions = computed(() => Object.isNull(this.teammateId()) && !this.isFanOut() ? store.teammates().map(t => new TeammateMention(t.id, t.name)) : []);
    this.ownChoice = computed(() => this.choices.choiceOf(this.conversationId()), { equal: (a, b) => a === b || (!Object.isNull(a) && a.equals(b)) });
    this.keptChoice = computed(() => store.conversation(this.conversationId())?.responder, { equal: ComposerComponent.sameResponder });
    this.runningReply = computed(() => store.runningReplyOf(this.conversationId()));
    this.stopping = computed(() => store.isStopping(this.conversationId()));
    this.activeResponderId = computed(() => {
      const id = this.responderId();
      return Object.isNull(id) || store.isTeammateUnavailable(id) ? null : id;
    });
    this.responder = computed(() => store.teammate(this.activeResponderId()));
    this.memberSettings = computed(() => {
      const id = this.activeResponderId();
      return store.membersOf(this.conversationId()).find(t => t.teammateId === id)?.settings ?? null;
    });
    this.memberTeammates = computed(() => NameOrder.sort(store.membersOf(this.conversationId())
      .map(t => store.teammate(t.teammateId)).filter((t): t is Teammate => !Object.isNull(t)), t => t.name));
    this.candidates = computed(() => {
      if (!Object.isNull(this.teammateId()) || this.isFanOut())
        return [];
      const members = this.memberTeammates();
      const candidates = new TeammateCandidates();
      const options = (section: string) => (teammate: Teammate): IMentionCandidateOptions =>
        ({ initials: TeammateName.initials(teammate.name), section, unavailable: store.isTeammateUnavailable(teammate.id) });
      return [
        ...candidates.of(members, options(Resources.conversationMembersLabel)),
        ...candidates.of(store.teammates().filter(t => !members.includes(t)), options(Resources.otherTeammatesLabel))
      ];
    });
    this.chosenKind = computed(() => {
      const responder = this.responder();
      return Object.isNull(responder) ? this.kind() : store.providers().find(t => t.id === responder.providerId)!.kind;
    });
    this.chosenDescriptor = computed(() => store.kinds().find(t => t.id === this.chosenKind()));
    this.ownProvider = computed(() => this.providerId() ?? store.usualProviderOf(this.kind()));
    this.chosenProvider = computed(() => {
      const responder = this.responder();
      return Object.isNull(responder) ? this.ownProvider() : responder.providerId;
    });
    this.needsProvider = computed(() => Object.isNull(this.responder()) && !Object.isNull(this.kind()) && Object.isNull(this.ownProvider()));
    this.chosenModel = computed(() => {
      const responder = this.responder();
      return Object.isNull(responder) ? this.model() : (this.memberSettings() ?? responder).model;
    });
    this.chosenEffort = computed(() => {
      const responder = this.responder();
      return Object.isNull(responder) ? this.effort() : (this.memberSettings() ?? responder).effort;
    });
    this.thread = computed(() => this.threadOf(this.chosenKind(), this.chosenProvider(), this.responderId(), this.chosenModel(), this.chosenEffort()));
    this.catalogFolder = computed(() => this.chosenDescriptor()?.followsOwnConfig === true ? store.folderOf(this.conversationId()) : null);
    this.selectedModel = computed(() => this.catalog().models.find(t => t.matches(this.chosenModel())));
    this.effortLevels = computed(() => this.catalog().effortLevelsOf(this.chosenModel()));
    this.recommendedEffort = computed(() => this.catalog().defaultEffortOf(this.chosenModel()));
    this.selectedEffort = computed(() => this.chosenEffort() ?? this.thread()?.effort ?? this.catalog().selectedEffortOf(this.chosenModel()));
    this.effortName = computed(() => {
      const thread = this.thread();
      return Object.isNull(thread) ? this.catalog().effortName(this.chosenModel(), this.chosenEffort()) : this.catalog().effortName(thread.model, thread.effort);
    });
    this.providers = computed(() => ProviderChoice.saved(store.enabledProviders(), store.kinds()).filter(t => t.kind === this.chosenKind()));
    this.otherProviders = computed(() => ProviderChoice.saved(store.enabledProviders().filter(t => t.kind !== this.chosenKind() && ![AuthStatus.LoggedOut, AuthStatus.Expired].includes(t.authStatus)), store.kinds()));
    this.selectedProvider = computed(() => this.providers().find(t => t.providerId === this.chosenProvider()));
    this.pickedProvider = computed(() => {
      const responder = this.responder();
      return (Object.isNull(responder) ? undefined : this.store.teammateMoves().get(responder.id)) ?? this.selectedProvider();
    });
    this.chosenProfileDir = computed(() => store.providers().find(t => t.id === this.chosenProvider())?.profileDir ?? null);
    this.defaultLabel = computed(() => {
      const disabled = store.providers().find(t => t.id === this.chosenProvider() && !t.enabled);
      return Object.isUndefined(disabled) ? this.selectedProvider()?.fullLabel ?? store.kinds().find(t => t.id === this.kind())?.displayName ?? Resources.teamRunLabel
        : Resources.formatDisabledProviderOption(ProviderChoice.ofProvider(disabled, store.kinds()).fullLabel);
    });
    this.chatContext = computed(() => store.contextOf(this.conversationId(), this.activeResponderId()));
    this.contextTeammate = computed(() => this.responder()?.name ?? store.kinds().find(t => t.id === this.kind())?.displayName ?? Resources.teamRunLabel);
    const hasImages = computed(() => this.attachments().some(t => t.isImage));
    const recipients = computed(() => {
      const mentioned = MentionResolver.resolve(this.text(), this.teammateMentions()).map(t => store.teammate(t.teammateId))
        .filter((t): t is Teammate => !Object.isNull(t));
      const responder = this.responder();
      return mentioned.length > 0 ? mentioned : Object.isNull(responder) ? null : [responder];
    });
    const parties = computed(() => [...new Set([...this.memberTeammates(), ...recipients() ?? []])].filter(t => !store.isTeammateUnavailable(t.id)));
    const takesImages = (teammate: Teammate): boolean | null => {
      const model = (store.membersOf(this.conversationId()).find(t => t.teammateId === teammate.id)?.settings ?? teammate).model;
      return this.catalogOf(teammate)?.models.find(t => t.matches(model))?.supportsImages ?? null;
    };
    this.imagesUnsupported = computed(() => hasImages()
      && [...parties().map(takesImages), ...Object.isNull(recipients()) ? [this.selectedModel()?.supportsImages] : []].every(t => t === false));
    this.imagesLeftOut = computed(() => {
      const named = recipients();
      if (!hasImages())
        return [];
      if (Object.isNull(named))
        return this.selectedModel()?.supportsImages === false ? [this.defaultLabel()] : [];
      return named.filter(t => takesImages(t) === false).map(t => t.name);
    });
    effect(() => {
      const teammates = [...this.memberTeammates(), ...hasImages() ? parties() : []].flatMap(t => {
        const provider = store.providers().find(u => u.id === t.providerId);
        return Object.isUndefined(provider) || store.isTeammateUnavailable(t.id) ? [] : [new CatalogSource(provider.kind, t.providerId)];
      });
      const kind = this.kind();
      const wanted: readonly CatalogSource[] = Object.isNull(this.responder()) || Object.isNull(kind) ? teammates : [...teammates, new CatalogSource(kind, this.ownProvider())];
      const loaded = untracked(() => this.catalogs());
      const resynced = this.resynced();
      const fresh = resynced !== this.catalogsResynced;
      this.catalogsResynced = resynced;
      for (const source of wanted) {
        const key = ComposerComponent.catalogKey(source.kind, source.providerId);
        if (fresh || !loaded.has(key))
          this.catalogReads.follow(key, store.modelCatalogs.load(source.kind, source.providerId), t => this.catalogs.update(u => new Map(u).set(key, t)));
      }
    });
    this.canCompose = computed(() => !this.preparing() && !this.restoring());
    this.canSend = computed(() => this.canCompose() && !store.isBusy() && !this.modelsLoading() && !this.imagesUnsupported() && !Object.isNull(this.kind())
      && !this.needsProvider()
      && (!String.isNullOrWhitespace(this.text()) || this.attachments().length > 0));
    this.unavailableReason = computed(() => {
      const name = this.chosenDescriptor()?.displayName;
      if (Object.isUndefined(name))
        return null;
      if (this.needsProvider())
        return Resources.formatProviderNeeded(name);
      const catalog = this.catalog();
      if (store.providers().find(t => t.id === this.chosenProvider())?.authStatus === AuthStatus.LoggedOut || catalog.signedIn === false)
        return Resources.formatProviderNotSignedIn(name);
      return !this.modelsLoading() && catalog.failed && catalog.models.length === 0 ? Resources.formatProviderModelsUnavailable(name) : null;
    });
    this.unlistedReason = computed(() => {
      const descriptor = this.chosenDescriptor();
      const catalog = this.catalog();
      if (Object.isUndefined(descriptor) || this.modelsLoading() || !catalog.unlisted && !catalog.empty && !catalog.awaitsTurn)
        return null;
      if (catalog.empty)
        return Resources.formatWithPlanChange(Resources.formatModelsCameBackEmpty(descriptor.displayName), descriptor.id, this.chosenProfileDir());
      if (catalog.awaitsTurn)
        return Resources.formatModelsAwaitFirstReply(descriptor.displayName);
      return Resources.formatModelsNotListed(descriptor.displayName);
    });
    this.defaultModelName = computed(() => {
      const thread = this.thread();
      return Object.isNull(thread) ? this.chosenDescriptor()?.defaultModelName ?? this.catalog().defaultModelName
        : this.catalog().models.find(t => t.matches(thread.model))?.displayName ?? thread.model;
    });
    this.defaultModelLabel = computed(() => this.defaultModelName() ?? Resources.providerDefaultModel);
    this.planNote = computed(() => {
      const note = this.modelsLoading() ? null : this.catalog().planNote(this.defaultModelLabel());
      const kind = this.chosenKind();
      return Object.isNull(note) || Object.isNull(kind) ? null : Resources.formatWithPlanChange(note, kind, this.chosenProfileDir());
    });
    this.hasEfforts = computed(() => this.effortLevels().length > 0 || !Object.isNull(this.chosenEffort() ?? this.catalog().selectedEffortOf(this.chosenModel())));
    this.speeds = computed(() => this.catalog().speedsOf(this.chosenModel()));
    this.effortRefusal = computed(() => AbilityRefusal.of(this.chosenDescriptor(), ProviderAbility.ChooseEffort, Resources.changeEffortAction));
    this.speedRefusal = computed(() => AbilityRefusal.of(this.chosenDescriptor(), ProviderAbility.ChooseSpeed, Resources.changeSpeedAction));
    this.chosenSpeed = computed(() => {
      const responder = this.responder();
      return Object.isNull(responder) ? this.speed() : (this.memberSettings() ?? responder).speed;
    });
    this.defaultSpeed = computed(() => this.catalog().defaultSpeedOf(this.thread()?.model ?? this.chosenModel()));
    this.speedNote = computed(() => {
      const speed = this.store.chatSpeedOf(this.conversationId(), this.responderId());
      if (Object.isNull(speed) || Object.isNull(speed.unavailable) || Object.isNull(this.chosenSpeed()))
        return null;
      const served = speed.served;
      return Resources.formatSpeedUnavailable(speed.unavailable,
        Object.isNull(served) ? null : this.speeds().find(t => t.id === served)?.name ?? Resources.formatEffort(served));
    });
    this.chosenMode = computed(() => {
      const responder = this.responder();
      if (Object.isNull(responder))
        return this.mode();
      const member = store.membersOf(this.conversationId()).find(t => t.teammateId === responder.id)?.mode ?? null;
      return this.catalog().resolveMode(member) ?? responder.mode;
    });
    this.selectedMode = computed(() => this.catalog().modeOf(this.chosenMode()));
    this.modeName = computed(() => {
      const chosen = this.chosenMode();
      return this.selectedMode()?.name ?? (Object.isNull(chosen) ? Resources.permissionsLabel : Resources.formatUnlisted(chosen));
    });
    this.defaultModeId = computed(() => this.responder()?.mode ?? this.catalog().defaultMode);
    this.defaultModeTag = computed(() => {
      const responder = this.responder();
      return Object.isNull(responder) ? Resources.defaultModeTag : Resources.formatOwnDefaultMode(responder.name);
    });
    this.permissionsTitle = computed(() => Resources.formatChatPermissionsOf(this.chosenDescriptor()!.displayName));
    this.unrestricted = computed(() => this.selectedMode()?.unrestricted === true);
    this.planFirstOffered = computed(() => !Object.isNull(this.catalog().planMode) && this.selectedMode()?.readOnly !== true);
    this.refusedModes = computed(() => RefusedMode.of(this.chosenDescriptor(), this.catalog().modes));
    this.planFirstRefusal = computed(() => this.selectedMode()?.readOnly === true ? null
      : AbilityRefusal.of(this.chosenDescriptor(), ProviderAbility.PlanMode, Resources.planFirstAction));
    this.planFirst = computed(() => this.planFirstOffered() && store.conversation(this.conversationId())?.plansFirst(this.responder()?.id ?? null) === true);
    this.accessName = computed(() => this.planFirst() ? Resources.planFirstLabel : this.modeName());
    this.accessGlyph = computed(() => this.planFirst() ? Resources.planFirstGlyph : this.unrestricted() ? Resources.unrestrictedModeGlyph : Resources.permissionsGlyph);
    this.modelName = computed(() => {
      const chosen = this.chosenModel();
      const fallback = this.defaultModelName();
      return Object.isNull(chosen) ? fallback : this.selectedModel()?.displayName
        ?? (!Object.isNull(fallback) && this.catalog().knowsModels ? Resources.formatModelNotAvailable(fallback, chosen) : chosen);
    });
    this.who = computed(() => {
      const responder = this.responder();
      return Object.isNull(responder) ? this.chosenDescriptor()?.displayName ?? Resources.teamRunLabel : Resources.formatMention(responder.name);
    });
    this.buttonLabel = computed(() => [this.who(), this.modelName(), ...this.hasEfforts() && Object.isNull(this.effortRefusal()) ? [this.effortName()] : []]
      .filter(t => !Object.isNull(t)).join(Resources.titleSeparator));
    this.providerLine = computed(() => {
      const kind = this.chosenDescriptor();
      if (Object.isUndefined(kind))
        return null;
      const left = this.usage.leftLabel(store.planUsageOf(kind.id, this.chosenProvider()));
      const name = this.providerNameOf(kind);
      return Object.isNull(left) ? name : `${name}${Resources.titleSeparator}${left}`;
    });
    this.summary = computed(() => {
      const responder = this.responder();
      const provider = this.selectedProvider();
      const model = this.modelName();
      const parts = [responder?.name ?? this.defaultLabel()];
      if (!Object.isNull(model))
        parts.push(model);
      if (!Object.isNull(this.chosenEffort()))
        parts.push(this.effortName());
      if (!Object.isNull(responder) && !Object.isUndefined(provider))
        parts.push(provider.fullLabel);
      if (this.unrestricted())
        parts.push(this.modeName());
      return parts.join(Resources.titleSeparator);
    });

    effect(() => {
      this.chosenKind();
      this.chosenProvider();
      this.catalogFolder();
      untracked(() => this.loadModels());
    });
    effect(() => {
      const kinds = store.kinds();
      const own = this.ownChoice();
      const kept = this.keptChoice();
      const conversationId = this.conversationId();
      const preferred = store.defaultTeammate();
      const only = store.onlyTeammateChoice();
      untracked(() => {
        const first = kinds.at(0);
        if (Object.isUndefined(first))
          return;
        const follows = !Object.isNullOrUndefined(kept) && (conversationId !== this.keptConversationId || !ComposerComponent.sameResponder(kept, this.lastKept));
        const fresh = Object.isNullOrUndefined(kept) ? ComposerSettings.startingWith(preferred, null) ?? only : null;
        const carried = Object.isNull(this.kind()) ? this.defaults.defaultChoice()
          : conversationId === this.keptConversationId ? null : this.currentSettings()!.withResponder(null);
        const found = own ?? fresh ?? carried?.withMode(null) ?? null;
        const opens = Object.isNull(own) && Object.isNullOrUndefined(kept) && (!Object.isNull(found) || Object.isNull(this.kind()));
        const local = opens ? this.store.startingChoiceOf(this.store.membersOf(conversationId).map(t => t.teammateId), found) : found;
        const listed = Object.isNull(local) || !kinds.some(t => t.id === local.kind) ? null : local;
        const base = listed ?? this.currentSettings() ?? new ComposerSettings(first.id, null, null, null);
        const remembered = follows ? base.following(kept!) : local;
        const applies = !Object.isNull(remembered) && kinds.some(t => t.id === remembered.kind);
        if (applies) {
          if (!remembered.equals(this.currentSettings()))
            this.applySettings(remembered);
          if (follows && !remembered.equals(own))
            this.choices.remember(conversationId, remembered);
        }
        else if (Object.isNull(this.kind()))
          this.selectKind(first.id, false);
        if (!follows || applies) {
          this.keptConversationId = conversationId;
          this.lastKept = kept;
        }
        if (!follows)
          this.keepChoice();
      });
    });
    effect(() => {
      const id = this.conversationId();
      untracked(() => void this.restore(id));
    });
    effect(() => {
      const offer = store.rewoundDraft();
      if (!Object.isNull(offer) && !this.restoring() && !this.preparing() && offer.conversationId === this.conversationId())
        untracked(() => this.receive(offer));
    });
    const removeSave = this.context.registerSave(() => this.drafts.save());
    const refocused = (): void => {
      if (this.catalog().signedIn === false || this.chosenDescriptor()?.followsOwnConfig === true)
        this.loadModels(true, true);
    };
    globalThis.addEventListener("focus", refocused);
    const unwatchDeletions = store.onConversationDeleted(t => this.drafts.drop(t));
    const unwatchStale = this.drafts.onStale(t => {
      if (t === this.conversationId())
        void this.restore(t);
    });
    const unwatchReplies = store.onReplyEnded(t => {
      if ((this.catalog().awaitsTurn || this.chosenDescriptor()?.followsOwnConfig === true) && t.provenance?.requested.kind === this.chosenKind() && t.provenance.providerId === this.chosenProvider())
        this.loadModels(true, true);
    });
    const unwatchResync = EngineResync.on(this.context, () => {
      this.loadModels(true, true);
      this.resynced.update(t => t + 1);
    });
    const status = PlanUsageStatus.of(this.context);
    effect(() => {
      const conversationId = this.conversationId();
      if (store.shownConversationId() !== conversationId)
        return;
      const kind = this.chosenKind();
      const provider = this.chosenProvider();
      const plan = Object.isNull(kind) ? null : store.planUsageOf(kind, provider);
      const shown = this.usage.planStatus(plan, this.defaultLabel());
      untracked(() => {
        if (!Object.isNull(kind) && Object.isNull(plan))
          void store.readPlanUsage(kind, provider);
        status?.show(conversationId, shown);
      });
    });
    afterNextRender(() => {
      this.fitObserver.observe(this.host);
      this.fitObserver.observe(this.addButton().nativeElement);
    });
    effect(() => {
      const gauge = this.gauge();
      untracked(() => {
        if (Object.isUndefined(gauge))
          afterNextRender(() => this.refold(), { injector: this.injector });
        else
          this.fitObserver.observe(gauge.labelElement);
      });
    });
    effect(() => {
      this.buttonLabel();
      this.accessName();
      this.providerLine();
      untracked(() => afterNextRender(() => this.refold(), { injector: this.injector }));
    });
    inject(DestroyRef).onDestroy(() => {
      this.fitObserver.disconnect();
      status?.release(this.conversationId());
      globalThis.removeEventListener("focus", refocused);
      this.restorations++;
      removeSave();
      unwatchDeletions();
      unwatchStale();
      unwatchReplies();
      unwatchResync();
      void this.drafts.flush();
      for (const attachment of this.attachments())
        attachment.dispose();
    });
    effect(() => {
      const id = this.responderId();
      if (Object.isNull(this.teammateId()) && !Object.isNull(id) && store.screenConversationId() === this.conversationId() && !this.memberTeammates().some(t => t.id === id))
        untracked(() => this.selectResponder(null, false));
    });
    effect(() => {
      const fixed = this.teammateId();
      if (!Object.isNull(fixed) && this.responderId() !== fixed)
        untracked(() => this.responderId.set(fixed));
    });
    effect(onCleanup => {
      const conversationId = this.conversationId();
      if (this.restoring())
        return;
      onCleanup(untracked(() => CommandTargetsService.of(this.context).provideComposer(conversationId, () => this.focusBox(), () => this.isFresh(conversationId),
        () => this.openSettings(), () => this.isTyping())));
    });
    effect(() => {
      if (!this.shown() || !this.focusOnShow())
        return;
      this.focusOnShow.set(false);
      untracked(() => this.box().nativeElement.focus());
    });
    effect(() => {
      if (this.store.kindsFailed())
        return;
      untracked(() => {
        const retry = this.retry()?.nativeElement;
        if (!Object.isUndefined(retry) && retry === retry.ownerDocument.activeElement)
          this.box().nativeElement.focus();
      });
    });
  }

  public stopOnEscape(event: KeyboardEvent): void {
    const target = event.target;
    if (event.key !== Resources.escapeKey || event.defaultPrevented || event.isComposing || !(target instanceof Element) || this.ownsEscape(target))
      return;
    if (!Object.isNull(this.editing()) && this.card().nativeElement.contains(target)) {
      event.preventDefault();
      this.cancelEditing();
      return;
    }
    const reply = this.runningReply();
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || Object.isNull(reply) || this.stopping())
      return;
    event.preventDefault();
    void this.stop();
  }

  private ownsEscape(target: Element): boolean {
    return target !== this.box().nativeElement && !Object.isNull(target.closest(Resources.escapeOwnersSelector));
  }

  private openSettings(): void {
    if (Object.isNull(this.kind()))
      return;
    this.opensAtRefresh.set(true);
    this.picker().openFocusing(Resources.programFocusOrigin);
    afterNextRender(() => this.opensAtRefresh.set(false), { injector: this.injector });
  }

  private isTyping(): boolean {
    return document.hasFocus() && document.activeElement === this.box().nativeElement && !String.isNullOrWhitespace(this.text());
  }

  private focusBox(): void {
    if (untracked(this.shown))
      this.box().nativeElement.focus();
    else
      this.focusOnShow.set(true);
  }

  private static catalogKey(kind: string, providerId: string | null): string {
    return JSON.stringify([kind, providerId]);
  }

  private static emptyCatalog(): ModelCatalog {
    return new ModelCatalog([], 0, false);
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.isComposing || this.box().nativeElement.getAttribute(Resources.expandedAttribute) === Resources.trueValue)
      return;
    if (event.key === Resources.arrowUpKey)
      this.editLastWaiting(event);
    if (event.key !== Resources.enterKey)
      return;
    const delivery = this.deliveryOf(event);
    if (Object.isUndefined(delivery))
      return;
    event.preventDefault();
    void this.send(delivery);
  }

  protected sendAs(delivery: MessageDelivery | null): Promise<void> {
    return this.send(delivery);
  }

  protected shortcutOf(delivery: MessageDelivery): string | null {
    const modifier = this.isMac ? Resources.macModifierKey : Resources.ctrlModifierKey;
    const modEnter = this.store.sendKey() === SendKey.ModEnter;
    if (delivery === this.replyingDelivery())
      return modEnter ? Resources.formatShortcut(modifier, Resources.enterKey) : Resources.enterKey;
    if (delivery === MessageDelivery.Queue)
      return Resources.formatShortcut(Resources.altModifierKey, Resources.enterKey);
    if (delivery === MessageDelivery.StopAndSend)
      return modEnter ? Resources.formatShortcut(modifier, Resources.shiftModifierKey, Resources.enterKey) : Resources.formatShortcut(modifier, Resources.enterKey);
    return null;
  }

  protected editWaiting(waiting: WaitingMessage): void {
    this.filesRefused.set(false);
    this.editingSignal.set(waiting);
    this.value.set(waiting.message.text);
    this.box().nativeElement.focus();
  }

  protected cancelEditing(): void {
    this.editingSignal.set(null);
    this.value.set(String.empty);
    void this.drafts.discard(this.shownConversationId);
    this.box().nativeElement.focus();
  }

  private editLastWaiting(event: KeyboardEvent): void {
    const last = this.store.waitingOf(this.conversationId()).at(-1);
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || this.text().length > 0 || this.attachments().length > 0 || Object.isUndefined(last))
      return;
    event.preventDefault();
    this.editWaiting(last);
  }

  private deliveryOf(event: KeyboardEvent): MessageDelivery | null | undefined {
    const modified = event.ctrlKey || event.metaKey;
    const modEnter = this.store.sendKey() === SendKey.ModEnter;
    if (Object.isNull(this.runningReply()) || !Object.isNull(this.editing()))
      return event.shiftKey || (modEnter && !modified) ? undefined : null;
    if (event.altKey && !modified && !event.shiftKey)
      return MessageDelivery.Queue;
    if (modEnter)
      return !modified ? undefined : event.shiftKey ? MessageDelivery.StopAndSend : null;
    if (event.shiftKey)
      return undefined;
    return modified ? MessageDelivery.StopAndSend : null;
  }

  protected submit(event: globalThis.Event): Promise<void> {
    event.preventDefault();
    return this.send();
  }

  protected showProviders(): void {
    this.context.openDocument(Resources.providersDocumentName, Resources.providersDocumentInstance, Resources.providersTitle);
  }

  protected usedUpOf(providerId: string): string | null {
    return this.usage.usedUpLabel(this.store.planUsageOfProvider(providerId));
  }

  protected editResponder(teammate: Teammate): void {
    const dialog = this.dialogs.open(TeammateDialogComponent, ".nol-teamrun-teammate-name");
    dialog.componentRef?.setInput("store", this.store);
    dialog.componentRef?.setInput("teammate", teammate);
    dialog.componentInstance?.closed.subscribe(() => dialog.close());
  }

  protected async retryKinds(): Promise<void> {
    if (!this.store.loadingKinds())
      await this.store.initialize();
  }

  protected async stop(): Promise<void> {
    this.box().nativeElement.focus();
    await this.store.stop(this.conversationId());
  }

  protected pickFiles(input: HTMLInputElement): void {
    this.addFiles(Array.from(input.files!));
    input.value = String.empty;
  }

  protected paste(event: ClipboardEvent): void {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (files.length === 0 || !this.canCompose())
      return;
    event.preventDefault();
    this.addFiles(files);
  }

  protected dragOver(event: DragEvent): void {
    if (!this.canCompose() || !Array.from(event.dataTransfer?.types ?? []).includes(Resources.filesTransferType))
      return;
    event.preventDefault();
    this.dropping.set(Object.isNull(this.editingSignal()));
  }

  protected dragLeave(): void {
    this.dropping.set(false);
  }

  protected drop(event: DragEvent): void {
    this.dropping.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length === 0)
      return;
    event.preventDefault();
    this.addFiles(files);
  }

  protected openAttachment(attachment: ComposerAttachment, frame: HTMLElement, mode: ImageOpenMode = this.viewer.openMode()): void {
    for (const tooltip of this.frameTooltips())
      tooltip.hide();
    const images = this.attachments().filter(t => !Object.isNull(t.previewUrl())).map(t => ComposerComponent.imageOf(t, this.conversationId()));
    const image = images.find(t => t.key === attachment.key)!;
    if (mode === ImageOpenMode.Tab) {
      this.viewer.openTab(image);
      return;
    }
    ImageDialogComponent.open(this.dialogs, this.viewer, new ImageViewerData(image, images), frame);
  }

  protected async copyAttachment(attachment: ComposerAttachment): Promise<void> {
    this.reportImage(await this.viewer.copyAsync(ComposerComponent.imageOf(attachment, this.conversationId())), Resources.imageCopyFailed);
  }

  protected async saveAttachment(attachment: ComposerAttachment): Promise<void> {
    this.reportImage(await this.viewer.saveAsync(ComposerComponent.imageOf(attachment, this.conversationId())), Resources.imageSaveFailed);
  }

  protected removeAttachment(attachment: ComposerAttachment): void {
    attachment.dispose();
    this.attachments.update(t => t.filter(u => u !== attachment));
    this.attachmentError.set(null);
    this.changed();
  }

  protected edit(value: string): void {
    this.value.set(value);
    this.changed();
  }

  protected selectKind(kind: string, chosen: boolean = true): void {
    if (kind === this.kind())
      return;
    this.catalog.set(ComposerComponent.emptyCatalog());
    this.modelsLoading.set(true);
    this.applySettings(new ComposerSettings(kind, null, null, this.store.startingProviderOf(kind)));
    this.keepChoice(this.conversationId(), this.currentSettings(), chosen);
  }

  protected selectOtherProvider(choice: ProviderChoice): void {
    this.catalog.set(ComposerComponent.emptyCatalog());
    this.modelsLoading.set(true);
    this.applySettings(new ComposerSettings(choice.kind, null, null, choice.providerId));
    this.keepChoice(this.conversationId(), this.currentSettings(), true);
  }

  protected addProvider(): void {
    const dialog = this.dialogs.open(ProviderDialogComponent, ".nol-teamrun-provider-name");
    dialog.componentRef?.setInput("store", this.store);
    dialog.componentRef?.setInput("chooseFolder", () => this.context.chooseFolderAsync());
    dialog.componentRef?.setInput("startingKind", this.chosenKind());
    dialog.componentInstance?.closed.subscribe(() => dialog.close());
  }

  protected selectProvider(choice: ProviderChoice): void {
    if (choice.key === this.pickedProvider()?.key)
      return;
    const teammate = this.responder();
    if (!Object.isNull(teammate)) {
      void this.store.moveTeammate(teammate.id, choice);
      return;
    }
    this.reconcileProvider = choice.key;
    this.catalog.set(ComposerComponent.emptyCatalog());
    this.modelsLoading.set(true);
    this.kind.set(choice.kind);
    this.providerId.set(choice.providerId);
    this.keepChoice(this.conversationId(), this.currentSettings(), true);
  }

  protected selectModel(model: string | null): void {
    const teammate = this.responder();
    if (!Object.isNull(teammate)) {
      const same = model === this.chosenModel();
      const own = model === teammate.model;
      void this.chooseForChat(teammate, model, same ? this.chosenEffort() : own ? teammate.effort : null, same ? this.chosenSpeed() : own ? teammate.speed : null);
      return;
    }
    this.effort.set(model === this.model() ? this.effort() : null);
    this.speed.set(model === this.model() ? this.speed() : null);
    this.model.set(model);
    this.keepChoice(this.conversationId(), this.currentSettings(), true);
  }

  protected selectEffort(effort: string | null): void {
    const teammate = this.responder();
    if (Object.isNull(teammate)) {
      this.effort.set(effort);
      this.keepChoice(this.conversationId(), this.currentSettings(), true);
    }
    else
      void this.chooseForChat(teammate, this.chosenModel(), effort, this.chosenSpeed());
  }

  protected selectSpeed(speed: string | null): void {
    const teammate = this.responder();
    if (Object.isNull(teammate)) {
      this.speed.set(speed);
      this.keepChoice(this.conversationId(), this.currentSettings(), true);
    }
    else
      void this.chooseForChat(teammate, this.chosenModel(), this.chosenEffort(), speed);
  }

  protected providerNameOf(kind: ProviderKind): string {
    const id = this.pickedProvider()?.providerId ?? this.chosenProvider();
    const provider = this.store.providers().find(t => t.id === id);
    if (Object.isUndefined(provider))
      return kind.displayName;
    const name = Resources.formatProviderChoice(provider.label, kind.displayName);
    return provider.enabled ? name : Resources.formatDisabledProviderOption(name);
  }

  protected hasSpeed(id: string): boolean {
    return this.speeds().some(t => t.id === id);
  }

  protected async makeDefault(teammate: Teammate): Promise<void> {
    const settings = this.memberSettings();
    const conversationId = this.conversationId();
    if (!Object.isNull(settings) && await this.store.editTeammate(teammate.id, teammate.providerId, () => new TeammateModelSettings(settings.model, settings.effort, settings.speed)))
      await this.store.setMemberSettings(conversationId, teammate.id, null);
  }

  private chooseForChat(teammate: Teammate, model: string | null, effort: string | null, speed: string | null): Promise<boolean> {
    const own = model === teammate.model && effort === teammate.effort && speed === teammate.speed;
    const settings = own ? null : new ChatMemberSettings(model, effort, speed);
    if (JSON.stringify(settings?.toJson() ?? null) === JSON.stringify(this.memberSettings()?.toJson() ?? null))
      return Promise.resolve(true);
    return this.store.setMemberSettings(this.conversationId(), teammate.id, settings);
  }

  protected selectMode(id: string): void {
    const catalog = this.catalog();
    const mode = id === this.defaultModeId() ? null : id;
    const teammate = this.responder();
    if (id === this.selectedMode()?.id)
      return;
    const conversationId = this.conversationId();
    UnrestrictedModeConfirmation.choose(this.dialogs, catalog.modeOf(id), this.chosenDescriptor()!.displayName, () => {
      if (!Object.isNull(teammate)) {
        void this.store.setMemberMode(conversationId, teammate.id, mode);
        return;
      }
      this.mode.set(mode);
      this.keepChoice(this.conversationId(), this.currentSettings(), true);
    });
  }

  protected togglePlanFirst(): void {
    void this.store.setPlanFirst(this.conversationId(), !this.planFirst());
  }

  protected selectResponder(id: string | null, chosen: boolean = true): void {
    this.responderId.set(id);
    this.choices.remember(this.conversationId(), new ComposerSettings(this.kind()!, this.model(), this.effort(), this.ownProvider(), id, this.speed(), this.mode()));
    this.keepChoice(this.conversationId(), this.currentSettings(), chosen);
  }

  protected loadModels(refresh: boolean = false, quiet: boolean = false): void {
    const generation = ++this.catalogGeneration;
    const kind = this.chosenKind();
    const provider = this.chosenProvider();
    if (!refresh)
      this.catalog.set(ComposerComponent.emptyCatalog());
    if (Object.isNull(kind) || (Object.isNull(provider) && Object.isNull(this.responder()))) {
      this.modelsLoading.set(false);
      return;
    }
    if (!quiet)
      this.modelsLoading.set(true);
    void this.store.modelCatalogs.load(kind, provider, refresh, this.catalogFolder()).then(t => {
      if (generation !== this.catalogGeneration)
        return;
      this.modelsLoading.set(false);
      if (quiet && t.failed && this.catalog().knowsModels)
        return;
      this.catalog.set(t);
      if (!t.failed)
        this.catalogs.update(u => new Map(u).set(ComposerComponent.catalogKey(kind, provider), t));
      if (!t.failed && Object.isNull(this.responder()) && this.reconcileProvider === this.selectedProvider()?.key) {
        const previous = this.model();
        const model = t.resolveModel(previous);
        this.model.set(model);
        this.effort.set(model === previous ? t.resolveEffort(model, this.effort()) : null);
        this.speed.set(model === previous ? t.resolveSpeed(model, this.speed()) : null);
        this.mode.set(t.resolveMode(this.mode()));
        this.reconcileProvider = null;
        this.keepChoice();
      }
    });
  }

  private threadOf(kind: string | null, providerId: string | null, teammateId: string | null, model: string | null, effort: string | null): ChatThread | null {
    return this.store.followedThreadOf(this.conversationId(), teammateId, kind, providerId, model, effort);
  }

  private catalogOf(teammate: Teammate): ModelCatalog | undefined {
    const provider = this.store.providers().find(t => t.id === teammate.providerId);
    return Object.isUndefined(provider) ? undefined : this.catalogs().get(ComposerComponent.catalogKey(provider.kind, provider.id));
  }

  private addFiles(files: readonly File[]): void {
    if (!this.canCompose())
      return;
    if (!Object.isNull(this.editing())) {
      this.filesRefused.set(true);
      return;
    }
    const existing = this.attachments();
    if (existing.length + files.length > ProtocolResources.maximumAttachments
      || files.some(t => t.size > ProtocolResources.maximumAttachmentBytes
        || (ProtocolResources.attachmentImageMediaTypes.includes(t.type) && t.size > ProtocolResources.maximumAttachmentImageBytes))) {
      this.attachmentError.set(Resources.attachmentLimitExceeded);
      return;
    }
    const added = files.map(t => new ComposerAttachment(t));
    this.attachments.set([...existing, ...added]);
    this.showPreviews(added);
    this.attachmentError.set(null);
    this.changed();
  }

  private isFresh(conversationId: string): boolean {
    return new ComposerDraft(conversationId, this.value(), this.attachments()).isEmpty && this.store.isHistoryLoaded(conversationId)
      && this.store.messageIndexOf(conversationId).length === 0;
  }

  private refold(): void {
    const form = this.form().nativeElement;
    const card = this.card().nativeElement;
    const bar = this.bar().nativeElement;
    const access = this.accessButton().nativeElement;
    const picker = this.pickerButton().nativeElement;
    const style = getComputedStyle(form);
    const inset = (Number.parseFloat(style.paddingInlineStart) || 0) + (Number.parseFloat(style.paddingInlineEnd) || 0);
    if (this.fold() >= ComposerBar.tight)
      this.tightInset = inset;
    else
      this.wideInset = inset;
    const width = (element: Element): number => element.getBoundingClientRect().width;
    const natural = (element: Element): number => {
      const text = document.createRange();
      text.selectNodeContents(element);
      return Math.max(width(element), text.getBoundingClientRect().width);
    };
    const length = (element: Element, read: (style: CSSStyleDeclaration) => string, otherwise: number = 0): number => {
      const value = Number.parseFloat(read(getComputedStyle(element)));
      return Number.isNaN(value) ? otherwise : value;
    };
    const gauge = this.gauge();
    const summary = this.pickerSummary().nativeElement;
    const chrome = length(picker, t => t.paddingInlineStart) + length(picker, t => t.paddingInlineEnd) + length(picker, t => t.borderInlineStartWidth)
      + length(picker, t => t.borderInlineEndWidth) + length(summary, t => t.columnGap) + width(this.pickerGlyph().nativeElement);
    if (this.fold() < ComposerBar.accessIcon)
      this.accessMinimum = length(access, t => t.minWidth);
    if (this.fold() < ComposerBar.accessInMenu)
      this.accessNeeds = new AccessWidths(this.accessMinimum + natural(this.accessLabel().nativeElement), this.accessMinimum,
        length(access, t => t.paddingInlineStart) + length(access, t => t.paddingInlineEnd) + length(access, t => t.borderInlineStartWidth)
        + length(access, t => t.borderInlineEndWidth) + width(this.accessMark().nativeElement));
    const line = this.line()?.nativeElement;
    const fold = new ComposerBar(width(this.host), new FoldWidths(this.wideInset, this.tightInset), length(card, t => t.maxWidth, Infinity), width(card) - width(bar),
      length(bar, t => t.columnGap), width(this.addButton().nativeElement) + width(this.barEnd().nativeElement), this.accessNeeds,
      Object.isUndefined(gauge) ? null : new FoldWidths(gauge.fullWidth(), gauge.trackWidth()),
      new FoldWidths(chrome + natural(this.pickerLabel().nativeElement), chrome + natural(this.pickerShort().nativeElement)),
      Object.isUndefined(line) ? null : width(line)).fold();
    if (fold >= ComposerBar.accessInMenu && this.accessMenu().isOpen())
      this.accessMenu().close();
    if (fold >= ComposerBar.accessInMenu && document.activeElement === access)
      picker.focus();
    if (fold < ComposerBar.accessInMenu && this.permissionsRow()?.nativeElement.contains(document.activeElement) === true)
      afterNextRender(() => this.picker().openFocusing(Resources.programFocusOrigin), { injector: this.injector });
    if (fold !== this.fold())
      afterNextRender(() => this.refold(), { injector: this.injector });
    this.fold.set(fold);
  }

  private changed(): void {
    if (!Object.isNull(this.editing()))
      return;
    const draft = new ComposerDraft(this.shownConversationId, this.value(), this.attachments());
    if (draft.isEmpty)
      void this.drafts.discard(draft.conversationId);
    else
      this.drafts.schedule(draft);
  }

  private async restore(conversationId: string): Promise<void> {
    const restoration = ++this.restorations;
    this.restoring.set(true);
    const done = this.tasks.add();
    try {
      let draft: Draft | null = null;
      let failure: string | null = null;
      try {
        draft = await this.drafts.restore(conversationId);
      }
      catch (error) {
        if (!(error instanceof DraftUnreadableException))
          throw error;
        failure = error.message;
      }
      if (restoration !== this.restorations)
        return;
      this.show(conversationId, draft);
      this.attachmentError.update(t => failure ?? t);
      this.restoring.set(false);
    }
    finally {
      done();
    }
  }

  private show(conversationId: string, draft: Draft | null): void {
    this.shownConversationId = conversationId;
    this.editingSignal.set(null);
    for (const attachment of this.attachments())
      attachment.dispose();
    this.value.set(draft?.text ?? String.empty);
    const attachments = draft?.attachments.map(t => new ComposerAttachment(t)) ?? [];
    this.attachments.set(attachments);
    this.showPreviews(attachments);
    this.attachmentError.set(Object.isNull(draft) || draft.missing.length === 0 ? null : Resources.formatDraftFilesMissing(draft.missing));
  }

  private receive(offer: RewoundDraft): void {
    this.store.clearRewoundDraft();
    if (String.isNullOrWhitespace(this.text()) && this.attachments().length === 0) {
      this.take(offer);
      return;
    }

    const dialog = this.dialogs.open(ConfirmDialogComponent, ".nol-teamrun-cancel", this.box().nativeElement);
    dialog.componentRef?.setInput("request", new ConfirmRequest(Resources.replaceDraftTitle, Resources.replaceDraftText, Resources.replaceDraftLabel, null, true));
    dialog.componentInstance?.answered.subscribe(confirmed => {
      dialog.close();
      if (confirmed && this.shownConversationId === offer.conversationId)
        this.take(offer);
    });
  }

  private take(offer: RewoundDraft): void {
    this.editingSignal.set(null);
    for (const attachment of this.attachments())
      attachment.dispose();
    this.value.set(offer.text);
    const attachments = offer.attachments.map(t => new ComposerAttachment(t));
    this.attachments.set(attachments);
    this.attachmentError.set(null);
    this.changed();
    void this.drafts.flush().then(() => this.showPreviews(attachments, offer.conversationId));
    this.box().nativeElement.focus();
  }

  private showPreviews(attachments: readonly ComposerAttachment[], conversationId: string = this.shownConversationId): void {
    for (const attachment of attachments)
      void attachment.loadPreview(path => this.store.shareAttachment(conversationId, path));
  }

  private get drafts(): IComposerDrafts {
    return this.isFanOut() ? this.keptDrafts : this.chatDrafts;
  }

  private currentSettings(): ComposerSettings | null {
    const kind = this.kind();
    return Object.isNull(kind) ? null : new ComposerSettings(kind, this.model(), this.effort(), this.ownProvider(), this.responderId(), this.speed(), this.mode());
  }

  private keepChoice(conversationId: string = this.conversationId(), settings: ComposerSettings | null = this.currentSettings(), chosen: boolean = false): void {
    const conversation = this.store.conversation(conversationId);
    if (Object.isNull(settings) || Object.isNull(conversation))
      return;
    const responder = settings.toResponder();
    if (!ComposerComponent.sameResponder(responder, conversation.responder))
      void this.store.setResponder(conversationId, responder, chosen, !chosen && Object.isNull(responder.teammateId) && Object.isNull(conversation.responder));
  }

  private static sameResponder(a: ConversationResponder | null | undefined, b: ConversationResponder | null | undefined): boolean {
    return a === b || (!Object.isNullOrUndefined(a) && !Object.isNullOrUndefined(b) && JSON.stringify(a.toJson()) === JSON.stringify(b.toJson()));
  }

  private applySettings(settings: ComposerSettings): void {
    this.reconcileProvider = null;
    this.kind.set(settings.kind);
    this.model.set(settings.model);
    this.effort.set(settings.effort);
    this.speed.set(settings.speed);
    this.mode.set(settings.mode);
    this.providerId.set(settings.providerId);
    this.responderId.set(settings.responderTeammateId);
  }

  private async send(delivery: MessageDelivery | null = null): Promise<void> {
    const kind = this.kind();
    const conversationId = this.conversationId();
    if (!this.canSend() || Object.isNull(kind))
      return;

    this.signOutNote.set(null);
    this.signOutFailure.set(null);
    const signsOut = this.signOutProviderOf();
    if (!Object.isUndefined(signsOut)) {
      await this.signOutAsync(conversationId, signsOut);
      return;
    }
    this.box().nativeElement.focus();
    const text = this.text().trim();
    const drafted = this.attachments();
    const settings = new ComposerSettings(kind, this.model(), this.effort(), this.ownProvider(), this.responderId(), this.speed(), this.mode());
    const mentions = MentionResolver.resolve(text, this.teammateMentions());
    const prepared: MessageAttachment[] = [];
    const arrivals = this.drafts.arrivalsOf(conversationId);
    this.preparing.set(true);
    try {
      if (drafted.some(t => !t.isSaved))
        await this.drafts.flush();
      const attachments: AttachmentInput[] = [];
      for (const attachment of drafted) {
        const saved = await this.store.prepareAttachment(await attachment.toInput(t => this.store.grantFile(t)));
        prepared.push(saved);
        attachments.push(new AttachmentInput(saved.name, saved.mediaType, null, saved.path));
      }
      if (await this.deliver(text, settings, conversationId, attachments, drafted.map(t => t.key), mentions.map(t => t.teammateId), delivery)) {
        if (!this.isFanOut()) {
          this.context.keepDocument(Resources.conversationDocumentName, conversationId);
          this.choices.remember(conversationId, settings);
          this.defaults.remember(settings);
        }
        const last = mentions.at(-1);
        if (!Object.isUndefined(last)) {
          this.choices.remember(conversationId, settings.withResponder(last.teammateId));
          this.keepChoice(conversationId, settings.withResponder(last.teammateId));
        }
        else if (conversationId === this.conversationId() && !settings.equals(this.currentSettings()))
          this.choices.remember(conversationId, this.currentSettings()!);
        for (const attachment of drafted)
          attachment.dispose();
        if (conversationId === this.shownConversationId) {
          this.value.set(String.empty);
          this.attachments.set([]);
        }
        void this.drafts.discard(conversationId, arrivals);
      }
    }
    catch {
      this.attachmentError.set(Resources.attachmentReadFailed);
    }
    finally {
      this.preparing.set(false);
      for (const attachment of prepared)
        await this.store.discardAttachment(attachment);
    }
  }

  private deliver(text: string, settings: ComposerSettings, conversationId: string, attachments: readonly AttachmentInput[], sources: readonly string[],
    mentioned: readonly string[], delivery: MessageDelivery | null): Promise<boolean> {
    const fanOut = this.fanOut();
    if (!Object.isNull(fanOut))
      return fanOut.send(text, settings, attachments, sources);
    const editing = this.editing();
    if (!Object.isNull(editing))
      return this.saveEdit(editing, text, conversationId, mentioned);
    if (Object.isNull(this.runningReply()))
      return this.store.send(text, settings, conversationId, attachments, mentioned, this.activeResponderId());
    return this.store.addWaiting(text, settings, conversationId, delivery ?? this.replyingDelivery(), attachments, mentioned, this.activeResponderId());
  }

  private async saveEdit(editing: WaitingMessage, text: string, conversationId: string, mentioned: readonly string[]): Promise<boolean> {
    const saved = await this.store.editWaiting(editing, text, editing.message.attachments, mentioned);
    if (saved && this.editingSignal() === editing)
      this.editingSignal.set(null);
    if (!saved && conversationId !== this.conversationId())
      this.keepHiddenDraft(new ComposerDraft(conversationId, text, []));
    return saved;
  }

  private keepHiddenDraft(draft: ComposerDraft): void {
    void this.drafts.flush();
    this.drafts.schedule(draft);
    void this.drafts.flush();
  }

  private signOutProviderOf(): string | null | undefined {
    const text = this.text();
    const spans = MentionResolver.find(text, this.teammateMentions());
    let rest = String.empty;
    let last = 0;
    for (const span of spans) {
      rest += text.slice(last, span.start);
      last = span.end;
    }
    if (this.attachments().length > 0 || (rest + text.slice(last)).trim().toLowerCase() !== Resources.logoutCommand)
      return undefined;
    const mentioned = spans.at(-1)?.mention.teammateId;
    const teammate = this.store.teammates().find(t => t.id === mentioned);
    return Object.isUndefined(teammate) ? this.chosenProvider() : teammate.providerId;
  }

  private async signOutAsync(conversationId: string, providerId: string | null): Promise<void> {
    const provider = this.store.providers().find(t => t.id === providerId && this.store.canSignOut(t));
    if (Object.isUndefined(provider)) {
      this.signOutFailure.set(Resources.logoutUnavailable);
      return;
    }
    const report = (message: string): void => this.signOutFailure.set(message);
    if (!await ProviderSignOut.confirmAsync(this.dialogs, this.store, provider, report))
      return;
    this.value.set(String.empty);
    void this.drafts.discard(conversationId);
    const isSignedOut = await ProviderSignOut.signOutAsync(this.store, provider, report);
    if (Object.isNull(isSignedOut))
      this.signOutNote.set(Resources.formatSignOutUnknown(provider.label));
    else
      this.signOutNote.set(isSignedOut ? Resources.formatSignedOut(provider.label) : Resources.formatStillSignedIn(provider.label));
  }

  private reportImage(succeeded: boolean, failure: string): void {
    if (!succeeded)
      this.attachmentError.set(failure);
    else if (this.attachmentError() === failure)
      this.attachmentError.set(null);
  }

  private static imageOf(attachment: ComposerAttachment, conversationId: string): ViewedImage {
    const url = attachment.previewUrl()!;
    const path = attachment.sharedPath;
    return Object.isNull(path)
      ? ViewedImage.fromData(attachment.key, conversationId, attachment.name, attachment.mediaType, url.slice(url.indexOf(Resources.dataUrlSeparator) + 1))
      : new ViewedImage(attachment.key, conversationId, attachment.name, attachment.mediaType, path, null);
  }
}
