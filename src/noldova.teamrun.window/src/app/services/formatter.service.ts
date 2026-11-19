/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable } from "@angular/core";
import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { DetailKind, FileChangeReader, type FileChangeSummary, type Message, MessageAuthor, MessageDetail, MessageStatus, type PermissionPayload,
  PlanStep as ReplyPlanStep, PlanStepStatus as ReplyPlanStepStatus, type Provider, type ProviderKind, ReplyAction, ReplyPlan, Resources as ProtocolResources, SubAgent, type Teammate,
  TeammateName, WrittenImageReader } from "@noldova/teamrun.protocol";
import { MessageAuthor as Author, MessageAuthorKind, Plan, PlanStep, ToolCall, ToolCallKind, ToolCallOutputState, ToolCallStatus } from "@noldova/ui.components.angular";

import { PageCardComponent } from "../components/pages/page-card/page-card.component";
import { ReplyActivity } from "../enums/reply-activity";
import { SegmentKind } from "../enums/segment-kind";
import { StepCategory } from "../enums/step-category";
import { ActivityEntry } from "../models/activity-entry";
import { ActivityStep } from "../models/activity-step";
import { BrowserStep } from "../models/browser-step";
import type { ChatThread } from "../models/chat-thread";
import { MissingImage } from "../models/missing-image";
import { ModelCatalog } from "../models/model-catalog";
import { ReplySegment } from "../models/reply-segment";
import { SustainHandover } from "../models/sustain-handover";
import { TeammateColor } from "../models/teammate-color";
import { ViewedImage } from "../models/viewed-image";
import { Resources } from "../../resources";

@Injectable({ providedIn: "root" })
export class FormatterService {
  public replyAuthor(message: Message, kinds: readonly ProviderKind[], providers: readonly Provider[], isUnavailable: boolean): Author {
    const name = this.authorLabel(message, kinds, providers);
    return new Author(message.teammateId ?? name, name, MessageAuthorKind.Agent, null, this.authorInitials(message.teammateId, name),
      TeammateColor.of(message.teammateId), null, isUnavailable);
  }

  public authorInitials(teammateId: string | null, name: string): string {
    return TeammateName.initials(Object.isNull(teammateId) ? Resources.defaultTeammateLabel : name);
  }

  public authorLabel(message: Message, kinds: readonly ProviderKind[], providers: readonly Provider[]): string {
    const provenance = message.provenance;
    return this.authorName(message.author, message.sender?.name ?? null, message.teammateName, provenance?.providerId ?? null,
      Object.isNull(provenance) ? null : provenance.observed.kind ?? provenance.requested.kind, kinds, providers);
  }

  public authorName(author: MessageAuthor, senderName: string | null, teammateName: string | null, providerId: string | null, providerKind: string | null,
    kinds: readonly ProviderKind[], providers: readonly Provider[]): string {
    if (author === MessageAuthor.User)
      return senderName ?? Resources.youLabel;
    if (Object.isNull(providerKind))
      return Resources.teamRunLabel;
    return teammateName ?? this.providerLine(providerKind, providers.find(t => t.id === providerId), kinds);
  }

  public replyProvider(message: Message, kinds: readonly ProviderKind[]): string | null {
    if (Object.isNull(message.teammateName))
      return null;
    const kind = message.provenance?.observed.kind ?? message.provenance?.requested.kind;
    return kinds.find(t => t.id === kind)?.displayName ?? null;
  }

  public providerName(kind: string, kinds: readonly ProviderKind[]): string {
    return kinds.find(t => t.id === kind)?.displayName ?? kind;
  }

  public providerLine(kind: string, provider: Provider | undefined, kinds: readonly ProviderKind[]): string {
    const name = this.providerName(kind, kinds);
    return Object.isUndefined(provider) ? name : Resources.formatProviderChoice(name, provider.label);
  }

  public teammateSummary(teammate: Teammate, providers: readonly Provider[], kinds: readonly ProviderKind[], catalog?: ModelCatalog, thread: ChatThread | null = null): string {
    const provider = providers.find(t => t.id === teammate.providerId);
    const model = thread?.model ?? teammate.model;
    return [Object.isUndefined(provider) ? Resources.unavailableTeammateLabel : this.providerLine(provider.kind, provider, kinds),
      this.modelName(model, provider?.kind ?? null, kinds, catalog), ModelCatalog.effortNameIn(catalog, model, thread?.effort ?? teammate.effort)].join(Resources.titleSeparator);
  }

  public teammateModel(teammate: Teammate, providers: readonly Provider[], kinds: readonly ProviderKind[], catalog?: ModelCatalog): string {
    return this.modelName(teammate.model, providers.find(t => t.id === teammate.providerId)?.kind ?? null, kinds, catalog);
  }

  public modelName(model: string | null, kind: string | null, kinds: readonly ProviderKind[], catalog?: ModelCatalog, listedDefault: string | null = null): string {
    return Object.isNull(model) ? kinds.find(t => t.id === kind)?.defaultModelName ?? listedDefault ?? Resources.providerDefaultModel
      : FormatterService.listedName(model, catalog);
  }

