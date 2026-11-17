/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ActiveRun } from "@noldova/teamrun.core";
import { ApprovalDecideParams, ErrorCode, QuestionAnswer } from "@noldova/teamrun.protocol";

@TestClass
export class ActiveRunTests {
  @TestMethod
  public async resolvesADecisionWithTheParametersItWasMadeWith(): Promise<void> {
    const run = new ActiveRun("msg-1");
    const params = new ApprovalDecideParams("a", "answer", [new QuestionAnswer("q", ["Yes"], null)]);

    Assert.isFalse(run.decide(params));
    const decision = run.awaitDecision("a");
    Assert.isTrue(run.isAwaitingDecision);
    Assert.isTrue(run.decide(params));

    Assert.areEqual(params, await decision);
    Assert.isFalse(run.isAwaitingDecision);
    Assert.isFalse(run.isCancelled);
    Assert.isFalse(run.signal.aborted);
  }

  @TestMethod
  public async rejectsAPendingDecisionWhenCancelled(): Promise<void> {
    const run = new ActiveRun("msg-1");
    const decision = run.awaitDecision("a");

    run.cancel();
    run.cancel();

    Assert.isTrue(run.isCancelled);
    Assert.isTrue(run.signal.aborted);
    Assert.isFalse(run.isAwaitingDecision);
    const failure = await ActiveRunTests.rejection(decision);
    Assert.areEqual(ErrorCode.Conflict, failure.info.name);
    Assert.areEqual("msg-1", failure.info.arguments[0]);
  }

  @TestMethod
  public abortsTheSignalAfterTheTurnOnlyOnACancelAfterIt(): void {
    const run = new ActiveRun("msg-1");
    run.cancel();
    const afterTurn = run.afterTurn();

    Assert.isTrue(run.signal.aborted);
    Assert.isFalse(afterTurn.aborted);
    run.cancel();
    Assert.isTrue(afterTurn.aborted);
    const closing = run.afterTurn();
    run.close();
    Assert.isFalse(closing.aborted);
  }

  @TestMethod
  public async cancelsAKeptRunAfterItsTurnThroughItsStopAndStaysOpenSoARefusedStopIsTriedAgain(): Promise<void> {
    const run = new ActiveRun("msg-1");
    const stops: string[] = [];
    run.keepOpen(() => {
      stops.push("stop");
      return stops.length === 1 ? Promise.reject(new Error("refused")) : Promise.resolve();
    });
    run.close();
    const waiting = ActiveRunTests.rejection(run.awaitDecision("late"));

    const refused = await Assert.throwsAsync(() => run.cancelAfterTurn(), Error);
    await run.cancelAfterTurn();
    const later = ActiveRunTests.rejection(run.awaitDecision("later"));

    Assert.areEqual("refused", refused.message);
    Assert.areEqual("stop,stop", stops.join());
    Assert.areEqual(ErrorCode.Conflict, (await waiting).info.name);
    Assert.areEqual(ErrorCode.Conflict, (await later).info.name);
    Assert.isFalse(run.isAwaitingDecision);
    Assert.isTrue(run.isCancelled);
    Assert.isTrue(run.isOpen);
  }

  @TestMethod
  public async cancelsARunWithNothingKeptAfterItsTurnWithoutStoppingAnything(): Promise<void> {
    const run = new ActiveRun("msg-1");

    await run.cancelAfterTurn();

    Assert.isTrue(run.isCancelled);
    Assert.isTrue(run.isOpen);
  }

  @TestMethod
  public async withdrawsOneDecisionAndLeavesTheOthersWaiting(): Promise<void> {
    const run = new ActiveRun("msg-1");
    const first = run.awaitDecision("first");
    const second = run.awaitDecision("second");

    Assert.isTrue(run.withdraw("first"));
    Assert.isFalse(run.withdraw("first"));

    const failure = await ActiveRunTests.rejection(first);
    Assert.areEqual(ErrorCode.Conflict, failure.info.name);
    Assert.areEqual("first", failure.info.arguments[0]);
    Assert.isFalse(run.hasDecision("first"));
    Assert.isTrue(run.isAwaitingDecision);
    Assert.isFalse(run.signal.aborted);
    Assert.isTrue(run.decide(new ApprovalDecideParams("second", "accept")));
    Assert.areEqual("accept", (await second).optionId);
  }

