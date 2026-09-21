/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ActiveRun } from "@noldova/teamrun-core";
import { ErrorCode } from "@noldova/teamrun-protocol";

@TestClass
export class ActiveRunTests {
  @TestMethod
  public async resolvesADecision(): Promise<void> {
    const run = new ActiveRun("msg-1");

    Assert.isFalse(run.decide("a", "accept"));
    const decision = run.awaitDecision("a");
    Assert.isTrue(run.isAwaitingDecision);
    Assert.isTrue(run.decide("a", "accept"));

    Assert.areEqual("accept", await decision);
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
  public rejectsABlankMessageId(): void {
    Assert.areEqual("messageId", Assert.throws(() => new ActiveRun(" "), ArgumentException).parameterName);
  }

  @TestMethod
  public async keepsConcurrentDecisionsSeparateAndClosesEveryWaiter(): Promise<void> {
    const run = new ActiveRun("msg-1");
    const first = run.awaitDecision("first");
    const second = run.awaitDecision("second");
    Assert.areEqual(ErrorCode.Conflict, (await ActiveRunTests.rejection(run.awaitDecision("first"))).info.name);
    Assert.isTrue(run.decide("second", "deny"));
    Assert.areEqual("deny", await second);
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