  public isActive(message: Message): boolean {
    return message.status === MessageStatus.Pending || message.status === MessageStatus.Running || message.status === MessageStatus.AwaitingApproval;
  }

  public canStop(message: Message): boolean {
    return this.isActive(message) || message.details.some(t => this.subAgentOf(t)?.isRunning === true);
  }

  public waitsOn(message: Message, askers: ReadonlySet<string | null> | null): boolean {
    return message.status === MessageStatus.AwaitingApproval || (!this.isActive(message) && !Object.isNull(askers));
  }

  public isWaitingForTurn(message: Message): boolean {
    return message.status === MessageStatus.Pending;
  }

  public isAnswer(detail: MessageDetail): boolean {
    return detail.kind === DetailKind.Text || detail.kind === DetailKind.Error;
  }

  public answers(message: Message): readonly MessageDetail[] {
    return message.details.filter(t => this.isAnswer(t));
  }

  public isGeneratedImage(detail: MessageDetail): boolean {
    const payload = FormatterService.payloadOf(detail);
    return !Object.isNull(payload) && payload[Resources.itemTypeField] === Resources.imageGenerationItemType;
  }

  public isHandOffNote(detail: MessageDetail): boolean {
    const payload = FormatterService.payloadOf(detail);
    return !Object.isNull(payload) && payload[Resources.sourceField] === Resources.handOffSource;
  }

  public static usageHandOffOf(message: Message): MessageDetail | null {
    return message.author === MessageAuthor.User ? null
      : message.details.find(t => FormatterService.payloadOf(t)?.[Resources.sourceField] === ProtocolResources.usageHandOffSource) ?? null;
  }

  public static handoverOf(detail: MessageDetail): SustainHandover | null {
    const payload = FormatterService.payloadOf(detail);
    const carried = payload?.[Resources.sustainCarriedField];
    if (!Array.isArray(carried) || carried.length === 0)
      return null;
    const reads = payload?.[Resources.sustainReadsField];
    return new SustainHandover(carried.filter(t => Object.isString(t)), Object.isString(reads) ? reads : null);
  }

  public static stopsSustain(detail: MessageDetail): boolean {
    return FormatterService.payloadOf(detail)?.[Resources.sustainStoppedField] === true;
  }

  public static handsOff(detail: MessageDetail): boolean {
    return FormatterService.payloadOf(detail)?.[Resources.handedOffField] === true;
  }

  public static steeredIntoOf(message: Message): string | null {
    return message.author !== MessageAuthor.User ? null : message.details.filter(t => t.kind === DetailKind.Text)
      .map(t => FormatterService.payloadOf(t)?.[Resources.steeredIntoField]).find(t => Object.isString(t)) ?? null;
  }

  public isWakeNote(detail: MessageDetail): boolean {
    const payload = FormatterService.payloadOf(detail);
    return !Object.isNull(payload) && payload[Resources.sourceField] === Resources.wakeSource;
  }

  public isResumeNote(detail: MessageDetail): boolean {
    const payload = FormatterService.payloadOf(detail);
    return !Object.isNull(payload) && payload[Resources.sourceField] === Resources.resumeSource;
  }

  public isSustainNote(detail: MessageDetail): boolean {
    const payload = FormatterService.payloadOf(detail);
    return !Object.isNull(payload) && payload[Resources.sourceField] === Resources.sustainSource;
  }

  public wakeNoteOf(message: Message): readonly string[] | null {
    const note = message.details.find(t => this.isWakeNote(t));
    if (Object.isUndefined(note))
      return null;
    const command = FormatterService.payloadOf(note)?.[ProtocolResources.commandField];
    const start = Object.isString(command) ? note.text.indexOf(`\`${command}\``) : -1;
    return start < 0 || !Object.isString(command) ? [note.text]
      : [note.text.slice(0, start), command, note.text.slice(start + command.length + 2)];
  }

  public isWorkingTreeEvidence(detail: MessageDetail): boolean {
    const payload = FormatterService.payloadOf(detail);
    return !Object.isNull(payload) && payload[Resources.sourceField] === Resources.workingTreeSource;
  }

  public changesNotesOf(message: Message): readonly string[] {
    return message.details.filter(t => FormatterService.payloadOf(t)?.[ProtocolResources.changesNoteField] === true).map(t => t.text);
  }

  public offersModelChoice(detail: MessageDetail): boolean {
    const payload = FormatterService.payloadOf(detail);
    return !Object.isNull(payload) && payload[ProtocolResources.actionField] === ReplyAction.ChooseModel;
  }

  public usedUpUntilOf(detail: MessageDetail | null): string | null | undefined {
    const payload = detail?.payload ?? null;
    if (!FormatterService.isJsonObject(payload) || payload[ProtocolResources.usedUpField] !== true || payload[Resources.sustainStoppedField] === true)
      return undefined;
    const until = payload[ProtocolResources.usedUpUntilField];
    return Object.isString(until) ? until : null;
  }

