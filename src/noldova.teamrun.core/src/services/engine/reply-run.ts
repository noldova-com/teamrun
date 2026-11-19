/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { ServiceException } from "@noldova/teamrun.services";
import { ConversationMemberParams,
  Approval,
  type ApprovalDecideParams,
  ApprovalKind,
  ApprovalOption,
  ApprovalOutcome,
  ApprovalScope,
  ApprovalStatus,
  DetailEventPayload,
  DetailKind,
  ErrorCode,
  Event,
  EventName,
  Message,
  MessageDetail,
  MessageIdParams,
  MessageStatus,
  type ObservedSettings,
  type PlanUsage,
  type PlanWindow,
  type Provenance,
  ReplyPlan,
  type QuestionAnswer,
  type ReplyUsage,
  Resources as ProtocolResources,
  SubAgent,
  SubAgentStatus
} from "@noldova/teamrun.protocol";

import { PermissionAnswer } from "../../enums/permission-answer.js";
import { TurnOutcome } from "../../enums/turn-outcome.js";
import type { IApprovalsService } from "../../interfaces/i-approvals.service.js";
import type { IBackgroundTasksService } from "../../interfaces/i-background-tasks.service.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { ILog } from "../../interfaces/i-log.js";
import type { IMessagesService } from "../../interfaces/i-messages.service.js";
import type { IPlanUsageService } from "../../interfaces/i-plan-usage.service.js";
import type { IProviderAdapter } from "../../interfaces/i-provider-adapter.js";
import type { ITurnListener } from "../../interfaces/i-turn-listener.js";
import type { ActiveRun } from "../../models/active-run.js";
import type { ApprovalAsk } from "../../models/approval-ask.js";
import { Guid } from "../../models/guid.js";
import type { PermissionAsk } from "../../models/permission-ask.js";
import type { QuestionAsk } from "../../models/question-ask.js";
import { ReportedSharedMcpFailures } from "../../models/reported-shared-mcp-failures.js";
import type { SharedMcpFailure } from "../../models/shared-mcp-failure.js";
import type { TaskEnd } from "../../models/task-end.js";
import type { TaskStart } from "../../models/task-start.js";
import type { ToolCallRecord } from "../../models/tool-call-record.js";
import { TurnDetail } from "../../models/turn-detail.js";
import type { TurnRequest } from "../../models/turn-request.js";
import { TurnResult } from "../../models/turn-result.js";
import type { UsageLimit } from "../../models/usage-limit.js";
import type { TurnStart } from "../../models/turn-start.js";
import type { TurnSteer } from "../../models/turn-steer.js";
import type { TurnWake } from "../../models/turn-wake.js";
import type { WakeTurn } from "../../models/wake-turn.js";
import type { WorkFolder } from "../../models/work-folder.js";
import type { WorkingTreeChange } from "../../models/working-tree-change.js";
import type { ReplyEvidence } from "../../models/reply-evidence.js";
import { Resources } from "../../resources.js";
import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import type { HandoverNote } from "../sustain/handover-note.js";
import type { ChatTitles } from "./chat-titles.js";
import { CommandWrites } from "./command-writes.js";
import type { ReplyCheckpoints } from "./reply-checkpoints.js";
import { ToolWindows } from "./tool-windows.js";

export class ReplyRun implements ITurnListener {
  private readonly detailsByItem: Map<string, MessageDetail> = new Map();
  private readonly recordsByItem: Map<string, JsonObject> = new Map();
  private readonly unpairedRecords: ToolCallRecord[] = [];
  private readonly askedIds: Set<string> = new Set();
  private readonly runningSubAgents: Set<string> = new Set();
  private readonly runningTasks: Map<string, TaskStart> = new Map();
  private readonly stoppedTasks: Set<string> = new Set();
  private readonly taskStarts: Map<string, Promise<void>> = new Map();
  private message: Message;
  private provenance: Provenance;
  private readonly run: ActiveRun;
  private readonly messages: IMessagesService;
  private readonly approvals: IApprovalsService;
  private readonly events: IEventSink;
  private readonly imagesDirectory: string;
  private finished: boolean = false;
  private thinkingReported: boolean = false;
  private readonly conversations: IConversationsService | null;
  private readonly log: ILog | null;
  private readonly tasks: IBackgroundTasksService | null;
  private readonly planUsage: IPlanUsageService | null;
  private readonly wakes: ((source: Message, wake: TurnWake, ahead: boolean) => Promise<WakeTurn | null>) | null;
  private readonly checkpoints: ReplyCheckpoints | null;
  private readonly folder: WorkFolder | null;
  private readonly sharedFailures: ReportedSharedMcpFailures;
  private readonly titles: ChatTitles | null;
  private writes: CommandWrites | null = null;
  private readonly windows: ToolWindows = new ToolWindows();
  private steerTo: ((steer: TurnSteer) => Promise<boolean>) | null = null;
  private failedTurn: TurnResult | null = null;
  private stopNote: string | null = null;
  private readonly steerable: (() => Promise<void>) | null;
  private readonly account: string | null;
  private allOut: string | null = null;
  private toolCalls: Promise<void> = Promise.resolve();
  private followed: Promise<void> = Promise.resolve();

