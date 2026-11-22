/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { SqlTransaction } from "@noldova/context.data.sql";
import { ServiceException } from "@noldova/teamrun.services";
import { Approval, type ApprovalDecideParams, ApprovalKind, type ApprovalQuestion, ApprovalStatus, ErrorCode, Event, EventName, type Message, MessageSendParams,
  PermissionDetail, PermissionDetailKind, PermissionPayload, PermissionRisk, type QuestionAnswer } from "@noldova/teamrun.protocol";

import { PermissionAnswer } from "../../enums/permission-answer.js";
import type { IApprovalsService } from "../../interfaces/i-approvals.service.js";
import type { IEngineCallbacks } from "../../interfaces/i-engine-callbacks.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { ILog } from "../../interfaces/i-log.js";
import type { IMessagesService } from "../../interfaces/i-messages.service.js";
import type { ActiveRun } from "../../models/active-run.js";
import { DecidedApproval } from "../../models/decided-approval.js";
import { PermissionAsk } from "../../models/permission-ask.js";
import { QueuedAnswer } from "../../models/queued-answer.js";
import { QuestionReply } from "../../models/question-reply.js";
import { ReplyMode } from "../../models/reply-mode.js";
import type { ReplyWork } from "../../models/reply-work.js";
import type { SendAsk } from "../../models/send-ask.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";
import type { ProviderKindRegistry } from "../provider-kinds/provider-kind-registry.js";
import type { EngineServices } from "./engine-services.js";
import { ReplyRun } from "./reply-run.js";
import type { TurnState } from "./turn-state.js";

export class PermissionAsks {
  private readonly context: DatabaseContext;
  private readonly messages: IMessagesService;
  private readonly approvals: IApprovalsService;
  private readonly registry: ProviderKindRegistry;
  private readonly events: IEventSink;
  private readonly log: ILog | null;
  private readonly state: TurnState;
  private readonly answers: Map<string, QueuedAnswer[]> = new Map();
  private readonly toolModeOfAsync: IEngineCallbacks["toolModeOfAsync"];
  private readonly modeIn: IEngineCallbacks["modeIn"];
  private readonly startedRequestedAsync: IEngineCallbacks["startedRequestedAsync"];
  private readonly requireMessageAsync: IEngineCallbacks["requireMessageAsync"];
  private readonly sendMessageAsync: IEngineCallbacks["sendMessageAsync"];
  private readonly sendWaitingAsync: IEngineCallbacks["sendWaitingAsync"];
  private readonly findGroup: IEngineCallbacks["findGroup"];
  private readonly beginSending: IEngineCallbacks["beginSending"];
  private readonly endSending: IEngineCallbacks["endSending"];
  private readonly track: IEngineCallbacks["track"];

  public constructor(services: EngineServices, state: TurnState, callbacks: IEngineCallbacks) {
    this.context = services.context;
    this.messages = services.messages;
    this.approvals = services.approvals;
    this.registry = services.registry;
    this.events = services.events;
    this.log = services.log;
    this.state = state;
    this.toolModeOfAsync = callbacks.toolModeOfAsync;
    this.modeIn = callbacks.modeIn;
    this.startedRequestedAsync = callbacks.startedRequestedAsync;
    this.requireMessageAsync = callbacks.requireMessageAsync;
    this.sendMessageAsync = callbacks.sendMessageAsync;
    this.sendWaitingAsync = callbacks.sendWaitingAsync;
    this.findGroup = callbacks.findGroup;
    this.beginSending = callbacks.beginSending;
    this.endSending = callbacks.endSending;
    this.track = callbacks.track;
  }

  public hasAnswers(chatId: string): boolean {
    return this.answers.has(chatId);
  }

  public async decideAsync(params: ApprovalDecideParams): Promise<Approval> {
    const { approval: decided, queued } = await this.context.database.connection.runInTransactionAsync(async (transaction): Promise<DecidedApproval> => {
      const approval = await this.approvals.findAsync(params.approvalId, transaction);
      if (Object.isNull(approval))
        throw new ServiceException(ErrorCode.NotFound, Resources.formatApprovalNotFound(params.approvalId), [params.approvalId]);
      if (approval.status !== ApprovalStatus.Pending)
        throw new ServiceException(ErrorCode.Conflict, Resources.formatApprovalNotPending(approval.id), [approval.id]);
      if (!approval.options.some(t => t.id === params.optionId))
        throw new ServiceException(ErrorCode.InvalidParams, Resources.formatUnknownDecisionOption(approval.id, params.optionId), [approval.id, params.optionId]);
      PermissionAsks.checkAnswers(approval, params);
      const replyTo = ReplyRun.replyToOf(approval);
      if (!Object.isNull(replyTo))
        return await this.decidePostedAsync(approval, params, replyTo, transaction);

      this.requireDecision(approval);
      const decision = approval.withDecision(params.optionId, new Date().toISOString(), PermissionAsks.keptAnswers(approval, params));
      await this.approvals.updateAsync(decision, transaction);
      return new DecidedApproval(decision, null);
    });
    this.events.publish(new Event(EventName.ApprovalUpdated, decided.toJson()));
    const run = this.state.runs.get(decided.messageId);
    if (Object.isNull(ReplyRun.replyToOf(decided)) && !Object.isUndefined(run) && run.hasDecision(decided.id))
      run.decide(params);
    if (!Object.isNull(queued)) {
      this.queueAnswer(queued);
      await this.sendAnswersAsync(queued.params.conversationId);
    }
    return decided;
  }