  public segments(message: Message): readonly ReplySegment[] {
    const segments: ReplySegment[] = [];
    const activities: ActivityEntry[][] = [];
    let steps: ActivityEntry[] = [];
    const planText = this.planOf(message)?.text?.trim() ?? null;
    const closeActivity = (): void => {
      if (steps.length > 0) {
        segments.push(new ReplySegment(SegmentKind.Activity, null, steps));
        activities.push(steps);
      }
      steps = [];
    };
    for (const detail of message.details) {
      if (detail.isNested || this.isWorkingTreeEvidence(detail) || this.isWakeNote(detail) || this.isResumeNote(detail) || this.isSustainNote(detail)
        || this.isCancellationNote(message, detail)
        || (detail.kind === DetailKind.Text && (String.isNullOrWhitespace(detail.text) || detail.text.trim() === planText)))
        continue;
      if (this.isAnswer(detail) || this.isHandOffNote(detail) || this.isGeneratedImage(detail)) {
        closeActivity();
        segments.push(new ReplySegment(this.isAnswer(detail) || this.isHandOffNote(detail) ? SegmentKind.Text : SegmentKind.Image, detail, []));
        continue;
      }
      if (detail.kind === DetailKind.Plan) {
        if (!segments.some(t => t.kind === SegmentKind.Plan) && !Object.isNull(ReplyPlan.ofDetails([detail]))) {
          closeActivity();
          segments.push(new ReplySegment(SegmentKind.Plan, detail, []));
        }
        continue;
      }
      const previous = steps.at(-1);
      if (detail.kind !== DetailKind.SubAgent && this.answerCall(detail, [...activities, steps]))
        continue;
      if (detail.kind === DetailKind.Reasoning && previous?.detail.kind === DetailKind.Reasoning) {
        const thought = previous.detail;
        steps[steps.length - 1] = new ActivityEntry(new MessageDetail(thought.sequence, thought.kind,
          `${thought.text}${Resources.paragraphSeparator}${detail.text}`, thought.payload, thought.createdAt), null);
        continue;
      }
      steps.push(new ActivityEntry(detail, null));
    }
    closeActivity();
    return segments;
  }

  public planOf(message: Message): ReplyPlan | null {
    return this.planAsShown(ReplyPlan.ofDetails(message.details), this.isActive(message));
  }

  public checklistOf(plan: ReplyPlan | null): Plan | null {
    return Object.isNull(plan) || plan.steps.length === 0 ? null : new Plan(plan.steps.map(t => new PlanStep(t.text, Resources.planStepStatuses[t.status], t.activeText)));
  }

  public planTitle(plan: ReplyPlan): string {
    return Object.isNull(plan.text) || Resources.planHeading.test(plan.text) ? Resources.planTitle : plan.title!;
  }

  public planProgress(plan: ReplyPlan): string | null {
    if (plan.rejected)
      return Resources.planNotApproved;
    if (plan.steps.length === 0)
      return plan.approved ? Resources.planApproved : null;
    return Resources.formatPlanProgress(plan.completedCount, plan.steps.length);
  }

  public generatedImageOf(message: Message, detail: MessageDetail, rootPath: string | null): ViewedImage | null {
    if (this.hasStepStatus(detail, Resources.failedStepStatuses))
      return null;
    const reader = new WrittenImageReader();
    const payload = FormatterService.payloadOf(detail)!;
    const saved = payload[Resources.savedPathField];
    const savedPath = Object.isString(saved) ? saved : null;
    const stored = reader.storedPathOf(detail);
    if (!Object.isNull(stored))
      return ViewedImage.stored(message.conversationId, message.id, stored, savedPath);
    const path = Object.isNull(rootPath) ? null : reader.generatedPathOf(detail, rootPath);
    if (!Object.isNull(path))
      return ViewedImage.written(message.conversationId, message.id, path, this.isActive(message) ? detail.sequence : null);
    const data = payload[Resources.imageDataField];
    const mediaType = payload[Resources.mediaTypeField];
    return Object.isString(data) && Object.isString(mediaType)
      ? ViewedImage.generated(message.conversationId, message.id, detail.sequence, savedPath, mediaType, data) : null;
  }

  public missingImageOf(message: Message, detail: MessageDetail, rootPath: string | null): MissingImage | null {
    if (this.hasStepStatus(detail, Resources.failedStepStatuses))
      return new MissingImage(Resources.imageGenerationFailed, FormatterService.imageFailureOf(detail));
    return this.hasStepStatus(detail, Resources.endedStepStatuses) && Object.isNull(this.generatedImageOf(message, detail, rootPath))
      ? new MissingImage(Resources.imageNotShown) : null;
  }

  public activity(message: Message): readonly ActivityEntry[] {
    return this.segments(message).flatMap(t => t.entries);
  }

