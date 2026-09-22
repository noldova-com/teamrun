/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
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
  public holdUntilAbort: boolean = false;
  public shutdowns: number = 0;

  public checkSignIn(_account: ProviderAccount): Promise<SignInCheck> {
    return Promise.resolve(new SignInCheck(AuthStatus.LoggedIn, new ProviderAccountIdentity("dev@example.com"), "1.0.0", null));
  }

  public listModels(_account: ProviderAccount | null): Promise<readonly ProviderModel[]> {
    return Promise.resolve([new ProviderModel("fake-model", "Fake model", "Fixture", ["high"], true, null, true)]);
  }

  public async runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult> {
    this.prompts.push(request.prompt);
    const observed = new ObservedSettings("fake", "fake-model", "high", "1.0.0", null);
    listener.onStarted(new TurnStart(`session-${this.prompts.length}`, false));
    listener.onObserved(observed);
    listener.onDetail(new TurnDetail(DetailKind.Text, `Reply to ${request.prompt}`, null, null));
    if (this.holdUntilAbort)
      await new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));

    return new TurnResult(signal.aborted ? TurnOutcome.Interrupted : TurnOutcome.Completed, `session-${this.prompts.length}`, observed, null);
  }

  public forkSession(request: ForkRequest): Promise<string> {
    return Promise.resolve(`fork-of-${request.nativeSessionId}`);
  }

  public shutdown(): Promise<void> {
    this.shutdowns += 1;
    return Promise.resolve();
  }
}
