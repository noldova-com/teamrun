/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ServiceResponseInfo } from "@noldova/teamrun-foundation-services";
import {
  Approval,
  ApprovalDecideParams,
  ApprovalOutcome,
  DetailEventPayload,
  DetailKind,
  ErrorCode,
  type Event,
  EventName,
  Message,
  type MessageDetail,
  MessageStatus,
  MethodName
} from "@noldova/teamrun-protocol";

import { DecisionPolicy } from "../enums/decision-policy.js";
import { CommandFailedException } from "../exceptions/command-failed.exception.js";
import type { IConsole } from "../interfaces/i-console.js";
import type { IEventHandler } from "../interfaces/i-event-handler.js";
import { ReplyOutcome } from "../models/reply-outcome.js";
import { Resources } from "../resources.js";
import type { RuntimeSession } from "./runtime-session.js";

export class ReplyFollower implements IEventHandler {
  private static readonly OPEN_STATUSES: readonly MessageStatus[] = [MessageStatus.Pending, MessageStatus.Running, MessageStatus.AwaitingApproval];

  private readonly session: RuntimeSession;
  private readonly console: IConsole;
  private readonly policy: DecisionPolicy;
  private readonly echo: boolean;
  private readonly completion: PromiseWithResolvers<ReplyOutcome> = Promise.withResolvers<ReplyOutcome>();
  private readonly buffered: Event[] = [];
  private readonly decisions: string[] = [];
  private readonly pendingText: Map<number, MessageDetail> = new Map();
  private replyId: string | null = null;
  private detailCount: number = 0;
  private pendingDecision: Promise<void> = Promise.resolve();
  private readonly inputAbort: AbortController = new AbortController();
  private finished: boolean = false;

  public constructor(session: RuntimeSession, console: IConsole, policy: DecisionPolicy, echo: boolean) {
    this.session = session;
    this.console = console;
    this.policy = policy;
    this.echo = echo;
  }

  public follow(replyId: string): Promise<ReplyOutcome> {
    this.replyId = replyId;
    for (const event of this.buffered)
      this.handleEvent(event);
    this.buffered.length = 0;

    return this.completion.promise;
  }

  public handleEvent(event: Event): void {
    if (this.finished)
      return;
    if (Object.isNull(this.replyId)) {
      this.buffered.push(event);
      return;
    }
    if (event.name === EventName.DetailAppended)
      this.handleDetail(DetailEventPayload.fromJson(event.payload));
    else if (event.name === EventName.DetailUpdated)
      this.handleDetailUpdate(DetailEventPayload.fromJson(event.payload));
    else if (event.name === EventName.MessageUpdated)
      this.handleUpdate(Message.fromJson(event.payload));
    else if (event.name === EventName.ApprovalCreated)
      this.handleApproval(Approval.fromJson(event.payload));
  }

  private handleDetail(payload: DetailEventPayload): void {
    if (payload.messageId !== this.replyId)
      return;

    this.detailCount += 1;
    if (!this.echo)
      return;
    if (payload.detail.kind === DetailKind.Text) {
      this.pendingText.set(payload.detail.sequence, payload.detail);
      return;
    }
    this.printPendingText();
    this.console.write(Resources.formatDetail(payload.detail.kind, payload.detail.text));
  }

  private handleDetailUpdate(payload: DetailEventPayload): void {
    if (payload.messageId === this.replyId && this.pendingText.has(payload.detail.sequence))
      this.pendingText.set(payload.detail.sequence, payload.detail);
  }

  private printPendingText(): void {
    for (const detail of [...this.pendingText.values()].sort((a, b) => a.sequence - b.sequence))
      this.console.write(Resources.formatDetail(detail.kind, detail.text));
    this.pendingText.clear();
  }

  private handleUpdate(message: Message): void {
    if (message.id !== this.replyId || ReplyFollower.OPEN_STATUSES.includes(message.status))
      return;
    this.finished = true;
    this.inputAbort.abort();

    if (this.echo) {
      this.printPendingText();
      this.console.write(Resources.formatStatus(message.status));
    }
    void this.pendingDecision.then(() => this.completion.resolve(new ReplyOutcome(message, this.detailCount, this.decisions)));
  }

  private handleApproval(approval: Approval): void {
    if (approval.messageId !== this.replyId)
      return;

    this.pendingDecision = this.pendingDecision.then(() => this.decide(approval)).catch(error => {
      if (!this.finished) {
        this.finished = true;
        this.inputAbort.abort();
        this.completion.reject(error);
      }
    });
  }

  private async decide(approval: Approval): Promise<void> {
    if (this.finished)
      return;
    const optionId = await this.choose(approval);
    if (this.finished)
      return;
    this.decisions.push(optionId);
    await this.session.call(MethodName.ApprovalDecide, new ApprovalDecideParams(approval.id, optionId).toJson());
    if (this.echo)
      this.console.write(Resources.formatDecided(optionId));
  }

  private async choose(approval: Approval): Promise<string> {
    if (this.policy !== DecisionPolicy.Ask)
      return ReplyFollower.chooseByOutcome(approval, this.policy === DecisionPolicy.Approve ? ApprovalOutcome.Approved : ApprovalOutcome.Denied);

    this.console.write(Resources.approvalHeading);
    this.console.write(approval.summary);
    for (const option of approval.options)
      this.console.write(Resources.formatApprovalOption(option.id, option.label));
    const answer = await this.console.ask(Resources.approvalPrompt, this.inputAbort.signal);
    const chosen = approval.options.find(t => t.id === answer);

    return Object.isUndefined(chosen) ? ReplyFollower.chooseByOutcome(approval, ApprovalOutcome.Denied) : chosen.id;
  }

  private static chooseByOutcome(approval: Approval, outcome: ApprovalOutcome): string {
    const option = approval.options.find(t => t.outcome === outcome);
    if (Object.isUndefined(option))
      throw new CommandFailedException(new ServiceResponseInfo(ErrorCode.Unavailable, Resources.formatUnsupportedApprovalOutcome(outcome), [outcome]));

    return option.id;
  }
}