  public async askPermissionAsync(session: string, module: string, ask: PermissionAsk, signal: AbortSignal): Promise<PermissionAnswer> {
    const turn = this.state.sessions.find(t => t.session.id === session);
    if (Object.isUndefined(turn)) {
      this.log?.write(Resources.formatPermissionWithoutTurn(module, ask.action));
      return PermissionAnswer.Denied;
    }
    if ((await this.toolModeOfAsync(turn))?.unrestricted === true && !ask.remembersInChat && PermissionPayload.fromJson(ask.payload).risk !== PermissionRisk.High)
      return PermissionAnswer.AllowedOnce;
    return await turn.run.onPermissionRequested(ask, signal);
  }

  public async askSendAsync(origin: ReplyWork, ask: SendAsk, text: string, signal: AbortSignal | undefined): Promise<string> {
    const ended = Object.isUndefined(signal) ? origin.run.signal : AbortSignal.any([signal, origin.run.signal]);
    const run = this.state.replyRuns.get(origin) ?? await this.startedRunOf(origin, ended);
    if (Object.isUndefined(run))
      throw new ServiceException(ErrorCode.Unauthorized, Resources.sendNotAllowed, [ask.chatId]);
    const open = this.state.sessions.find(t => t.run === run) ?? new ReplyMode(origin.message, this.modeIn(await this.startedRequestedAsync(origin.message)));
    if ((await this.toolModeOfAsync(open))?.unrestricted === true)
      return ask.starts;
    const payload = new PermissionPayload(Resources.sendMessageModule, ask.chatId, PermissionRisk.Medium, [
      new PermissionDetail(Resources.sendChatLabel, PermissionDetailKind.Text, ask.chatTitle),
      new PermissionDetail(Resources.sendStartsLabel, PermissionDetailKind.Text, ask.starts),
      new PermissionDetail(Resources.sendMessageLabel, PermissionDetailKind.AgentText, text)
    ]);
    if (await run.onPermissionRequested(new PermissionAsk(Resources.sendMessageAction, ask.title, payload.toJson(), false), ended) !== PermissionAnswer.AllowedOnce)
      throw new ServiceException(ErrorCode.Unauthorized, Resources.sendNotAllowed, [ask.chatId]);
    return ask.starts;
  }

  public answerOf(approval: Approval, reply: Message): QueuedAnswer | null {
    const answers = approval.answers;
    const provenance = reply.provenance;
    const replyTo = ReplyRun.replyToOf(approval);
    if (Object.isNull(answers) || answers.length === 0 || Object.isNull(provenance) || Object.isNull(replyTo))
      return null;
    const replies = approval.questions.flatMap(question => answers.filter(t => t.questionId === question.id)
      .map(t => new QuestionReply(question.text, [...t.choices, ...Object.isNull(t.text) ? [] : [t.text]].join(Resources.listSeparator))));
    const adapter = this.registry.all().find(t => t.descriptor.id === provenance.requested.kind);
    const format = adapter?.formatQuestionReply?.bind(adapter);
    const prompt = Object.isUndefined(format) ? null : replies.map(t => format(replyTo, t.question, t.answer)).join(Resources.lineSeparator);
    const text = replies.map(t => Resources.formatQuestionReply(t.question, t.answer)).join(Resources.transcriptSeparator);
    const params = Object.isNull(reply.teammateId)
      ? new MessageSendParams(reply.conversationId, text, provenance.requested, provenance.providerId)
      : new MessageSendParams(reply.conversationId, text, null, null, [], [], reply.teammateId);
    return new QueuedAnswer(approval, replyTo, params, prompt);
  }

  public queueAnswer(queued: QueuedAnswer): void {
    const conversationId = queued.params.conversationId;
    const waiting = this.answers.get(conversationId) ?? [];
    waiting.push(queued);
    this.answers.set(conversationId, waiting);
  }