  public activitySummary(entries: readonly ActivityEntry[], files: readonly FileChangeSummary[] | null = null): string {
    const counts: Record<StepCategory, number> = {
      [StepCategory.Command]: 0, [StepCategory.Edit]: 0, [StepCategory.Read]: 0, [StepCategory.Search]: 0, [StepCategory.Thought]: 0, [StepCategory.Other]: 0
    };
    for (const entry of entries.filter(t => t.detail.kind !== DetailKind.Text))
      counts[this.categoryOf(entry.detail)] += 1;
    const parts: string[] = [];
    if (counts[StepCategory.Command] > 0)
      parts.push(Resources.formatCommandCount(counts[StepCategory.Command]));
    parts.push(...this.fileChangeParts((files ?? new FileChangeReader().editsIn(entries.map(t => t.detail))).map(t => t.kind)));
    if (counts[StepCategory.Read] > 0)
      parts.push(Resources.formatReadCount(counts[StepCategory.Read]));
    if (counts[StepCategory.Search] > 0)
      parts.push(Resources.formatSearchCount(counts[StepCategory.Search]));
    if (counts[StepCategory.Thought] > 0)
      parts.push(Resources.formatThoughtCount(counts[StepCategory.Thought]));
    if (counts[StepCategory.Other] > 0)
      parts.push(Resources.formatOtherStepCount(counts[StepCategory.Other], parts.length === 0));
    return Resources.formatActivitySummary(parts);
  }

  public fileChangeParts(kinds: readonly string[]): string[] {
    const added = kinds.filter(t => t === Resources.addedChangeKind).length;
    const deleted = kinds.filter(t => t === Resources.deletedChangeKind).length;
    const edited = kinds.length - added - deleted;
    const parts: string[] = [];
    if (added > 0)
      parts.push(Resources.formatAddCount(added));
    if (edited > 0)
      parts.push(Resources.formatEditCount(edited));
    if (deleted > 0)
      parts.push(Resources.formatDeleteCount(deleted));
    return parts;
  }

  public fileChangeLabel(kind: string): string {
    if (kind === Resources.addedChangeKind)
      return Resources.addedFileLabel;
    return kind === Resources.deletedChangeKind ? Resources.deletedFileLabel : Resources.editedFileLabel;
  }

  public callsOf(message: Message, entries: readonly ActivityEntry[], rootPath: string | null, isGrowing: boolean = false, isAsking: boolean = false,
    askers: ReadonlySet<string | null> | null = null, catalog?: ModelCatalog, asked: readonly PermissionPayload[] = []): readonly ToolCall[] {
    const last = this.activity(message).at(-1)?.detail.sequence;
    const isActive = this.isActive(message);
    const isAwaiting = this.waitsOn(message, askers) && (askers?.has(null) ?? true);
    return entries.map((t, index) => {
      const agent = this.subAgentOf(t.detail);
      if (!Object.isNull(agent))
        return this.subAgentCallOf(message, t, agent, rootPath, isAsking, askers, catalog, asked);
      const isTracked = this.isTracked(t.detail);
      const isOpen = this.isOpen(t, last);
      const isLive = isGrowing && index === entries.length - 1 && t.detail.kind === DetailKind.Reasoning;
      return this.callOf(t, isActive && isOpen, rootPath, !isActive && isTracked && isOpen, isLive, isAwaiting && isOpen, isAsking, asked);
    });
  }

  public callOf(entry: ActivityEntry, isRunning: boolean, rootPath: string | null, isCutOff: boolean = false, isLive: boolean = false,
    isAwaiting: boolean = false, isAsking: boolean = false, asked: readonly PermissionPayload[] = []): ToolCall {
    const detail = entry.detail;
    const browser = BrowserStep.of(detail.payload);
    const isDenied = FormatterService.isDenied(detail) || (!Object.isNull(entry.result) && FormatterService.isDenied(entry.result)) || browser?.isDenied === true;
    const body = this.bodyOf(entry);
    const exitCode = this.exitCodeOf(detail);
    const isFailed = detail.kind === DetailKind.Error || (!Object.isNull(entry.result) && this.isErrorResult(entry.result)) || this.isFailedStep(detail);
    const isDeclined = this.stepStatusOf(detail) === Resources.declinedStepStatus;
    const status = isDenied ? ToolCallStatus.Denied : isFailed ? ToolCallStatus.Failed
      : isAwaiting ? isAsking ? ToolCallStatus.AwaitingAnswer : ToolCallStatus.AwaitingPermission
      : isRunning ? ToolCallStatus.Running : isCutOff || isDeclined ? ToolCallStatus.Cancelled : ToolCallStatus.Succeeded;
    const payload = FormatterService.payloadOf(detail);
    const isAsked = [ToolCallStatus.Running, ToolCallStatus.AwaitingPermission, ToolCallStatus.AwaitingAnswer].includes(status)
      && asked.some(t => t.isCallOf(payload?.[ProtocolResources.servedToolField], payload?.[ProtocolResources.servedInputField]));
    const title = isLive ? this.latestThought(detail) : Object.isNull(browser) ? this.stepTitle(entry, rootPath, status) : browser.title(Resources.browserStepPhases[status]);
    const fallback = isLive ? Resources.thinkingLabel : Resources.stepLabel;
    return new ToolCall(String(detail.sequence), String.isNullOrWhitespace(title) ? fallback : title, FormatterService.kindOf(this.categoryOf(detail)),
      status, { ...(Object.isNull(body) ? { outputState: ToolCallOutputState.None } : { output: body }), ...(Object.isNull(exitCode) || exitCode === 0 ? {} : { error: Resources.formatExitCode(exitCode) }),
        ...(Object.isNull(browser) || Object.isNull(browser.storedPath ?? browser.pageUrl) ? {} : { hasOutputControl: true }),
        ...(isAsked ? { note: Resources.stepWaitingNote } : {}) });
  }

