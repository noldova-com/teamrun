/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ObservedSettings, PlanWindow, QuestionAnswer, ReplyUsage } from "@noldova/teamrun.protocol";

import type { ApprovalAsk } from "../models/approval-ask.js";
import type { QuestionAsk } from "../models/question-ask.js";
import type { SharedMcpFailure } from "../models/shared-mcp-failure.js";
import type { TaskEnd } from "../models/task-end.js";
import type { TaskStart } from "../models/task-start.js";
import type { TurnDetail } from "../models/turn-detail.js";
import type { TurnStart } from "../models/turn-start.js";
import type { TurnSteer } from "../models/turn-steer.js";
import type { TurnWake } from "../models/turn-wake.js";
import type { WakeTurn } from "../models/wake-turn.js";

export interface ITurnListener {
  onStartedAsync(start: TurnStart): Promise<void>;
  onDetailAsync(detail: TurnDetail): Promise<void>;
  onThinking(): void;
  onApprovalRequested(ask: ApprovalAsk, signal?: AbortSignal): Promise<string>;
  onQuestionsAsked(ask: QuestionAsk, signal?: AbortSignal): Promise<readonly QuestionAnswer[] | null>;
  onQuestionsPostedAsync(ask: QuestionAsk): Promise<void>;
  onObservedAsync(observed: ObservedSettings): Promise<void>;
  onUsageAsync(usage: ReplyUsage): Promise<void>;
  onPlanUsageAsync(windows: readonly PlanWindow[], readAt: string): Promise<void>;
  onTaskStartedAsync(start: TaskStart): Promise<void>;
  onTaskOutput(taskId: string, text: string): void;
  onTaskEndedAsync(end: TaskEnd): Promise<void>;
  onWakeAsync(wake: TurnWake): Promise<WakeTurn | null>;
  onSharedServerFailedAsync(failure: SharedMcpFailure): Promise<void>;
  onTitleAsync?(title: string): Promise<void>;
  onSteerable?(steer: ((steer: TurnSteer) => Promise<boolean>) | null): void;
}