  public constructor(
    message: Message,
    provenance: Provenance,
    run: ActiveRun,
    messages: IMessagesService,
    approvals: IApprovalsService,
    events: IEventSink,
    dataDirectory: string,
    conversations: IConversationsService | null = null,
    log: ILog | null = null,
    tasks: IBackgroundTasksService | null = null,
    planUsage: IPlanUsageService | null = null,
    wakes: ((source: Message, wake: TurnWake, ahead: boolean) => Promise<WakeTurn | null>) | null = null,
    checkpoints: ReplyCheckpoints | null = null,
    folder: WorkFolder | null = null,
    sharedFailures: ReportedSharedMcpFailures = new ReportedSharedMcpFailures(),
    titles: ChatTitles | null = null,
    steerable: (() => Promise<void>) | null = null,
    account: string | null = null) {
    this.message = message;
    this.provenance = provenance;
    this.run = run;
    this.messages = messages;
    this.approvals = approvals;
    this.events = events;
    this.imagesDirectory = join(dataDirectory, Resources.imagesDirectoryName);
    this.conversations = conversations;
    this.log = log;
    this.tasks = tasks;
    this.planUsage = planUsage;
    this.wakes = wakes;
    this.checkpoints = checkpoints;
    this.folder = folder;
    this.sharedFailures = sharedFailures;
    this.titles = titles;
    this.steerable = steerable;
    this.account = account;
  }

  public get limit(): UsageLimit | null {
    return this.failedTurn?.limit ?? null;
  }

  public async noteAllOutAsync(entries: string): Promise<void> {
    this.allOut = entries;
    await this.restateFailureAsync();
  }

  public get isSteerable(): boolean {
    return !Object.isNull(this.steerTo);
  }

  public async executeAsync(adapter: IProviderAdapter, request: TurnRequest, notes: readonly string[] = [], moved: string | null = null,
    handover: HandoverNote | null = null, posted: boolean = false): Promise<void> {
    try {
      await this.startAsync();
      this.writes = this.startWrites();
      if (!Object.isNull(moved))
        await this.noteMovedAsync(moved, Object.isNull(handover) ? { source: Resources.sustainSource }
          : { source: Resources.sustainSource, [Resources.sustainHandoverField]: handover.prompt, [Resources.sustainCarriedField]: [...handover.carried],
            ...Object.isNull(handover.reads) ? {} : { [Resources.sustainReadsField]: handover.reads } }, posted);
      for (const note of notes)
        await this.appendDetailAsync(DetailKind.Note, note, { source: Resources.sharedMcpServersSource });
      const checkpoint = await this.captureAsync();
      const result = await adapter.runTurn(request, this, this.run.signal);
      await this.toolCalls;
      const compared = await this.reportChangesAsync(checkpoint);
      await this.reportCommandWritesAsync();
      await this.reportCommandNotesAsync(compared);
      await this.completeAsync(result);
    }
    catch (error) {
      await this.toolCalls;
      await this.reportCommandWritesAsync();
      await this.reportCommandNotesAsync(false);
      if (this.run.isCancelled)
        await this.completeAsync(new TurnResult(TurnOutcome.Interrupted, null, this.provenance.observed, null));
      else
        await this.failAsync(Resources.formatTurnFailed(ReplyRun.describe(error)), Resources.formatFailureKind(error));
    }
    finally {
      await this.endAsync();
    }
  }

  public async followAsync(wake: WakeTurn): Promise<void> {
    try {
      await this.startAsync();
      this.writes = this.startWrites();
      const result = await wake.follow(this, this.run.signal);
      await this.toolCalls;
      await this.reportCommandWritesAsync();
      await this.reportCommandNotesAsync(false);
      await this.completeAsync(result);
    }
    finally {
      await this.endAsync();
    }
  }

  public noteStop(reason: string): void {
    this.stopNote = Resources.formatTurnStopped(reason);
  }

  public async answerAsync(note: string): Promise<void> {
    await this.toolCalls;
    await this.startAsync();
    await this.appendDetailAsync(DetailKind.Note, note, null);
    await this.updateAsync(this.message.withStatus(MessageStatus.Completed, ReplyRun.now()));
    this.finished = true;
    this.run.close();
  }

  public async onStartedAsync(start: TurnStart): Promise<void> {
    if (this.finished)
      return;
    this.provenance = this.provenance.withNativeSession(start.nativeSessionId, start.resumedNativeSession).withRoleApplied(start.roleApplied);
    await this.saveMemberSessionAsync();
    await this.updateAsync(this.message.withProvenance(this.provenance));
  }

  public async onDetailAsync(reported: TurnDetail): Promise<void> {
    if (!this.finished) {
      await this.noteDetailAsync(reported);
      return;
    }
    const follow = (): Promise<void> => this.followDetailAsync(reported);
    const followed = this.followed.then(follow, follow);
    this.followed = followed;
    await followed;
  }

  public noteToolCall(record: ToolCallRecord): void {
    if (this.finished)
      return;
    this.toolCalls = this.toolCalls.then(() => this.onToolCalledAsync(record)).catch((error: unknown) =>
      this.log?.write(Resources.formatToolCallNotKept(this.message.conversationId, Resources.formatFailureKind(error))));
  }

  public async onTitleAsync(title: string): Promise<void> {
    if (!Object.isNull(this.titles))
      await this.titles.offerAsync(this.message.conversationId, title);
  }

  public onThinking(): void {
    if (this.finished || this.thinkingReported)
      return;
    this.thinkingReported = true;
    this.events.publish(new Event(EventName.ReplyThinking, new MessageIdParams(this.message.id).toJson()));
  }

  public async onApprovalRequested(ask: ApprovalAsk, signal?: AbortSignal): Promise<string> {
    signal?.throwIfAborted();
    const approval = new Approval(Guid.createVersion7().toString(), this.message.id, ask.kind, ask.nativeKind, ask.summary, ask.payload, ask.options,
      ApprovalStatus.Pending, null, ReplyRun.now(), null);
    return (await this.awaitDecisionAsync(approval, signal)).optionId;
  }