  public subAgentCallOf(message: Message, entry: ActivityEntry, agent: SubAgent, rootPath: string | null, isAsking: boolean = false,
    askers: ReadonlySet<string | null> | null = null, catalog?: ModelCatalog, asked: readonly PermissionPayload[] = []): ToolCall {
    const detail = entry.detail;
    const entries = this.nestedEntriesOf(message, detail.sequence);
    const last = entries.at(-1)?.detail.sequence;
    const isAwaiting = agent.isRunning && this.waitsOn(message, askers) && (askers?.has(agent.description) ?? true);
    const children = entries.map(t => {
      const nested = this.subAgentOf(t.detail);
      if (!Object.isNull(nested))
        return this.subAgentCallOf(message, t, nested, rootPath, isAsking, askers, catalog, asked);
      const isTracked = this.isTracked(t.detail);
      const isOpen = this.isOpen(t, last);
      return this.callOf(t, agent.isRunning && isOpen, rootPath, !agent.isRunning && isTracked && isOpen, false, isAwaiting && isOpen, isAsking, asked);
    });
    const startedAt = new Date(Date.parse(detail.createdAt));
    const output = [FormatterService.usageOf(agent, catalog), FormatterService.subAgentTextOf(agent, entry.result)].filter(t => !Object.isNull(t)).join(Resources.lineSeparator);
    return new ToolCall(String(detail.sequence), Resources.formatSubAgentTitle(agent.type, agent.description), ToolCallKind.Other, Resources.subAgentStatuses[agent.status], {
      startedAt,
      ...agent.isRunning || Object.isNull(agent.durationMs) ? {} : { endedAt: new Date(startedAt.getTime() + agent.durationMs) },
      ...output.length === 0 ? { outputState: ToolCallOutputState.None } : { output },
      ...Object.isNull(this.subAgentPlanOf(message, detail.sequence)) ? {} : { hasOutputControl: true },
      children
    });
  }

  public nestedEntriesOf(message: Message, parentSequence: number): readonly ActivityEntry[] {
    const entries: ActivityEntry[] = [];
    for (const detail of message.details)
      if (detail.parentSequence === parentSequence && detail.kind !== DetailKind.Plan && (detail.kind === DetailKind.SubAgent || !this.answerCall(detail, [entries])))
        entries.push(new ActivityEntry(detail, null));
    return entries;
  }

  public screenshotOf(message: Message, sequence: number): ViewedImage | null {
    const path = FormatterService.browserStepOf(message, sequence)?.storedPath ?? null;
    return Object.isNull(path) ? null : ViewedImage.stored(message.conversationId, message.id, path, null);
  }

  public pageOf(message: Message, sequence: number): string | null {
    return FormatterService.browserStepOf(message, sequence)?.pageUrl ?? null;
  }

  public allowedWithoutAsking(message: Message): readonly string[] {
    const entries = this.activity(message);
    const calls = this.callsOf(message, entries, null);
    const steps = entries.flatMap((t, index) => {
      const step = BrowserStep.of(t.detail.payload);
      return !Object.isNull(step) && step.isAllowedWithoutAsking && calls[index]?.status === ToolCallStatus.Succeeded ? [step] : [];
    });
    let previousUrl: string | null = null;
    return steps.map(t => {
      const said = t.lineTitle(previousUrl);
      previousUrl = t.shownUrl;
      return said;
    });
  }

  public subAgentPlanOf(message: Message, sequence: number): Plan | null {
    const isRunning = message.details.some(t => t.sequence === sequence && this.subAgentOf(t)?.isRunning === true);
    return this.checklistOf(this.planAsShown(ReplyPlan.ofDetails(message.details, sequence), isRunning));
  }

  public subAgentOf(detail: MessageDetail): SubAgent | null {
    if (detail.kind !== DetailKind.SubAgent)
      return null;
    try {
      return SubAgent.fromJson(detail.payload);
    }
    catch {
      return null;
    }
  }

  public isStepRunning(message: Message, entry: ActivityEntry): boolean {
    return this.isActive(message) && this.callOf(entry, this.isOpen(entry, Math.max(...this.activity(message).map(t => t.detail.sequence))), null).status === ToolCallStatus.Running;
  }

