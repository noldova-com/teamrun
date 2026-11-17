/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { ServiceException } from "@noldova/teamrun.services";
import { type ApprovalDecideParams, ErrorCode } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";

export class ActiveRun {
  private readonly controller: AbortController = new AbortController();
  private afterTurnController: AbortController | null = null;
  private stopAfterTurn: (() => Promise<void>) | null = null;
  private readonly decisions: Map<string, PromiseWithResolvers<ApprovalDecideParams>> = new Map();
  private readonly ending: PromiseWithResolvers<void> = Promise.withResolvers();
  private cancelled: boolean = false;
  private closed: boolean = false;
  private kept: boolean = false;

  public readonly messageId: string;

  public constructor(messageId: string) {
    ArgumentException.throwIfNullOrWhitespace(messageId, Resources.messageIdParameterName);

    this.messageId = messageId;
  }

  public get signal(): AbortSignal {
    return this.controller.signal;
  }

  public get isCancelled(): boolean {
    return this.cancelled;
  }

  public get isAwaitingDecision(): boolean {
    return this.decisions.size > 0;
  }

  public get isOpen(): boolean {
    return !this.closed;
  }

  public get released(): Promise<void> {
    return this.ending.promise;
  }

  public hasDecision(approvalId: string): boolean {
    return this.decisions.has(approvalId);
  }

  public awaitDecision(approvalId: string): Promise<ApprovalDecideParams> {
    ArgumentException.throwIfNullOrWhitespace(approvalId, Resources.approvalIdParameterName);
    if (this.closed || this.cancelled || this.decisions.has(approvalId))
      return Promise.reject(new ServiceException(ErrorCode.Conflict, Resources.formatMessageNotOpen(this.messageId), [this.messageId]));
    const decision = Promise.withResolvers<ApprovalDecideParams>();
    this.decisions.set(approvalId, decision);
    return decision.promise;
  }

  public decide(params: ApprovalDecideParams): boolean {
    const decision = this.decisions.get(params.approvalId);
    if (Object.isUndefined(decision))
      return false;

    this.decisions.delete(params.approvalId);
    decision.resolve(params);
    return true;
  }

  public withdraw(approvalId: string): boolean {
    const decision = this.decisions.get(approvalId);
    if (Object.isUndefined(decision))
      return false;

    this.decisions.delete(approvalId);
    decision.reject(new ServiceException(ErrorCode.Conflict, Resources.formatApprovalWithdrawn(approvalId), [approvalId]));
    return true;
  }

  public afterTurn(): AbortSignal {
    this.afterTurnController = new AbortController();
    return this.afterTurnController.signal;
  }

  public keepOpen(stopAfterTurn: () => Promise<void>): void {
    this.kept = !this.cancelled;
    this.stopAfterTurn = stopAfterTurn;
  }

  public cancel(): void {
    this.cancelled = true;
    this.kept = false;
    this.afterTurnController?.abort();
    this.close();
  }

  public async cancelAfterTurn(): Promise<void> {
    this.cancelled = true;
    this.rejectDecisions();
    await this.stopAfterTurn?.();
  }

  public close(): void {
    this.controller.abort();
    if (!this.kept)
      this.release();
  }

  public release(): void {
    this.kept = false;
    this.closed = true;
    this.rejectDecisions();
    this.ending.resolve();
  }

  private rejectDecisions(): void {
    for (const decision of this.decisions.values())
      decision.reject(new ServiceException(ErrorCode.Conflict, Resources.formatMessageNotOpen(this.messageId), [this.messageId]));
    this.decisions.clear();
  }
}