  public async onQuestionsAsked(ask: QuestionAsk, signal?: AbortSignal): Promise<readonly QuestionAnswer[] | null> {
    signal?.throwIfAborted();
    const approval = new Approval(Guid.createVersion7().toString(), this.message.id, ApprovalKind.Question, ask.nativeKind, ask.questions[0]!.text,
      Object.isNull(ask.subAgent) ? null : { [Resources.subAgentField]: ask.subAgent }, Resources.questionOptions, ApprovalStatus.Pending, null, ReplyRun.now(), null,
      ask.questions);
    const decision = await this.awaitDecisionAsync(approval, signal);
    return decision.optionId === Resources.answerOptionId ? decision.answers : null;
  }

  public async onQuestionsPostedAsync(ask: QuestionAsk): Promise<void> {
    const [first] = ask.questions;
    if (this.finished || !this.run.isOpen || this.run.isCancelled || Object.isUndefined(first))
      return;
    const approval = new Approval(Guid.createVersion7().toString(), this.message.id, ApprovalKind.Question, ask.nativeKind, first.text,
      { [Resources.replyToField]: ask.providerRequestId }, Resources.questionOptions, ApprovalStatus.Pending, null, ReplyRun.now(), null, ask.questions);
    await this.approvals.insertAsync(approval);
    this.events.publish(new Event(EventName.ApprovalCreated, approval.toJson()));
  }

  public static replyToOf(approval: Approval): string | null {
    const replyTo = ReplyRun.isJsonObject(approval.payload) ? approval.payload[Resources.replyToField] : null;
    return approval.kind === ApprovalKind.Question && Object.isString(replyTo) ? replyTo : null;
  }

  public async onPermissionRequested(ask: PermissionAsk, signal: AbortSignal): Promise<PermissionAnswer> {
    if (signal.aborted)
      return PermissionAnswer.Denied;
    this.askedIds.add(ask.id);
    const approval = new Approval(Guid.createVersion7().toString(), this.message.id, ApprovalKind.Permission, ask.action, ask.title, ask.payload,
      ReplyRun.permissionOptionsOf(ask), ApprovalStatus.Pending, null, ReplyRun.now(), null);
    try {
      return Resources.permissionAnswers.get((await this.awaitDecisionAsync(approval, signal)).optionId) ?? PermissionAnswer.Denied;
    }
    catch {
      return PermissionAnswer.Denied;
    }
  }

  public async onObservedAsync(observed: ObservedSettings): Promise<void> {
    if (this.finished)
      return;
    this.provenance = this.provenance.withObserved(observed);
    await this.updateAsync(this.message.withProvenance(this.provenance));
  }

  public async onUsageAsync(usage: ReplyUsage): Promise<void> {
    if (this.finished)
      return;
    this.provenance = this.provenance.withUsage(usage);
    await this.updateAsync(this.message.withProvenance(this.provenance));
  }

  public async onPlanUsageAsync(windows: readonly PlanWindow[], readAt: string): Promise<void> {
    this.planUsage?.record(this.provenance.requested.kind, this.provenance.providerId, windows, readAt);
    await this.notePlanAfterFailureAsync();
  }

  public async onTaskStartedAsync(start: TaskStart): Promise<void> {
    this.runningTasks.set(start.taskId, start);
    const starting = this.startTaskAsync(start, Date.now());
    this.taskStarts.set(start.taskId, starting);
    try {
      await starting;
    }
    finally {
      if (this.taskStarts.get(start.taskId) === starting)
        this.taskStarts.delete(start.taskId);
    }
  }

  public onTaskOutput(taskId: string, text: string): void {
    this.tasks?.write(this.message.id, taskId, text);
  }

  public async onTaskEndedAsync(end: TaskEnd): Promise<void> {
    const starting = this.taskStarts.get(end.taskId);
    if (!Object.isUndefined(starting))
      await Promise.allSettled([starting]);
    if (this.runningTasks.get(end.taskId)?.hasOwnStop !== false && !Object.isNull(this.tasks))
      await this.tasks.endAsync(this.message.id, end);
    this.runningTasks.delete(end.taskId);
    this.windows.end(`${Resources.taskWindowPrefix}${end.taskId}`, Date.now());
    await this.releaseIfDoneAsync();
  }

  public async onWakeAsync(wake: TurnWake): Promise<WakeTurn | null> {
    if (Object.isNull(this.wakes))
      return null;
    return await this.wakes(this.message, wake, !this.finished);
  }

  public async onSharedServerFailedAsync(failure: SharedMcpFailure): Promise<void> {
    if (!this.finished && this.sharedFailures.add(this.message.conversationId, failure))
      await this.appendDetailAsync(DetailKind.Note, Resources.formatSharedMcpServerFailed(failure), { source: Resources.sharedMcpServersSource });
  }

  public onSteerable(steer: ((steer: TurnSteer) => Promise<boolean>) | null): void {
    if (this.finished)
      return;
    this.steerTo = steer;
    if (!Object.isNull(steer) && !Object.isNull(this.steerable))
      void this.steerable().catch((error: unknown) =>
        this.log?.write(Resources.formatWaitingMessageNotSent(this.message.conversationId, Resources.formatFailureKind(error))));
  }

