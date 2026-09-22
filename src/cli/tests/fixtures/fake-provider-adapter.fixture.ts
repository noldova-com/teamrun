/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rmSync } from "node:fs";
import { dirname } from "node:path";

import "@noldova/teamrun-foundation-core";
import {
  type ApprovalAsk,
  type ForkRequest,
  type IProviderAdapter,
  type ITurnListener,
  SignInCheck,
  TurnDetail,
  type TurnRequest,
  TurnOutcome,
  TurnResult,
  TurnStart
} from "@noldova/teamrun-core";
import { AuthStatus, DetailKind, ObservedSettings, type ProviderAccount, ProviderAccountIdentity, ProviderDescriptor, ProviderModel } from "@noldova/teamrun-protocol";

export class FakeProviderAdapter implements IProviderAdapter {
  public readonly descriptor: ProviderDescriptor = new ProviderDescriptor("fake", "Fake provider", ["low", "high"], true, true);
  public readonly prompts: string[] = [];
  public approvalAsk: ApprovalAsk | null = null;
  public holdUntilAbort: boolean = false;
  public outcome: TurnOutcome = TurnOutcome.Completed;
  public removeFixture: boolean = false;
  public streamedTexts: readonly string[] = [];

  public checkSignIn(_account: ProviderAccount): Promise<SignInCheck> {
    return Promise.resolve(new SignInCheck(AuthStatus.LoggedIn, new ProviderAccountIdentity("dev@example.com"), "1.0.0", null));
  }

  public listModels(_account: ProviderAccount | null): Promise<readonly ProviderModel[]> {
    return Promise.resolve([new ProviderModel("fake-model", "Fake model", "Fixture", ["high"], true, null, true)]);
  }

  public async runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult> {
    this.prompts.push(request.prompt);
    const sessionId = `session-${this.prompts.length}`;
    const observed = new ObservedSettings("fake", "fake-model", "high", "1.0.0", null);
    listener.onStarted(new TurnStart(sessionId, false));
    listener.onObserved(observed);
    listener.onDetail(new TurnDetail(DetailKind.Text, `Reply to ${request.prompt}`, null, null));
    for (const text of this.streamedTexts)
      listener.onDetail(new TurnDetail(DetailKind.Text, text, null, "streamed"));
    if (this.removeFixture)
      rmSync(dirname(request.workingDirectory), { recursive: true, force: true });
    if (!Object.isNull(this.approvalAsk)) {
      const decision = await listener.onApprovalRequested(this.approvalAsk);
      listener.onDetail(new TurnDetail(DetailKind.Note, `decided ${decision}`, null, null));
    }
    if (this.holdUntilAbort && !signal.aborted)
      await new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
    if (signal.aborted)
      return new TurnResult(TurnOutcome.Interrupted, sessionId, observed, null);

    return new TurnResult(this.outcome, sessionId, observed, this.outcome === TurnOutcome.Failed ? "fake failure" : null);
  }

  public forkSession(request: ForkRequest): Promise<string> {
    return Promise.resolve(`fork-of-${request.nativeSessionId}`);
  }

  public shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
