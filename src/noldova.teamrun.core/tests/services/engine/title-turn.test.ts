/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ApprovalAsk, ApprovalNotDeniableException, DenyingTurn, type ITurnListener, TitleTurn, TurnDetail, TurnOutcome, TurnRequest, TurnResult } from "@noldova/teamrun.core";
import { ApprovalKind, ApprovalOption, ApprovalOutcome, ApprovalScope, DetailKind, ObservedSettings, RequestedSettings } from "@noldova/teamrun.protocol";

import { FakeProviderAdapter } from "../../fixtures/fake-provider-adapter.fixture.js";

@TestClass
export class TitleTurnTests {
  private static readonly request: TurnRequest = new TurnRequest(null, "/title-sessions", "Name it", new RequestedSettings("fake", null, null), null);
  private static readonly observed: ObservedSettings = new ObservedSettings("fake", null, null, null);

  private static ask(run: (listener: ITurnListener) => Promise<TurnOutcome>): Promise<string | null> {
    const adapter = new FakeProviderAdapter();
    adapter.askIsolated = async (_request, listener) => {
      const outcome = await run(listener);
      return new TurnResult(outcome, null, TitleTurnTests.observed, outcome === TurnOutcome.Failed ? "failed" : null);
    };
    return TitleTurn.ask(adapter, TitleTurnTests.request, new AbortController().signal);
  }

  private static approval(options: readonly ApprovalOption[]): ApprovalAsk {
    return new ApprovalAsk("r1", ApprovalKind.Command, "shell", "Run a command", null, options);
  }

  @TestMethod
  public async keepsTheLastTextOfACompletedTurn(): Promise<void> {
    Assert.areEqual("Second", await TitleTurnTests.ask(async listener => {
      await listener.onDetailAsync(new TurnDetail(DetailKind.Text, "First", null, "one"));
      await listener.onDetailAsync(new TurnDetail(DetailKind.Note, "A note", null, null));
      await listener.onDetailAsync(new TurnDetail(DetailKind.Text, "Second", null, "one"));
      await listener.onDetailAsync(new TurnDetail(DetailKind.Reasoning, "Thinking", null, "two"));
      return Promise.resolve(TurnOutcome.Completed);
    }));
    Assert.isNull(await TitleTurnTests.ask(() => Promise.resolve(TurnOutcome.Completed)));
  }

  @TestMethod
  public async findsNoTitleInATurnThatDidNotComplete(): Promise<void> {
    for (const outcome of [TurnOutcome.Failed, TurnOutcome.Interrupted])
      Assert.isNull(await TitleTurnTests.ask(async listener => {
        await listener.onDetailAsync(new TurnDetail(DetailKind.Text, "Partial", null, "one"));
        return Promise.resolve(outcome);
      }));
    const gone = new FakeProviderAdapter();
    gone.askIsolated = () => Promise.reject(new Error("The agent is gone."));
    await Assert.throwsAsync(() => TitleTurn.ask(gone, TitleTurnTests.request, new AbortController().signal), Error);
  }

  @TestMethod
  public async findsNoTitleWhereTheAdapterRunsNoIsolatedTurn(): Promise<void> {
    const none = new FakeProviderAdapter();
    const refusing = new FakeProviderAdapter();
    refusing.askIsolated = () => Promise.resolve(null);

    const answers = [await TitleTurn.ask(none, TitleTurnTests.request, new AbortController().signal),
      await TitleTurn.ask(refusing, TitleTurnTests.request, new AbortController().signal)];

    Assert.areEqual("null|null", answers.map(t => String(t)).join("|"));
    Assert.areEqual(0, none.requests.length + refusing.requests.length);
  }

  @TestMethod
  public async refusesApprovalsAndQuestionsAndIgnoresEverythingElse(): Promise<void> {
    await TitleTurnTests.ask(async listener => {
      const allow = new ApprovalOption("yes", "Allow", ApprovalOutcome.Approved, ApprovalScope.Once);
      const deny = new ApprovalOption("no", "Deny", ApprovalOutcome.Denied, ApprovalScope.Once);
      Assert.areEqual("no", await listener.onApprovalRequested(TitleTurnTests.approval([allow, deny])));
      const refused = await Assert.throwsAsync(() => listener.onApprovalRequested(TitleTurnTests.approval([allow])), ApprovalNotDeniableException);
      Assert.areEqual(`${DenyingTurn.Title}|Run a command`, `${refused.turn}|${refused.summary}`);
      Assert.isNull(await listener.onQuestionsAsked(null as never));
      Assert.isNull(await listener.onWakeAsync(null as never));
      Assert.isUndefined(listener.onTitleAsync);
      await listener.onStartedAsync(null as never);
      listener.onThinking();
      await listener.onQuestionsPostedAsync(null as never);
      await listener.onObservedAsync(TitleTurnTests.observed);
      await listener.onUsageAsync(null as never);
      await listener.onPlanUsageAsync([], "t1");
      await listener.onTaskStartedAsync(null as never);
      listener.onTaskOutput("t", "text");
      await listener.onTaskEndedAsync(null as never);
      await listener.onSharedServerFailedAsync(null as never);
      return TurnOutcome.Completed;
    });
  }
}