  public stepOf(entry: ActivityEntry, rootPath: string | null): ActivityStep {
    const detail = entry.detail;
    const category = this.categoryOf(detail);
    const agent = this.subAgentOf(detail);
    const status = Object.isNull(agent) ? this.callOf(entry, false, rootPath).status : Resources.subAgentStatuses[agent.status];
    return new ActivityStep(detail.sequence, this.stepTitle(entry, rootPath, status), category, this.glyphOf(detail, category), this.bodyOf(entry),
      status === ToolCallStatus.Failed, status === ToolCallStatus.Denied);
  }

  public latestStepOf(message: Message, entries: readonly ActivityEntry[], rootPath: string | null, isGrowing: boolean): ActivityStep | null {
    const last = this.activity(message).at(-1)?.detail.sequence;
    const entry = entries.findLast(t => this.subAgentOf(t.detail)?.isRunning ?? this.isOpen(t, last)) ?? entries.at(-1);
    if (Object.isUndefined(entry))
      return null;
    const step = this.stepOf(entry, rootPath);
    const title = this.callsOf(message, [entry], rootPath, isGrowing).map(t => t.title).join("");
    return new ActivityStep(step.sequence, title, step.category, step.glyph, step.body, step.isFailed, step.isDenied);
  }

  public stepTitle(entry: ActivityEntry, rootPath: string | null, status: ToolCallStatus): string {
    const detail = entry.detail;
    return PageCardComponent.stepTitleOf(detail.payload, detail.text, entry.result?.text ?? null, status === ToolCallStatus.Running, status === ToolCallStatus.Failed)
      ?? this.title(detail, rootPath);
  }

  public bodyOf(entry: ActivityEntry): string | null {
    const own = this.body(entry.detail);
    const result = Object.isNull(entry.result) || String.isNullOrWhitespace(entry.result.text) ? null : entry.result.text;
    if (Object.isNull(own))
      return result;
    return Object.isNull(result) ? own : `${own}${Resources.lineSeparator}${result}`;
  }

  public toolName(detail: MessageDetail): string | null {
    const payload = FormatterService.payloadOf(detail);
    if (Object.isNull(payload))
      return null;
    const tool = payload[Resources.toolField];
    return Object.isString(tool) ? tool : null;
  }

  public isErrorResult(detail: MessageDetail): boolean {
    const payload = FormatterService.payloadOf(detail);
    return !Object.isNull(payload) && payload[Resources.isErrorField] === true;
  }

  public title(detail: MessageDetail, rootPath: string | null = null): string {
    if (detail.kind === DetailKind.Reasoning)
      return FormatterService.plainOf(FormatterService.firstSentence(detail.text));
    const first = FormatterService.firstLineOf(detail.text);
    const line = FormatterService.commandTitleOf(detail) ?? (this.isProse(detail) ? FormatterService.plainOf(first) : first);
    if (Object.isNull(rootPath) || String.isNullOrWhitespace(rootPath))
      return line;
    return line.split(rootPath).join(Resources.projectRootMarker);
  }

  public body(detail: MessageDetail): string | null {
    if (detail.kind === DetailKind.Reasoning) {
      const rest = detail.text.slice(FormatterService.firstSentence(detail.text).length).trimStart();
      return rest.length === 0 ? null : rest;
    }
    if (!Object.isNull(FormatterService.commandTitleOf(detail)))
      return detail.text;
    const index = detail.text.indexOf(Resources.lineSeparator);
    return index < 0 ? null : detail.text.slice(index + 1);
  }

  public modelLine(message: Message, kinds: readonly ProviderKind[], catalog?: ModelCatalog): string | null {
    const provenance = message.provenance;
    if (Object.isNull(provenance))
      return null;
    const observed = provenance.observed;
    const requested = provenance.requested;
    const kind = observed.kind ?? requested.kind;
    const fallback = kinds.find(t => t.id === kind)?.defaultModelName ?? null;
    const named = observed.model ?? requested.model;
    const model = observed.unavailableModel && !Object.isNull(requested.model)
      ? Resources.formatModelNotAvailable(fallback ?? Resources.providerDefaultModel, FormatterService.listedName(requested.model, catalog))
      : Object.isNull(named) ? fallback : FormatterService.listedName(named, catalog);
    const line = Resources.formatProvenance(null, model, observed.effort ?? requested.effort);
    return String.isNullOrWhitespace(line) ? null : line;
  }

  public activityLabel(message: Message, now: number, activity: ReplyActivity | null = null): string {
    if (this.isWaitingForTurn(message))
      return Resources.waitingForTurnLabel;
    if (Object.isNull(message.startedAt))
      return Resources.didNotStartLabel;
    const ended = Object.isNull(message.endedAt) ? now : Date.parse(message.endedAt);
    const duration = Resources.formatDuration(ended - Date.parse(message.startedAt));
    if (!this.isActive(message))
      return Resources.formatWorkedFor(duration);
    if (activity === ReplyActivity.Stopping)
      return Resources.stoppingLabel;
    if (activity === ReplyActivity.SavingCheckpoint)
      return Resources.formatSavingCheckpointFor(duration);
    const isWaitingForFirst = message.status === MessageStatus.Running && this.segments(message).length === 0;
    return activity === ReplyActivity.Thinking || isWaitingForFirst ? Resources.formatThinkingFor(duration) : Resources.formatWorkingFor(duration);
  }

