/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ApprovalAsk, type ForkRequest, type IProviderAdapter, type ITurnListener, SignInCheck,
  TurnDetail, TurnOutcome, type TurnRequest, TurnResult, TurnStart
} from "@noldova/teamrun-core";
import {
  ApprovalKind, ApprovalOption, ApprovalOutcome, AuthStatus, DetailKind, ObservedSettings,
  type ProviderAccount, ProviderAccountIdentity, ProviderDescriptor, ProviderModel
} from "@noldova/teamrun-protocol";

export class FixtureProvider implements IProviderAdapter {
  public readonly descriptor = new ProviderDescriptor("codex", "Fixture provider", ["low"], true, true);
  public readonly requests: TurnRequest[] = [];

  public checkSignIn(_account: ProviderAccount): Promise<SignInCheck> {
    return Promise.resolve(new SignInCheck(AuthStatus.LoggedIn, new ProviderAccountIdentity("fixture@example.test"), "fixture", null));
  }

  public listModels(_account: ProviderAccount | null): Promise<readonly ProviderModel[]> {
    return Promise.resolve([new ProviderModel("fixture-model", "Fixture model", "UI fixture", ["low"], true, null, true)]);
  }

  public async runTurn(request: TurnRequest, listener: ITurnListener, signal: AbortSignal): Promise<TurnResult> {
    this.requests.push(request);
    const session = "fixture-session";
    const observed = new ObservedSettings("codex", "fixture-model", "low", "fixture", null);
    listener.onStarted(new TurnStart(session, false));
    listener.onObserved(observed);
    if (request.prompt.includes("Request approval")) {
      await listener.onApprovalRequested(new ApprovalAsk("fixture-approval", ApprovalKind.Tool, "fixture", "Fixture approval", null,
        [new ApprovalOption("allow", "Allow fixture", ApprovalOutcome.Approved), new ApprovalOption("deny", "Deny fixture", ApprovalOutcome.Denied)]));
    }
    if (request.prompt.includes("Wait for cancellation")) {
      listener.onDetail(new TurnDetail(DetailKind.Text, "Waiting for Stop.", null, null));
      if (!signal.aborted)
        await new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
    }
    else
      listener.onDetail(new TurnDetail(DetailKind.Text, "Fixture reply completed.", null, null));
    return new TurnResult(signal.aborted ? TurnOutcome.Interrupted : TurnOutcome.Completed, session, observed, null);
  }

  public forkSession(_request: ForkRequest): Promise<string> {
    return Promise.resolve("fixture-fork");
  }

  public shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
