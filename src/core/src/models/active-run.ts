/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { ErrorCode } from "@noldova/teamrun-protocol";

import { Resources } from "../resources.js";

export class ActiveRun {
  private readonly controller: AbortController = new AbortController();
  private readonly decisions: Map<string, PromiseWithResolvers<string>> = new Map();
  private cancelled: boolean = false;
  private closed: boolean = false;

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

  public hasDecision(approvalId: string): boolean {
    return this.decisions.has(approvalId);
  }

  public awaitDecision(approvalId: string): Promise<string> {
    ArgumentException.throwIfNullOrWhitespace(approvalId, Resources.approvalIdParameterName);
    if (this.closed || this.decisions.has(approvalId))
      return Promise.reject(new ServiceException(ErrorCode.Conflict, Resources.formatMessageNotOpen(this.messageId), [this.messageId]));
    const decision = Promise.withResolvers<string>();
    this.decisions.set(approvalId, decision);
    return decision.promise;
  }

  public decide(approvalId: string, optionId: string): boolean {
    const decision = this.decisions.get(approvalId);
    if (Object.isUndefined(decision))
      return false;

    this.decisions.delete(approvalId);
    decision.resolve(optionId);
    return true;
  }

  public cancel(): void {
    this.cancelled = true;
    this.close();
  }

  public close(): void {
    this.closed = true;
    for (const decision of this.decisions.values())
      decision.reject(new ServiceException(ErrorCode.Conflict, Resources.formatMessageNotOpen(this.messageId), [this.messageId]));
    this.decisions.clear();
    this.controller.abort();
  }
}