  public latestThought(detail: MessageDetail): string {
    const paragraph = detail.text.split(Resources.paragraphBreak).filter(t => !String.isNullOrWhitespace(t)).at(-1) ?? String.empty;
    return FormatterService.plainOf(FormatterService.firstSentence(paragraph.trimStart()));
  }

  private isCancellationNote(message: Message, detail: MessageDetail): boolean {
    return message.status === MessageStatus.Cancelled && detail.kind === DetailKind.Note && ProtocolResources.cancelledReplyNotes.includes(detail.text);
  }

  private planAsShown(plan: ReplyPlan | null, isActive: boolean): ReplyPlan | null {
    if (Object.isNull(plan) || isActive || !plan.steps.some(t => t.status === ReplyPlanStepStatus.InProgress))
      return plan;
    return new ReplyPlan(plan.steps.map(t => t.status === ReplyPlanStepStatus.InProgress ? new ReplyPlanStep(t.text, ReplyPlanStepStatus.Pending, null) : t),
      plan.explanation, plan.text, plan.rejected, plan.approved);
  }

  private isProse(detail: MessageDetail): boolean {
    return (detail.kind === DetailKind.Note || detail.kind === DetailKind.Text) && Object.isNull(this.toolName(detail));
  }

  private glyphOf(detail: MessageDetail, category: StepCategory): string {
    if (category !== StepCategory.Other || !Object.isNull(this.toolName(detail)))
      return Resources.stepGlyphs[category];
    return Resources.detailGlyphs[detail.kind] ?? Resources.textGlyph;
  }

  private categoryOf(detail: MessageDetail): StepCategory {
    const tool = this.toolName(detail) ?? String.empty;
    if (detail.kind === DetailKind.Command || Resources.commandTools.includes(tool))
      return StepCategory.Command;
    if (detail.kind === DetailKind.FileChange)
      return StepCategory.Edit;
    const isAcp = Object.isString(FormatterService.payloadOf(detail)?.[Resources.acpToolCallIdField]);
    if ((isAcp ? Resources.acpReadKinds : Resources.readTools).includes(tool))
      return StepCategory.Read;
    if ((isAcp ? Resources.acpSearchKinds : Resources.searchTools).includes(tool))
      return StepCategory.Search;
    if (detail.kind === DetailKind.Reasoning)
      return StepCategory.Thought;
    return StepCategory.Other;
  }

  private exitCodeOf(detail: MessageDetail): number | null {
    const code = detail.kind === DetailKind.Command ? FormatterService.payloadOf(detail)?.[Resources.exitCodeField] : null;
    return Object.isNumber(code) ? code : null;
  }

  private isFailedStep(detail: MessageDetail): boolean {
    const exitCode = this.exitCodeOf(detail);
    const status = this.stepStatusOf(detail);
    return (!Object.isNull(exitCode) && exitCode !== 0) || (!Object.isNull(status) && Resources.failedStepStatuses.includes(status));
  }

  private answerCall(detail: MessageDetail, activities: readonly ActivityEntry[][]): boolean {
    const id = Object.isNull(this.toolName(detail)) ? this.toolUseIdOf(detail) : null;
    if (Object.isNull(id))
      return false;
    for (const entries of activities.toReversed()) {
      const answered = entries.findLastIndex(t => Object.isNull(t.result) && this.toolUseIdOf(t.detail) === id);
      if (answered >= 0) {
        entries[answered] = new ActivityEntry((entries[answered] as ActivityEntry).detail, detail);
        return true;
      }
    }
    return false;
  }

  private isTracked(detail: MessageDetail): boolean {
    return !Object.isNull(this.stepStatusOf(detail)) || (!Object.isNull(this.toolUseIdOf(detail)) && !Object.isNull(this.toolName(detail)));
  }

  private isOpen(entry: ActivityEntry, last: number | undefined): boolean {
    return this.isTracked(entry.detail) ? !this.hasEnded(entry) : Object.isNull(entry.result) && entry.detail.sequence === last;
  }

  private hasEnded(entry: ActivityEntry): boolean {
    const status = this.stepStatusOf(entry.detail);
    return Object.isNull(status) ? !Object.isNull(entry.result) : Resources.endedStepStatuses.includes(status);
  }

  private hasStepStatus(detail: MessageDetail, statuses: readonly string[]): boolean {
    const status = this.stepStatusOf(detail);
    return !Object.isNull(status) && statuses.includes(status);
  }

  public static subAgentModel(agent: SubAgent, catalog: ModelCatalog | undefined): string | null {
    return Object.isNull(agent.model) ? null : FormatterService.listedName(agent.model, catalog);
  }