  public async steer(steer: TurnSteer): Promise<boolean> {
    const to = this.steerTo;
    if (Object.isNull(to))
      return false;
    try {
      return await to(steer);
    }
    catch (error) {
      this.log?.write(Resources.formatSteerRefused(this.message.id, Resources.formatFailureKind(error)));
      return false;
    }
  }

  private storeImage(detail: TurnDetail): TurnDetail {
    const payload = detail.payload;
    if (!ReplyRun.isJsonObject(payload))
      return detail;
    const data = payload[Resources.imageDataField];
    const mediaType = payload[Resources.mediaTypeField];
    if (!Object.isString(data) || !Object.isString(mediaType))
      return detail;
    const path = this.writeImage(data, mediaType, this.message.details.length);
    if (Object.isNull(path))
      return detail;

    return new TurnDetail(detail.kind, detail.text, { ...payload, [Resources.imageDataField]: null, [Resources.storedPathField]: path }, detail.providerItemId);
  }

  private writeImage(data: string, mediaType: string, sequence: number): string | null {
    const extension = Resources.imageExtensions[mediaType];
    if (Object.isUndefined(extension))
      return null;
    mkdirSync(this.imagesDirectory, { recursive: true });
    const path = join(this.imagesDirectory, Resources.formatImageFileName(this.message.id, sequence, extension));
    writeFileSync(path, Buffer.from(data, Resources.base64Encoding));
    return path;
  }

  private withRecordOf(detail: TurnDetail, sequence: number): TurnDetail {
    const id = detail.providerItemId;
    if (Object.isNull(id) || !ReplyRun.isJsonObject(detail.payload))
      return detail;
    const waiting = this.recordsByItem.has(id) ? undefined : this.unpairedRecords.find(t => ReplyRun.isCallOf(t, detail.payload));
    if (!Object.isUndefined(waiting)) {
      this.unpairedRecords.splice(this.unpairedRecords.indexOf(waiting), 1);
      this.pair(id, waiting, sequence);
    }
    const fields = this.recordsByItem.get(id);
    return Object.isUndefined(fields) ? detail : new TurnDetail(detail.kind, detail.text, { ...detail.payload, ...fields }, id, detail.parentItemId);
  }

  private pair(id: string, record: ToolCallRecord, sequence: number): void {
    const path = Object.isNull(record.image) ? null : this.writeImage(record.image.data, record.image.mediaType, sequence);
    this.recordsByItem.set(id, {
      ...record.fields,
      ...Object.isNull(path) ? {} : { [Resources.storedPathField]: path },
      ...Object.isNull(record.permission) ? {} : { [ProtocolResources.permissionField]: this.permissionOf(record.permission) }
    });
  }

  private permissionOf(permission: NonNullable<ToolCallRecord["permission"]>): JsonObject {
    return {
      [ProtocolResources.riskField]: permission.risk,
      [ProtocolResources.decisionField]: permission.decision,
      [ProtocolResources.isRememberedField]: permission.isRemembered,
      [ProtocolResources.isAskedField]: this.askedIds.has(permission.id)
    };
  }

  private static isCallOf(record: ToolCallRecord, payload: JsonValue): boolean {
    return ReplyRun.isJsonObject(payload) && record.isCallOf(payload[ProtocolResources.servedToolField], payload[ProtocolResources.servedInputField]);
  }

  private async startAsync(): Promise<void> {
    if (!Object.isNull(this.folder))
      await this.messages.setCheckpointFolderAsync(this.message.id, this.folder.id);
    await this.updateAsync(this.message.withStart(ReplyRun.now()));
  }

  private async captureAsync(): Promise<string | null> {
    if (Object.isNull(this.checkpoints) || Object.isNull(this.folder))
      return null;
    this.events.publish(new Event(EventName.ReplyCheckpointStarted, new MessageIdParams(this.message.id).toJson()));
    try {
      const captured = await this.checkpoints.captureAsync(this.folder, this.message.id, this.run.signal);
      if (Object.isNull(captured.checkpoint)) {
        this.log?.write(Resources.formatCheckpointNotTaken(this.message.id, captured.outcome.value));
        return null;
      }
      await this.messages.setCheckpointAsync(this.message.id, captured.checkpoint.id);
      return captured.checkpoint.id;
    }
    catch (error) {
      if (this.run.signal.aborted)
        throw error;
      this.log?.write(Resources.formatCheckpointNotTaken(this.message.id, Resources.formatFailureKind(error)));
      return null;
    }
    finally {
      this.events.publish(new Event(EventName.ReplyCheckpointEnded, new MessageIdParams(this.message.id).toJson()));
    }
  }