  public async sendAnswersAsync(conversationId: string): Promise<void> {
    const waiting = this.answers.get(conversationId);
    if (this.state.closing || Object.isUndefined(waiting) || !this.beginSending(conversationId))
      return;
    let open: Message | null;
    try {
      open = await this.messages.findOpenReplyAsync(conversationId);
    }
    catch (error) {
      this.endSending(conversationId);
      throw error;
    }
    const [next] = waiting;
    if (!Object.isNull(open) || this.state.closing || Object.isUndefined(next) || !Object.isNull(this.findGroup(conversationId))) {
      this.endSending(conversationId);
      return;
    }
    waiting.shift();
    if (waiting.length === 0)
      this.answers.delete(conversationId);
    this.track(conversationId, this.sendMessageAsync(next.params, next.prompt, null, undefined).finally(() => this.endSending(conversationId)).then(async () => {
      const sent = PermissionAsks.withAnswerUnsent(next.approval, next.replyTo, false);
      await this.approvals.updateAsync(sent);
      this.events.publish(new Event(EventName.ApprovalUpdated, sent.toJson()));
      await this.sendAnswersAsync(conversationId);
      await this.sendWaitingAsync(conversationId);
    }, async (error: unknown) => {
      this.log?.write(Resources.formatQuestionReplyNotSent(conversationId, Resources.formatFailureKind(error)));
      await this.sendAnswersAsync(conversationId);
      await this.sendWaitingAsync(conversationId);
    }));
  }

  private async startedRunOf(origin: ReplyWork, signal: AbortSignal): Promise<ReplyRun | undefined> {
    if (signal.aborted)
      return undefined;
    const started = Promise.withResolvers<void>();
    const resume = (): void => started.resolve();
    const waits = this.state.runWaits.get(origin) ?? new Set<() => void>();
    this.state.runWaits.set(origin, waits.add(resume));
    signal.addEventListener(Resources.abortEvent, resume, { once: true });
    await started.promise;
    signal.removeEventListener(Resources.abortEvent, resume);
    waits.delete(resume);
    if (waits.size === 0)
      this.state.runWaits.delete(origin);
    return signal.aborted ? undefined : this.state.replyRuns.get(origin);
  }

  private requireDecision(approval: Approval): ActiveRun {
    const run = this.state.runs.get(approval.messageId);
    if (Object.isUndefined(run) || !run.hasDecision(approval.id))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatMessageNotOpen(approval.messageId), [approval.messageId]);
    return run;
  }

  private async decidePostedAsync(approval: Approval, params: ApprovalDecideParams, replyTo: string,
    transaction: SqlTransaction): Promise<DecidedApproval> {
    const reply = await this.requireMessageAsync(approval.messageId, transaction);
    const answered = approval.withDecision(params.optionId, new Date().toISOString(), PermissionAsks.keptAnswers(approval, params));
    const queued = this.answerOf(PermissionAsks.withAnswerUnsent(answered, replyTo, true), reply);
    const decided = Object.isNull(queued) ? answered : queued.approval;
    await this.approvals.updateAsync(decided, transaction);
    return new DecidedApproval(decided, queued);
  }

  private static withAnswerUnsent(approval: Approval, replyTo: string, isUnsent: boolean): Approval {
    return new Approval(approval.id, approval.messageId, approval.kind, approval.nativeKind, approval.summary,
      { [Resources.replyToField]: replyTo, ...isUnsent ? { [Resources.answerUnsentField]: true } : {} }, approval.options, approval.status, approval.decision,
      approval.createdAt, approval.decidedAt, approval.questions, approval.answers);
  }

  private static keptAnswers(approval: Approval, params: ApprovalDecideParams): QuestionAnswer[] | null {
    return params.answers?.filter(t => approval.questions.some(u => u.id === t.questionId && !u.secret)) ?? null;
  }

  private static checkAnswers(approval: Approval, params: ApprovalDecideParams): void {
    const answering = approval.kind === ApprovalKind.Question && params.optionId === Resources.answerOptionId;
    if (Object.isNull(params.answers) ? answering : !answering || !PermissionAsks.fitsQuestions(approval.questions, params.answers))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatAnswersMismatch(approval.id), [approval.id]);
  }

  private static fitsQuestions(questions: readonly ApprovalQuestion[], answers: readonly QuestionAnswer[]): boolean {
    return answers.length > 0 && new Set(answers.map(t => t.questionId)).size === answers.length && answers.every(t => {
      const question = questions.find(u => u.id === t.questionId);
      return !Object.isUndefined(question) && t.choices.every(u => question.options.some(v => v.label === u))
        && (question.multiple || t.choices.length <= 1) && (question.other || Object.isNull(t.text));
    });
  }
}
