/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ApprovalAsk, ApprovalNotDeniableException, DenyingTurn, Resources, SummaryTurn, TurnDetail, TurnOutcome, TurnRequest } from "@noldova/teamrun.core";
import { ApprovalKind, ApprovalOption, ApprovalOutcome, ApprovalScope, DetailKind, RequestedSettings } from "@noldova/teamrun.protocol";

import { FakeProviderAdapter } from "../../fixtures/fake-provider-adapter.fixture.js";

@TestClass
export class SummaryTurnTests {
  private static readonly request: TurnRequest = new TurnRequest(null, "D:/work", "Summarize", new RequestedSettings("fake", null, null), null);

  @TestMethod
  public async answersWithEveryTextItemAtItsLatestJoinedByBlankLines(): Promise<void> {
    const adapter = new FakeProviderAdapter();
    adapter.extraDetails = [new TurnDetail(DetailKind.Text, "First", null, "item-1"), new TurnDetail(DetailKind.Reasoning, "Thinking", null, "item-2"),
      new TurnDetail(DetailKind.Text, "First part", null, "item-1")];
    adapter.detailTexts = ["Second", " Third "];
    adapter.runsIsolated();

    const answer = await SummaryTurn.ask(adapter, SummaryTurnTests.request, new AbortController().signal);

    Assert.areEqual(["First part", "Second", " Third"].join(Resources.transcriptSeparator), answer);
  }

  @TestMethod
  public async rejectsARequestThatDoesNotCompleteOrWritesNoText(): Promise<void> {
    const failed = new FakeProviderAdapter();
    failed.outcome = TurnOutcome.Failed;
    failed.error = "Failed";
    const silent = new FakeProviderAdapter();
    silent.detailTexts = [" "];
    failed.runsIsolated();
    silent.runsIsolated();
    const reason = (adapter: FakeProviderAdapter): Promise<string> =>
      SummaryTurn.ask(adapter, SummaryTurnTests.request, new AbortController().signal).then(() => "answered", (error: unknown) => String(error));

    const reasons = [await reason(failed), await reason(silent)];

    Assert.areEqual([`OwnSummaryUnansweredException: ${Resources.formatOwnSummaryUnanswered(TurnOutcome.Failed)}`, `OwnSummaryUnansweredException: ${Resources.formatOwnSummaryUnanswered(TurnOutcome.Completed)}`].join("|"),
      reasons.join("|"));
  }

  @TestMethod
  public async answersNothingWhereTheAdapterRunsNoIsolatedTurn(): Promise<void> {
    const none = new FakeProviderAdapter();
    const refusing = new FakeProviderAdapter();
    refusing.askIsolated = () => Promise.resolve(null);

    const answers = [await SummaryTurn.ask(none, SummaryTurnTests.request, new AbortController().signal),
      await SummaryTurn.ask(refusing, SummaryTurnTests.request, new AbortController().signal)];

    Assert.areEqual("null|null", answers.map(t => String(t)).join("|"));
    Assert.areEqual(0, none.requests.length + refusing.requests.length);
  }

  @TestMethod
  public async deniesEachApprovalItCanAndAnswersNoQuestionOrWake(): Promise<void> {
    const turn = new SummaryTurn();
    const allow = new ApprovalOption("allow", "Allow", ApprovalOutcome.Approved, ApprovalScope.Once);
    const deny = new ApprovalOption("deny", "Deny", ApprovalOutcome.Denied, ApprovalScope.Once);

    const denied = await turn.onApprovalRequested(new ApprovalAsk("r-1", ApprovalKind.Command, "shell", "Run", null, [allow, deny]));
    const refused = await Assert.throwsAsync(() => turn.onApprovalRequested(new ApprovalAsk("r-2", ApprovalKind.Command, "shell", "Run the tests", null, [allow])), ApprovalNotDeniableException);
    await turn.onStartedAsync();
    turn.onThinking();
    await turn.onQuestionsPostedAsync();
    await turn.onObservedAsync();
    await turn.onUsageAsync();
    await turn.onPlanUsageAsync();
    await turn.onTaskStartedAsync();
    turn.onTaskOutput();
    await turn.onTaskEndedAsync();
    await turn.onSharedServerFailedAsync();

    Assert.areEqual(`deny|${Resources.summaryTurnNotDeniable}|${DenyingTurn.Summary}|Run the tests`, `${denied}|${refused.message}|${refused.turn}|${refused.summary}`);
    Assert.isNull(await turn.onQuestionsAsked());
    Assert.isNull(await turn.onWakeAsync());
  }
}