  private async reportChangesAsync(checkpoint: string | null): Promise<boolean> {
    if (Object.isNull(checkpoint) || Object.isNull(this.checkpoints) || Object.isNull(this.folder))
      return false;
    const reported = new Set(ReplyRun.reportedFiles(this.message.details).map(t => CommandWrites.pathKey(t)));
    const signal = this.run.afterTurn();
    let evidence: ReplyEvidence;
    try {
      evidence = await this.checkpoints.changesSinceAsync(this.folder, checkpoint, t => reported.has(CommandWrites.pathKey(t)), signal);
    }
    catch (error) {
      if (signal.aborted) {
        await this.appendDetailAsync(DetailKind.Note, Resources.incompleteWorkingTreeEvidence, ReplyRun.partialNote());
        return true;
      }
      return await this.notComparedAsync(Resources.formatFailureKind(error));
    }
    if (!Object.isNull(evidence.refusal))
      return await this.notComparedAsync(evidence.refusal);
    if (!evidence.isComplete)
      await this.appendDetailAsync(DetailKind.Note, Resources.incompleteWorkingTreeEvidence, ReplyRun.partialNote());
    const root = this.folder.path;
    this.windows.close(Date.now());
    const changes = evidence.changes.filter(t => this.windows.covers(t.path, root));
    const outside = evidence.changes.filter(t => !changes.includes(t));
    if (changes.length > 0) {
      const payload = {
        [Resources.filesField]: changes.map(t => t.path),
        status: Resources.completedStatus,
        changes: changes.map(t => ({ path: t.path, kind: t.kind, diff: t.diff })),
        source: Resources.workingTreeSource
      };
      await this.appendDetailAsync(DetailKind.FileChange, Resources.formatWorkingTreeChanges(ReplyRun.namesOf(root, changes)), payload);
    }
    if (outside.length > 0)
      await this.appendDetailAsync(DetailKind.Note, Resources.formatOutsideChanges(outside.map(t => relative(root, t.path))),
        { ...ReplyRun.changesNote(), [Resources.outsideFilesField]: outside.map(t => t.path) });
    return true;
  }

  private async notComparedAsync(reason: string): Promise<false> {
    this.log?.write(Resources.formatChangesNotCompared(this.message.id, reason));
    if (!this.message.details.some(t => t.kind === DetailKind.Command))
      await this.appendDetailAsync(DetailKind.Note, Resources.incompleteWorkingTreeEvidence, ReplyRun.partialNote());
    return false;
  }

  private async reportCommandNotesAsync(compared: boolean): Promise<void> {
    const commands = this.message.details.filter(t => t.kind === DetailKind.Command);
    if (commands.length === 0)
      return;
    if (!compared || Object.isNull(this.folder)) {
      await this.appendDetailAsync(DetailKind.Note, Resources.uncomparedWorkingTree, ReplyRun.partialNote());
      return;
    }
    const root = this.folder.path;
    const rootKey = CommandWrites.folderKey(root);
    const folders = new Map<string, string>();
    for (const path of commands.flatMap(t => CommandWrites.targetsOf(t.payload, root).unnamedIn)) {
      const key = CommandWrites.folderKey(path);
      if (CommandWrites.isOutside(rootKey, key) && !folders.has(key))
        folders.set(key, path);
    }
    if (folders.size === 0)
      return;
    const named = [...folders.values()].join(Resources.listSeparator);
    const text = named.length <= Resources.maximumNamedFoldersLength ? Resources.formatCommandsOutsideFolders(named) : Resources.formatCommandsOutsideFolder(root);
    await this.appendDetailAsync(DetailKind.Note, text, { ...ReplyRun.changesNote(), [Resources.foldersField]: [...folders.values()] });
  }

  private startWrites(): CommandWrites | null {
    return Object.isNull(this.folder) ? null : new CommandWrites(this.folder.path, Date.now());
  }

  private async reportCommandWritesAsync(): Promise<void> {
    const writes = this.writes;
    this.writes = null;
    if (Object.isNull(writes))
      return;
    const reported = new Set(ReplyRun.reportedFiles(this.message.details).map(t => CommandWrites.pathKey(t)));
    const evidence = writes.changesSince(t => reported.has(CommandWrites.pathKey(t)));
    if (!evidence.isComplete)
      await this.appendDetailAsync(DetailKind.Note, Resources.incompleteWorkingTreeEvidence, ReplyRun.partialNote());
    const changes = evidence.changes;
    if (changes.length === 0)
      return;
    const payload = {
      [Resources.filesField]: changes.map(t => t.path),
      status: Resources.completedStatus,
      changes: changes.map(t => ({ path: t.path, kind: t.kind, diff: t.diff })),
      source: Resources.workingTreeSource
    };
    await this.appendDetailAsync(DetailKind.FileChange, Resources.formatCommandWrites(changes.map(t => t.path).join(Resources.listSeparator)), payload);
  }

  private static namesOf(root: string, changes: readonly WorkingTreeChange[]): string {
    return changes.map(t => relative(root, t.path)).join(Resources.listSeparator);
  }

  private static changesNote(): JsonObject {
    return { source: Resources.workingTreeSource, [ProtocolResources.changesNoteField]: true };
  }

  private static partialNote(): JsonObject {
    return { ...ReplyRun.changesNote(), [Resources.partialEvidenceField]: true };
  }

  public static hasPartialEvidence(details: readonly MessageDetail[]): boolean {
    return details.some(t => t.kind === DetailKind.Note && ReplyRun.isJsonObject(t.payload) && t.payload[Resources.partialEvidenceField] === true);
  }

  public static reportedFiles(details: readonly MessageDetail[]): readonly string[] {
    const files: string[] = [];
    for (const detail of details) {
      if (detail.kind !== DetailKind.FileChange || !ReplyRun.isJsonObject(detail.payload))
        continue;
      const listed = detail.payload[Resources.filesField];
      if (Array.isArray(listed))
        for (const file of listed)
          if (Object.isString(file))
            files.push(file);
    }

    return files;
  }

  private static permissionOptionsOf(ask: PermissionAsk): readonly ApprovalOption[] {
    if (ask.remembersInChat)
      return Resources.chatPermissionOptions;
    return [
      ...ask.offersAllowOnce ? [Resources.allowOnceOption] : [],
      ...Object.isNull(ask.allowAlwaysLabel) ? [] : [new ApprovalOption(Resources.allowAlwaysOptionId, ask.allowAlwaysLabel, ApprovalOutcome.Approved, ApprovalScope.Session)],
      Resources.denyOption,
      ...Object.isNull(ask.takeOverLabel) ? [] : [new ApprovalOption(Resources.takeOverOptionId, ask.takeOverLabel, ApprovalOutcome.Denied, ApprovalScope.Session)]
    ];
  }

