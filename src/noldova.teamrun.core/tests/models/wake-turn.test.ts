/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ApprovalAsk, type ITurnListener, QuestionAsk, SharedMcpFailure, SharedMcpFailureKind, TaskEnd, TaskStart, TurnDetail, TurnOutcome, TurnResult,
  TurnStart, TurnTools, TurnWake, WakeTurn } from "@noldova/teamrun.core";
import { ApprovalKind, ApprovalOption, ApprovalOutcome, ApprovalScope, BackgroundTaskStatus, DetailKind, ObservedSettings, PlanWindow, PlanWindowName, ReplyUsage }
  from "@noldova/teamrun.protocol";
import { ApprovalQuestion, QuestionAnswer, QuestionOption } from "@noldova/teamrun.protocol";

@TestClass
export class WakeTurnTests {
  private static readonly ask: ApprovalAsk = new ApprovalAsk("req-1", ApprovalKind.Command, "Bash", "Run npm test", null,
    [new ApprovalOption("allow", "Allow", ApprovalOutcome.Approved, ApprovalScope.Once)]);
  private static readonly questions: QuestionAsk = new QuestionAsk("req-2", "AskUserQuestion",
    [new ApprovalQuestion("platform", "Platform", "Which platform?", [new QuestionOption("Desktop app", "The window")], false, false, false)]);
  private static readonly answers: readonly QuestionAnswer[] = [new QuestionAnswer("platform", ["Desktop app"], null)];
  private static readonly result: TurnResult = new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null);

  @TestMethod
  public async keepsEveryReportUntilItsReplyFollowsAndForwardsTheRestAsTheyCome(): Promise<void> {
    const wake = new WakeTurn({ TEAMRUN_SENDER_TOKEN: "token" });
    const calls: string[] = [];
    const next = new WakeTurn({});
    const target: ITurnListener = {
      onStartedAsync: t => { calls.push(`started ${t.nativeSessionId}`); return Promise.resolve(); },
      onDetailAsync: t => { calls.push(`detail ${t.text}`); return Promise.resolve(); },
      onThinking: () => { calls.push("thinking"); },
      onApprovalRequested: t => { calls.push(`ask ${t.summary}`); return Promise.resolve("allow"); },
      onQuestionsAsked: t => { calls.push(`questions ${t.questions[0]!.text}`); return Promise.resolve(WakeTurnTests.answers); },
      onQuestionsPostedAsync: t => { calls.push(`posted ${t.providerRequestId}`); return Promise.resolve(); },
      onObservedAsync: t => { calls.push(`observed ${t.kind}`); return Promise.resolve(); },
      onUsageAsync: t => { calls.push(`usage ${t.outputTokens}`); return Promise.resolve(); },
      onPlanUsageAsync: (t, readAt) => { calls.push(`plan ${t.map(u => u.name).join(",")} ${readAt}`); return Promise.resolve(); },
      onTaskStartedAsync: t => { calls.push(`task ${t.command}`); return Promise.resolve(); },
      onTaskOutput: (id, text) => { calls.push(`output ${id} ${text}`); },
      onTaskEndedAsync: t => { calls.push(`ended ${t.taskId} ${t.status}`); return Promise.resolve(); },
      onWakeAsync: t => { calls.push(`wake ${t.taskId}`); return Promise.resolve(next); },
      onSharedServerFailedAsync: t => { calls.push(`failed ${t.server} ${t.kind}`); return Promise.resolve(); }
    };

    await wake.onStartedAsync(new TurnStart("native-1", true));
    await wake.onDetailAsync(new TurnDetail(DetailKind.Text, "Restarted", null, null));
    wake.onThinking();
    const answer = wake.onApprovalRequested(WakeTurnTests.ask);
    const answered = wake.onQuestionsAsked(WakeTurnTests.questions);
    await wake.onQuestionsPostedAsync(WakeTurnTests.questions);
    await wake.onObservedAsync(new ObservedSettings("fake", null, null, null));
    await wake.onUsageAsync(new ReplyUsage(10, 20, null, null));
    await wake.onPlanUsageAsync([new PlanWindow(PlanWindowName.FiveHour, 40, null)], "2026-10-23T12:00:00.000Z");
    await wake.onTaskStartedAsync(new TaskStart("t1", "npm start", () => Promise.resolve()));
    wake.onTaskOutput("t1", "ready");
    await wake.onTaskEndedAsync(new TaskEnd("t1", BackgroundTaskStatus.Completed));
    await wake.onSharedServerFailedAsync(new SharedMcpFailure("p-codex", "Work", "docs", SharedMcpFailureKind.Connection));

    Assert.isNull(await wake.onWakeAsync(new TurnWake("t1", "npm start")));
    Assert.areEqual(0, calls.length);
    Assert.areEqual("token", wake.environment["TEAMRUN_SENDER_TOKEN"]);

    const followed = wake.follow(target, new AbortController().signal);

    Assert.areEqual("allow", await answer);
    Assert.areEqual(WakeTurnTests.answers, await answered);
    Assert.areEqual(["started native-1", "detail Restarted", "thinking", "ask Run npm test", "questions Which platform?", "posted req-2", "observed fake", "usage 20", "plan FiveHour 2026-10-23T12:00:00.000Z", "task npm start", "output t1 ready", "ended t1 Completed", "failed docs Connection"].join("|"),
      calls.join("|"));

    await wake.onDetailAsync(new TurnDetail(DetailKind.Text, "Done", null, null));
    Assert.areEqual("allow", await wake.onApprovalRequested(WakeTurnTests.ask));
    Assert.areEqual(WakeTurnTests.answers, await wake.onQuestionsAsked(WakeTurnTests.questions));
    Assert.isTrue(await wake.onWakeAsync(new TurnWake("t2", null)) === next);
    wake.end(WakeTurnTests.result);

    Assert.isTrue(await followed === WakeTurnTests.result);
    Assert.areEqual(["detail Done", "ask Run npm test", "questions Which platform?", "wake t2"].join("|"), calls.slice(13).join("|"));
  }

  @TestMethod
  public async interruptsTheTurnWhenItsReplyStopsBeforeOrWhileItFollowsOrWhenCancelled(): Promise<void> {
    let interrupts = 0;
    const listener: ITurnListener = {
      onStartedAsync: () => Promise.resolve(), onDetailAsync: () => Promise.resolve(), onThinking: () => undefined, onApprovalRequested: () => Promise.resolve("allow"),
      onQuestionsAsked: () => Promise.resolve(null), onQuestionsPostedAsync: () => Promise.resolve(), onObservedAsync: () => Promise.resolve(), onUsageAsync: () => Promise.resolve(), onPlanUsageAsync: () => Promise.resolve(), onTaskStartedAsync: () => Promise.resolve(), onTaskOutput: () => undefined, onTaskEndedAsync: () => Promise.resolve(), onWakeAsync: () => Promise.resolve(null),
      onSharedServerFailedAsync: () => Promise.resolve()
    };
    const stopped = new AbortController();
    stopped.abort();
    const early = new WakeTurn({});
    early.onInterrupt(() => { interrupts += 1; });

    void early.follow(listener, stopped.signal);

    Assert.areEqual(1, interrupts);

    const running = new AbortController();
    const late = new WakeTurn({});
    late.onInterrupt(() => { interrupts += 1; });
    void late.follow(listener, running.signal);

    Assert.areEqual(1, interrupts);
    running.abort();
    Assert.areEqual(2, interrupts);
    late.cancel();
    Assert.areEqual(3, interrupts);

    new WakeTurn({}).cancel();
    void new WakeTurn({}).follow(listener, stopped.signal);
    Assert.areEqual(3, interrupts);
  }

  @TestMethod
  public async failsWhatItKeptAfterAReportItsReplyRefusesAndForwardsLaterReportsAtOnce(): Promise<void> {
    const wake = new WakeTurn({});
    const refused = new Error("disk full");
    const calls: string[] = [];
    const target: ITurnListener = {
      onStartedAsync: () => Promise.reject(refused), onDetailAsync: t => { calls.push(`detail ${t.text}`); return Promise.resolve(); },
      onThinking: () => { calls.push("thinking"); }, onApprovalRequested: () => Promise.resolve("allow"), onQuestionsAsked: () => Promise.resolve(null),
      onQuestionsPostedAsync: () => Promise.resolve(), onObservedAsync: () => Promise.resolve(), onUsageAsync: () => Promise.resolve(),
      onPlanUsageAsync: () => Promise.resolve(), onTaskStartedAsync: () => Promise.resolve(), onTaskOutput: (id, text) => { calls.push(`output ${id} ${text}`); },
      onTaskEndedAsync: () => Promise.resolve(), onWakeAsync: () => Promise.resolve(null), onSharedServerFailedAsync: () => Promise.resolve()
    };
    await wake.onStartedAsync(new TurnStart("native-1", false));
    await wake.onDetailAsync(new TurnDetail(DetailKind.Text, "Kept", null, null));
    wake.onThinking();
    const answer = wake.onApprovalRequested(WakeTurnTests.ask);
    void answer.catch(() => undefined);

    const followed = wake.follow(target, new AbortController().signal);

    Assert.isTrue(await Assert.throwsAsync(() => followed, Error) === refused);
    Assert.isTrue(await Assert.throwsAsync(() => answer, Error) === refused);
    Assert.areEqual(0, calls.length);
    wake.onThinking();
    wake.onTaskOutput("t1", "ready");
    await wake.onDetailAsync(new TurnDetail(DetailKind.Text, "After", null, null));
    Assert.areEqual("thinking|output t1 ready|detail After", calls.join("|"));
  }

  @TestMethod
  public async forwardsAReportThatArrivesWhileItsKeptReportsReplayAfterThem(): Promise<void> {
    const wake = new WakeTurn({});
    const gate = Promise.withResolvers<void>();
    const reached = Promise.withResolvers<void>();
    const calls: string[] = [];
    const target: ITurnListener = {
      onStartedAsync: async () => { calls.push("started"); reached.resolve(); await gate.promise; },
      onDetailAsync: t => { calls.push(`detail ${t.text}`); return Promise.resolve(); },
      onThinking: () => undefined, onApprovalRequested: () => Promise.resolve("allow"), onQuestionsAsked: () => Promise.resolve(null),
      onQuestionsPostedAsync: () => Promise.resolve(), onObservedAsync: () => Promise.resolve(), onUsageAsync: () => Promise.resolve(),
      onPlanUsageAsync: () => Promise.resolve(), onTaskStartedAsync: () => Promise.resolve(), onTaskOutput: () => undefined,
      onTaskEndedAsync: () => Promise.resolve(), onWakeAsync: () => Promise.resolve(null), onSharedServerFailedAsync: () => Promise.resolve()
    };
    await wake.onStartedAsync(new TurnStart("native-1", false));
    void wake.follow(target, new AbortController().signal);
    await reached.promise;

    const during = wake.onDetailAsync(new TurnDetail(DetailKind.Text, "During", null, null));
    Assert.areEqual("started", calls.join("|"));
    gate.resolve();
    await during;

    Assert.areEqual("started|detail During", calls.join("|"));
  }

  @TestMethod
  public routesASenderTokenOnlyThroughTheEngineThatMadeIt(): void {
    const adopted: string[] = [];

    Assert.isTrue(new WakeTurn({}, false, t => adopted.push(t) > 0).adoptSender("first-turn"));
    Assert.isFalse(new WakeTurn({}).adoptSender("first-turn"));
    Assert.areEqual(JSON.stringify(["first-turn"]), JSON.stringify(adopted));
  }

  @TestMethod
  public async tellsEachHandlerOnceItsReplyFollowsAndAHandlerAddedAfterAtOnce(): Promise<void> {
    const wake = new WakeTurn({});
    const heard: string[] = [];

    wake.onFollowed(() => heard.push("before"));
    const beforeFollow = heard.length;
    const following = wake.follow(new WakeTurn({}), new AbortController().signal);
    wake.onFollowed(() => heard.push("after"));
    wake.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
    await following;

    Assert.areEqual(0, beforeFollow);
    Assert.areEqual("before,after", heard.join(","));
  }

  @TestMethod
  public async handsItsToolsToEachHandlerOnceTheyOpenAndIgnoresAWakeWithoutTools(): Promise<void> {
    const wake = new WakeTurn({});
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, []);
    const handed: TurnTools[] = [];

    await wake.onToolsAsync(t => { handed.push(t); return Promise.resolve(); });
    await wake.useToolsAsync(null);
    const beforeOpen = handed.length;
    await wake.useToolsAsync(tools);
    await wake.onToolsAsync(t => { handed.push(t); return Promise.resolve(); });

    Assert.areEqual(0, beforeOpen);
    Assert.areEqual(2, handed.length);
    Assert.isTrue(handed.every(t => t === tools));
  }
}
