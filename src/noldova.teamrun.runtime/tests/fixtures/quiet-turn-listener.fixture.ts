/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ITurnListener } from "@noldova/teamrun.core";

export class QuietTurnListener implements ITurnListener {
  public readonly calls: string[] = [];

  public onStartedAsync(): Promise<void> {
    this.calls.push("started");
    return Promise.resolve();
  }

  public onDetailAsync(): Promise<void> {
    this.calls.push("detail");
    return Promise.resolve();
  }

  public onThinking(): void {
    this.calls.push("thinking");
  }

  public onApprovalRequested(): Promise<string> {
    this.calls.push("approval");
    return Promise.resolve("");
  }

  public onQuestionsPostedAsync(): Promise<void> {
    this.calls.push("posted");
    return Promise.resolve();
  }

  public onQuestionsAsked(): Promise<null> {
    this.calls.push("questions");
    return Promise.resolve(null);
  }

  public onObservedAsync(): Promise<void> {
    this.calls.push("observed");
    return Promise.resolve();
  }

  public onUsageAsync(): Promise<void> {
    this.calls.push("usage");
    return Promise.resolve();
  }

  public onPlanUsageAsync(): Promise<void> {
    this.calls.push("planUsage");
    return Promise.resolve();
  }

  public onTaskStartedAsync(): Promise<void> {
    this.calls.push("taskStarted");
    return Promise.resolve();
  }

  public onTaskOutput(): void {
    this.calls.push("taskOutput");
  }

  public onTaskEndedAsync(): Promise<void> {
    this.calls.push("taskEnded");
    return Promise.resolve();
  }

  public onWakeAsync(): Promise<null> {
    this.calls.push("wake");
    return Promise.resolve(null);
  }

  public onSharedServerFailedAsync(): Promise<void> {
    this.calls.push("sharedServerFailed");
    return Promise.resolve();
  }
}