  private static isJsonObject(value: JsonValue | undefined): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private async completeAsync(result: TurnResult): Promise<void> {
    const nativeSessionId = Object.isNull(result.nativeSessionId) ? this.provenance.nativeSessionId : result.nativeSessionId;
    const nativeTurnId = Object.isNull(result.nativeTurnId) ? this.provenance.nativeTurnId : result.nativeTurnId;
    this.provenance = this.provenance.withObserved(result.observed).withNativeSession(nativeSessionId, this.provenance.resumedNativeSession, nativeTurnId);
    this.message = this.message.withProvenance(this.provenance);
    await this.saveMemberSessionAsync();
    if (result.outcome === TurnOutcome.Failed) {
      this.failedTurn = result;
      await this.failAsync(this.failureText(result), Resources.failedTurnKind, this.failurePayload(result));
      return;
    }
    const interrupted = this.run.isCancelled ? MessageStatus.Cancelled : MessageStatus.Interrupted;
    const status = result.outcome === TurnOutcome.Completed ? MessageStatus.Completed : interrupted;
    if (status === MessageStatus.Completed)
      await this.notePlanFromAnswerAsync();
    if (status === MessageStatus.Cancelled && !Object.isNull(this.stopNote))
      await this.appendDetailAsync(DetailKind.Note, this.stopNote, null);
    await this.updateAsync(this.message.withStatus(status, ReplyRun.now()));
  }

  private usedUp(): PlanUsage | undefined {
    return this.planUsage?.list().find(t => t.kind === this.provenance.requested.kind && t.providerId === this.provenance.providerId && t.usedUp);
  }

  private failureText(result: TurnResult): string {
    const account = this.account;
    if (Object.isNull(result.limit) || Object.isNull(account))
      return Resources.formatTurnFailed(String(result.error));
    const resetsAt = result.limit.resetsAt ?? this.usedUp()?.usedUpUntil ?? null;
    const reset = Object.isNull(resetsAt) ? null : Resources.formatUsageLimitResets(Resources.formatSustainResetTime(resetsAt, new Date()));
    return Resources.formatUsageLimitStopped(account, this.allOut ?? reset);
  }

  private failurePayload(result: TurnResult): JsonObject | null {
    const usage = this.usedUp();
    const stopped = !Object.isNull(result.limit) && !Object.isNull(this.account);
    const payload: JsonObject = {
      ...(Object.isNull(result.action) ? {} : { [ProtocolResources.actionField]: result.action }),
      ...(Object.isUndefined(usage) ? {} : { [ProtocolResources.usedUpField]: true, [ProtocolResources.usedUpUntilField]: usage.usedUpUntil }),
      ...(stopped ? { [Resources.sustainStoppedField]: true } : {})
    };
    return Object.keys(payload).length === 0 ? null : payload;
  }

  private async notePlanAfterFailureAsync(): Promise<void> {
    if (!Object.isUndefined(this.usedUp()))
      await this.restateFailureAsync();
  }

  private async restateFailureAsync(): Promise<void> {
    const error = this.message.details.findLast(t => t.kind === DetailKind.Error);
    if (Object.isNull(this.failedTurn) || Object.isUndefined(error))
      return;
    const [text, payload] = [this.failureText(this.failedTurn), this.failurePayload(this.failedTurn)];
    if (text === error.text && JSON.stringify(payload) === JSON.stringify(error.payload))
      return;
    const updated = new MessageDetail(error.sequence, error.kind, text, payload, error.createdAt, error.parentSequence);
    this.message = this.message.withDetails(this.message.details.map(t => t.sequence === error.sequence ? updated : t));
    await this.messages.updateAsync(this.message);
    this.events.publish(new Event(EventName.DetailUpdated, new DetailEventPayload(this.message.id, updated).toJson()));
  }

  private async notePlanFromAnswerAsync(): Promise<void> {
    if (!this.provenance.requested.planFirst || !Object.isNullOrUndefined(ReplyPlan.ofDetails(this.message.details)?.text))
      return;
    const answer = this.message.details.findLast(t => t.kind === DetailKind.Text && Object.isNull(t.parentSequence));
    const plan = new ReplyPlan([], null, answer?.text ?? null);
    if (!Object.isNull(plan.title))
      await this.appendDetailAsync(DetailKind.Plan, plan.title, plan.toJson());
  }

  private async failAsync(text: string, kind: string, payload: JsonValue = null): Promise<void> {
    this.log?.write(Resources.formatReplyFailed(this.provenance.requested.kind, this.provenance.providerId, kind));
    await this.appendDetailAsync(DetailKind.Error, text, payload);
    await this.updateAsync(this.message.withStatus(MessageStatus.Failed, ReplyRun.now()));
  }

  private async hasLeftAsync(): Promise<boolean> {
    if (Object.isNull(this.conversations) || Object.isNull(this.message.teammateId))
      return false;
    return Object.isNull(await this.conversations.findMemberAsync(new ConversationMemberParams(this.message.conversationId, this.message.teammateId)));
  }

