/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ApprovalOutcome, DetailKind, type QuestionAnswer } from "@noldova/teamrun.protocol";

import { DenyingTurn } from "../../enums/denying-turn.js";
import { TurnOutcome } from "../../enums/turn-outcome.js";
import { ApprovalNotDeniableException } from "../../exceptions/approval-not-deniable.exception.js";
import { OwnSummaryUnansweredException } from "../../exceptions/own-summary-unanswered.exception.js";
import type { IProviderAdapter } from "../../interfaces/i-provider-adapter.js";
import type { ITurnListener } from "../../interfaces/i-turn-listener.js";
import type { ApprovalAsk } from "../../models/approval-ask.js";
import type { TurnDetail } from "../../models/turn-detail.js";
import type { TurnRequest } from "../../models/turn-request.js";
import type { WakeTurn } from "../../models/wake-turn.js";
import { Resources } from "../../resources.js";

export class SummaryTurn implements ITurnListener {
  private readonly texts: Map<string, string> = new Map<string, string>();

  public static async ask(adapter: IProviderAdapter, request: TurnRequest, signal: AbortSignal): Promise<string | null> {
    const turn = new SummaryTurn();
    const result = await adapter.askIsolated?.(request, turn, signal);
    if (Object.isNullOrUndefined(result))
      return null;
    const text = [...turn.texts.values()].join(Resources.transcriptSeparator).trim();
    if (result.outcome !== TurnOutcome.Completed || text.length === 0)
      throw new OwnSummaryUnansweredException(result.outcome);
    return text;
  }

  public onStartedAsync(): Promise<void> {
    return Promise.resolve();
  }

  public onDetailAsync(detail: TurnDetail): Promise<void> {
    if (detail.kind === DetailKind.Text)
      this.texts.set(detail.providerItemId ?? String(this.texts.size), detail.text);
    return Promise.resolve();
  }

  public onThinking(): void { }

  public onApprovalRequested(ask: ApprovalAsk): Promise<string> {
    const denied = ask.options.find(t => t.outcome === ApprovalOutcome.Denied);
    return Object.isUndefined(denied) ? Promise.reject(new ApprovalNotDeniableException(DenyingTurn.Summary, ask.summary)) : Promise.resolve(denied.id);
  }

  public onQuestionsAsked(): Promise<readonly QuestionAnswer[] | null> {
    return Promise.resolve(null);
  }

  public onQuestionsPostedAsync(): Promise<void> {
    return Promise.resolve();
  }

  public onObservedAsync(): Promise<void> {
    return Promise.resolve();
  }

  public onUsageAsync(): Promise<void> {
    return Promise.resolve();
  }

  public onPlanUsageAsync(): Promise<void> {
    return Promise.resolve();
  }

  public onTaskStartedAsync(): Promise<void> {
    return Promise.resolve();
  }

  public onTaskOutput(): void { }

  public onTaskEndedAsync(): Promise<void> {
    return Promise.resolve();
  }

  public onWakeAsync(): Promise<WakeTurn | null> {
    return Promise.resolve(null);
  }

  public onSharedServerFailedAsync(): Promise<void> {
    return Promise.resolve();
  }
}