  private static imageFailureOf(detail: MessageDetail): string | null {
    const failure = FormatterService.payloadOf(detail)![Resources.failureField] ?? null;
    if (!FormatterService.isJsonObject(failure))
      return null;
    if (failure[Resources.failureTypeField] === Resources.usageLimitFailure)
      return Resources.imageLimitReached;
    const message = failure[Resources.failureMessageField];
    return Object.isString(message) && !String.isNullOrWhitespace(message) ? message.trim() : null;
  }

  private stepStatusOf(detail: MessageDetail): string | null {
    const status = FormatterService.payloadOf(detail)?.[Resources.commandStatusField];
    return Object.isString(status) ? status : null;
  }

  private toolUseIdOf(detail: MessageDetail): string | null {
    const id = FormatterService.payloadOf(detail)?.[Resources.toolUseIdField];
    return Object.isString(id) ? id : null;
  }

  private static kindOf(category: StepCategory): ToolCallKind {
    switch (category) {
      case StepCategory.Command:
        return ToolCallKind.RunCommand;
      case StepCategory.Edit:
        return ToolCallKind.Edit;
      case StepCategory.Read:
        return ToolCallKind.Read;
      case StepCategory.Search:
        return ToolCallKind.Search;
      default:
        return ToolCallKind.Other;
    }
  }

  private static listedName(model: string, catalog: ModelCatalog | undefined): string {
    return catalog?.models.find(t => t.matches(model))?.displayName ?? model;
  }

  private static usageOf(agent: SubAgent, catalog: ModelCatalog | undefined): string | null {
    const parts = [FormatterService.subAgentModel(agent, catalog), Object.isNull(agent.toolUses) ? null : Resources.formatToolUseCount(agent.toolUses),
      Object.isNull(agent.tokens) ? null : Resources.formatTokenCount(agent.tokens.toLocaleString(Resources.usageNumberLocale))].filter(t => !Object.isNull(t));
    return parts.length === 0 ? null : parts.join(Resources.titleSeparator);
  }

  private static subAgentTextOf(agent: SubAgent, result: MessageDetail | null): string | null {
    const text = agent.isBackground || Object.isNull(result) ? agent.summary : result.text;
    return Object.isNull(text) || String.isNullOrWhitespace(text) ? null : text;
  }

  private static firstSentence(text: string): string {
    const line = FormatterService.firstLineOf(text);
    const end = Resources.sentenceEnd.exec(line);
    return Object.isNull(end) ? line : line.slice(0, end.index + end[0].length);
  }

  private static plainOf(text: string): string {
    const escaped = text.replace(Resources.markdownEscapePattern, t => String.fromCharCode(Resources.markdownEscapeBase + t.charCodeAt(1)));
    let plain = String.empty;
    let start = 0;
    for (const span of escaped.matchAll(Resources.markdownCodeSpanPattern)) {
      const code = span[2]!.replace(Resources.markdownCodeSpacePattern, Resources.markdownMarkedText);
      plain += FormatterService.unmarkedOf(escaped.slice(start, span.index)) + code.replace(Resources.markdownEscapedPattern, t => Resources.markdownEscapeMark + FormatterService.unescapedOf(t));
      start = span.index + span[0].length;
    }
    plain += FormatterService.unmarkedOf(escaped.slice(start));
    return plain.replace(Resources.markdownEscapedPattern, t => FormatterService.unescapedOf(t));
  }

  private static unmarkedOf(text: string): string {
    let unmarked = Resources.markdownLinkPatterns.reduce((t, u) => t.replace(u, Resources.markdownMarkedText), text);
    let last = String.empty;
    while (last !== unmarked) {
      last = unmarked;
      unmarked = Resources.markdownEmphasisPatterns.reduce((t, u) => t.replace(u, Resources.markdownMarkedText), unmarked);
    }
    return unmarked;
  }

  private static unescapedOf(escaped: string): string {
    return String.fromCharCode(escaped.charCodeAt(0) - Resources.markdownEscapeBase);
  }

  private static commandTitleOf(detail: MessageDetail): string | null {
    const payload = FormatterService.payloadOf(detail);
    const title = detail.kind === DetailKind.Command && !Object.isString(payload?.[Resources.acpToolCallIdField]) ? payload?.[Resources.titleField] : null;
    return Object.isString(title) && !String.isNullOrWhitespace(title) && title !== FormatterService.firstLineOf(detail.text) ? title : null;
  }

  private static firstLineOf(text: string): string {
    const index = text.indexOf(Resources.lineSeparator);
    return index < 0 ? text : text.slice(0, index);
  }

  private static browserStepOf(message: Message, sequence: number): BrowserStep | null {
    const detail = message.details.find(t => t.sequence === sequence);
    return Object.isUndefined(detail) ? null : BrowserStep.of(detail.payload);
  }

  private static isDenied(detail: MessageDetail): boolean {
    return FormatterService.payloadOf(detail)?.[Resources.deniedField] === true;
  }

  private static payloadOf(detail: MessageDetail): JsonObject | null {
    return FormatterService.isJsonObject(detail.payload) ? detail.payload : null;
  }

  private static isJsonObject(value: JsonValue): value is JsonObject {
    return Object.isObject(value) && !Array.isArray(value);
  }
}