  private async startTaskAsync(start: TaskStart, at: number): Promise<void> {
    if (await this.hasLeftAsync()) {
      if (this.runningTasks.get(start.taskId) === start)
        this.runningTasks.delete(start.taskId);
      void start.stop().catch(() => undefined);
      await this.releaseIfDoneAsync();
      return;
    }
    this.windows.start(`${Resources.taskWindowPrefix}${start.taskId}`, at);
    if (start.hasOwnStop && !Object.isNull(this.tasks))
      await this.tasks.startAsync(this.message.conversationId, this.message.id, this.provenance.requested.kind, start, this.message.teammateId);
  }

  private async saveMemberSessionAsync(): Promise<void> {
    if (Object.isNull(this.conversations) || Object.isNull(this.message.teammateId))
      return;
    const params = new ConversationMemberParams(this.message.conversationId, this.message.teammateId);
    const current = await this.conversations.findMemberAsync(params);
    const account = Object.isNull(this.provenance.nativeSessionId) ? null : this.provenance.providerId;
    if (current?.nativeSessionId === this.provenance.nativeSessionId && current.resumedNativeSession === this.provenance.resumedNativeSession
      && current.sessionProviderId === account)
      return;
    await this.conversations.setMemberSessionAsync(params, this.provenance.nativeSessionId, this.provenance.resumedNativeSession, account);
  }

  private async awaitDecisionAsync(approval: Approval, signal: AbortSignal | undefined): Promise<ApprovalDecideParams> {
    if (!this.run.isOpen || this.run.isCancelled)
      return this.run.awaitDecision(approval.id);
    const decision = this.run.awaitDecision(approval.id);
    void decision.catch(() => undefined);
    try {
      await this.approvals.insertAsync(approval);
    }
    catch (error) {
      this.run.withdraw(approval.id);
      throw error;
    }
    if (!this.run.hasDecision(approval.id) || signal?.aborted === true) {
      this.run.withdraw(approval.id);
      await this.approvals.updateAsync(approval.withCancellation(ReplyRun.now()));
      return await decision;
    }
    if (!this.finished)
      await this.updateAsync(this.message.withStatus(MessageStatus.AwaitingApproval, null));
    this.events.publish(new Event(EventName.ApprovalCreated, approval.toJson()));
    const withdrawals: Promise<void>[] = [];
    const withdraw = (): void => {
      withdrawals.push(this.withdrawAsync(approval));
    };
    if (signal?.aborted ?? false)
      withdraw();
    else
      signal?.addEventListener(Resources.abortEvent, withdraw, { once: true });
    let decided: ApprovalDecideParams;
    try {
      decided = await decision;
    }
    finally {
      signal?.removeEventListener(Resources.abortEvent, withdraw);
      await Promise.all(withdrawals);
    }
    if (!this.finished && !this.run.isAwaitingDecision)
      await this.updateAsync(this.message.withStatus(MessageStatus.Running, null));
    return decided;
  }

  private async withdrawAsync(approval: Approval): Promise<void> {
    if (!this.run.withdraw(approval.id))
      return;
    const cancelled = approval.withCancellation(ReplyRun.now());
    await this.approvals.updateAsync(cancelled);
    this.events.publish(new Event(EventName.ApprovalUpdated, cancelled.toJson()));
    if (!this.finished && !this.run.isAwaitingDecision)
      await this.updateAsync(this.message.withStatus(MessageStatus.Running, null));
  }

  private async endAsync(): Promise<void> {
    await this.toolCalls;
    this.finished = true;
    this.steerTo = null;
    if (this.runningSubAgents.size > 0 || this.runningTasks.size > 0)
      this.run.keepOpen(() => this.stopSubAgentsAsync());
    this.run.close();
    if (!this.run.isOpen)
      await this.cancelPendingApprovalsAsync();
  }

  private async stopSubAgentsAsync(): Promise<void> {
    await this.cancelPendingApprovalsAsync();
    const tasks = [...this.runningTasks.values()].filter(t => !Object.isNull(t.subAgentId));
    for (const [id, row] of [...this.detailsByItem].filter(t => this.runningSubAgents.has(t[0]) && !tasks.some(u => u.subAgentId === t[0])))
      await this.onDetailAsync(new TurnDetail(DetailKind.SubAgent, row.text, SubAgent.fromJson(row.payload).with({ status: SubAgentStatus.Stopped }).toJson(), id));
    const refusals: unknown[] = [];
    await Promise.all(tasks.filter(t => !this.stoppedTasks.has(t.taskId)).map(async t => {
      this.stoppedTasks.add(t.taskId);
      try {
        await t.stop();
      }
      catch (error) {
        this.stoppedTasks.delete(t.taskId);
        refusals.push(error);
      }
    }));
    if (refusals.length > 0)
      throw new ServiceException(ErrorCode.ProviderError, Resources.formatBackgroundTaskStopFailed(ReplyRun.describe(refusals[0])), [this.message.id]);
  }

  private async releaseIfDoneAsync(): Promise<void> {
    if (!this.finished || !this.run.isOpen || this.runningSubAgents.size > 0 || this.runningTasks.size > 0)
      return;
    this.run.release();
    await this.cancelPendingApprovalsAsync();
  }

  private async cancelPendingApprovalsAsync(): Promise<void> {
    const now = ReplyRun.now();
    for (const approval of (await this.approvals.listPendingAsync(this.message.id)).filter(t => this.run.isCancelled || Object.isNull(ReplyRun.replyToOf(t)))) {
      const cancelled = approval.withCancellation(now);
      await this.approvals.updateAsync(cancelled);
      this.events.publish(new Event(EventName.ApprovalUpdated, cancelled.toJson()));
    }
  }

  private async followDetailAsync(reported: TurnDetail): Promise<void> {
    if (await this.followsSubAgentAsync(reported))
      await this.noteDetailAsync(reported);
  }