  @TestMethod
  public rejectsABlankMessageId(): void {
    Assert.areEqual("messageId", Assert.throws(() => new ActiveRun(" "), ArgumentException).parameterName);
  }

  @TestMethod
  public async keepsConcurrentDecisionsSeparateAndClosesEveryWaiter(): Promise<void> {
    const run = new ActiveRun("msg-1");
    const first = run.awaitDecision("first");
    const second = run.awaitDecision("second");
    Assert.areEqual(ErrorCode.Conflict, (await ActiveRunTests.rejection(run.awaitDecision("first"))).info.name);
    Assert.isTrue(run.decide(new ApprovalDecideParams("second", "deny")));
    Assert.areEqual("deny", (await second).optionId);
    Assert.isTrue(run.hasDecision("first"));
    Assert.isFalse(run.hasDecision("second"));
    const third = run.awaitDecision("third");
    const rejected = Promise.all([ActiveRunTests.rejection(first), ActiveRunTests.rejection(third)]);
    run.close();
    Assert.areEqual(2, (await rejected).length);
    Assert.isFalse(run.isAwaitingDecision);
    Assert.isFalse(run.isCancelled);
    Assert.areEqual(ErrorCode.Conflict, (await ActiveRunTests.rejection(run.awaitDecision("late"))).info.name);
    Assert.throws(() => run.awaitDecision(" "), ArgumentException);
  }

  @TestMethod
  public async keepsItsDecisionsOpenPastTheTurnsCloseUntilReleased(): Promise<void> {
    const run = new ActiveRun("msg-1");
    const waiting = run.awaitDecision("during");
    let released = false;
    void run.released.then(() => { released = true; });

    run.keepOpen(ActiveRunTests.stopNothing);
    run.close();
    const late = run.awaitDecision("late");
    Assert.isTrue(run.signal.aborted);
    Assert.isTrue(run.isOpen);
    Assert.isTrue(run.decide(new ApprovalDecideParams("late", "accept")));
    Assert.areEqual("accept", (await late).optionId);
    const rejected = ActiveRunTests.rejection(waiting);
    run.release();
    run.release();
    await run.released;

    Assert.areEqual(ErrorCode.Conflict, (await rejected).info.name);
    Assert.isFalse(run.isOpen);
    Assert.isTrue(released);
    Assert.areEqual(ErrorCode.Conflict, (await ActiveRunTests.rejection(run.awaitDecision("after"))).info.name);
    Assert.isFalse(run.isCancelled);
  }

  @TestMethod
  public async closesItsDecisionsOnACancelEvenWhenKeptOpenAndKeepsNoneOpenOnceCancelled(): Promise<void> {
    const kept = new ActiveRun("msg-1");
    kept.keepOpen(ActiveRunTests.stopNothing);
    kept.close();
    const waiting = ActiveRunTests.rejection(kept.awaitDecision("late"));
    kept.cancel();
    const cancelled = new ActiveRun("msg-2");
    cancelled.cancel();
    cancelled.keepOpen(ActiveRunTests.stopNothing);
    cancelled.close();

    Assert.areEqual(ErrorCode.Conflict, (await waiting).info.name);
    Assert.areEqual("false,false", [kept.isOpen, cancelled.isOpen].join(","));
    await Promise.all([kept.released, cancelled.released]);
  }

  private static stopNothing(): Promise<void> {
    return Promise.resolve();
  }

  private static async rejection(promise: Promise<unknown>): Promise<ServiceException> {
    try {
      await promise;
    }
    catch (error) {
      if (error instanceof ServiceException)
        return error;
      throw error;
    }
    throw new Error("The promise did not reject.");
  }
}