  private async followsSubAgentAsync(detail: TurnDetail): Promise<boolean> {
    const ids = detail.kind === DetailKind.SubAgent ? [detail.providerItemId, detail.parentItemId] : [detail.parentItemId];
    if (!ids.some(t => !Object.isNull(t) && this.runningSubAgents.has(t)))
      return false;
    let read: Message;
    let stored: Message | null;
    do {
      read = this.message;
      stored = await this.messages.findAsync(read.id);
    } while (!Object.isNull(stored) && this.message !== read);
    if (Object.isNull(stored)) {
      this.runningSubAgents.clear();
      await this.releaseIfDoneAsync();
      return false;
    }
    this.message = stored;
    return true;
  }

  private async noteDetailAsync(reported: TurnDetail): Promise<void> {
    this.windows.note(reported, Date.now());
    const id = reported.providerItemId;
    const known = Object.isNull(id) ? undefined : this.detailsByItem.get(id);
    const detail = this.withRecordOf(this.storeImage(reported), known?.sequence ?? this.message.details.length);
    if (detail.kind !== DetailKind.Reasoning)
      this.thinkingReported = false;
    if (!Object.isUndefined(known))
      await this.replaceDetailAsync(known, detail);
    else {
      const parent = Object.isNull(detail.parentItemId) ? undefined : this.detailsByItem.get(detail.parentItemId);
      await this.appendDetailAsync(detail.kind, detail.text, detail.payload, parent?.sequence ?? null, id);
    }
    if (detail.kind === DetailKind.Command)
      this.writes?.note(detail.payload);
    await this.noteSubAgentAsync(detail);
    await this.notePlanApprovedAsync(detail);
  }

  private async onToolCalledAsync(record: ToolCallRecord): Promise<void> {
    const step = [...this.detailsByItem].find(([id, t]) => !this.recordsByItem.has(id) && ReplyRun.isCallOf(record, t.payload));
    if (Object.isUndefined(step)) {
      this.unpairedRecords.push(record);
      return;
    }
    const [id, detail] = step;
    this.pair(id, record, detail.sequence);
    await this.replaceDetailAsync(detail, this.withRecordOf(new TurnDetail(detail.kind, detail.text, detail.payload, id), detail.sequence));
  }

  private async notePlanApprovedAsync(detail: TurnDetail): Promise<void> {
    const conversations = this.conversations;
    if (detail.kind !== DetailKind.Plan || !this.provenance.requested.planFirst || Object.isNull(conversations)
      || (await conversations.findAsync(this.message.conversationId))?.plansFirst(this.message.teammateId) !== true)
      return;
    let approved: boolean;
    try {
      approved = ReplyPlan.fromJson(detail.payload).approved;
    }
    catch {
      return;
    }
    if (!approved)
      return;
    await conversations.approvePlanAsync(this.message.conversationId, this.message.teammateId);
    this.events.publish(new Event(EventName.StateInvalidated, null));
  }

  private async noteSubAgentAsync(detail: TurnDetail): Promise<void> {
    if (detail.kind !== DetailKind.SubAgent || Object.isNull(detail.providerItemId))
      return;
    if (ReplyRun.isRunning(detail.payload))
      this.runningSubAgents.add(detail.providerItemId);
    else {
      this.runningSubAgents.delete(detail.providerItemId);
      await this.releaseIfDoneAsync();
    }
  }

  private async appendDetailAsync(kind: DetailKind, text: string, payload: JsonValue, parentSequence: number | null = null,
    itemId: string | null = null): Promise<MessageDetail> {
    const detail = new MessageDetail(this.message.details.length, kind, text, payload, ReplyRun.now(), parentSequence);
    this.message = this.message.withDetail(detail);
    if (!Object.isNull(itemId))
      this.detailsByItem.set(itemId, detail);
    await this.messages.updateAsync(this.message);
    this.events.publish(new Event(EventName.DetailAppended, new DetailEventPayload(this.message.id, detail).toJson()));

    return detail;
  }

  private async noteMovedAsync(moved: string, payload: JsonValue, posted: boolean): Promise<void> {
    const early = posted ? this.message.details.at(-1) : undefined;
    if (Object.isUndefined(early))
      await this.appendDetailAsync(DetailKind.Note, moved, payload);
    else
      await this.replaceDetailAsync(early, new TurnDetail(DetailKind.Note, moved, payload, null));
  }

  private async replaceDetailAsync(previous: MessageDetail, detail: TurnDetail): Promise<void> {
    const replaced = new MessageDetail(previous.sequence, detail.kind, detail.text, detail.payload, previous.createdAt, previous.parentSequence);
    const details = this.message.details.map(t => t.sequence === previous.sequence ? replaced : t);
    this.message = this.message.withDetails(details);
    if (!Object.isNull(detail.providerItemId))
      this.detailsByItem.set(detail.providerItemId, replaced);
    await this.messages.updateAsync(this.message);
    this.events.publish(new Event(EventName.DetailUpdated, new DetailEventPayload(this.message.id, replaced).toJson()));
  }

  private async updateAsync(message: Message): Promise<void> {
    this.message = message;
    await this.messages.updateAsync(message);
    this.events.publish(new Event(EventName.MessageUpdated, message.toJson()));
  }

  private static isRunning(payload: JsonValue): boolean {
    try {
      return SubAgent.fromJson(payload).isRunning;
    }
    catch {
      return false;
    }
  }

  private static describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private static now(): string {
    return new Date().toISOString();
  }
}
