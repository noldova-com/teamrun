/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestData, TestMethod, Wait } from "@noldova/teamrun-foundation-testing";

@TestClass
export class WaitTests {
  @TestMethod
  public async returnsAtOnceForAConditionThatAlreadyHolds(): Promise<void> {
    let checks = 0;

    const held = await Wait.untilAsync(() => ++checks > 0, 10_000, 10_000);

    Assert.isTrue(held);
    Assert.areEqual(1, checks);
  }

  @TestMethod
  public async checksAgainAfterEachIntervalUntilTheConditionHolds(): Promise<void> {
    let checks = 0;

    const held = await Wait.untilAsync(async () => await Promise.resolve(++checks === 3), 10_000, 1);

    Assert.isTrue(held);
    Assert.areEqual(3, checks);
  }

  @TestMethod
  public async reportsAConditionThatDoesNotHoldWithinTheLimitAfterCheckingAtTheLimit(): Promise<void> {
    let checks = 0;
    const started = performance.now();

    const held = await Wait.untilAsync(() => ++checks < 0, 50);

    Assert.isFalse(held);
    Assert.isTrue(performance.now() - started >= 50, "The wait checked until its limit.");
    Assert.isTrue(checks >= 2, `The wait checked ${checks} times.`);
  }

  @TestMethod
  public async checksOnceWithALimitOfZero(): Promise<void> {
    let checks = 0;

    const held = await Wait.untilAsync(() => ++checks < 0, 0);

    Assert.isFalse(held);
    Assert.areEqual(1, checks);
  }

  @TestMethod
  public async rejectsWithTheConditionsOwnFailure(): Promise<void> {
    const failure = new RangeError("The process list could not be read.");

    Assert.areEqual(failure, await Assert.throwsAsync(() => Wait.untilAsync(() => Promise.reject(failure), 1000), RangeError));
  }

  @TestMethod
  @TestData(-1, 25, "The wait's limit must be a non-negative integer of milliseconds.")
  @TestData(1.5, 25, "The wait's limit must be a non-negative integer of milliseconds.")
  @TestData(1000, 0, "The wait's interval must be a positive integer of milliseconds.")
  @TestData(1000, Number.NaN, "The wait's interval must be a positive integer of milliseconds.")
  public async refusesANegativeOrFractionalLimitAndAnIntervalThatIsNotPositive(limit: number, interval: number, message: string): Promise<void> {
    let checks = 0;

    const failure = Assert.throws(() => void Wait.untilAsync(() => ++checks > 0, limit, interval), ArgumentOutOfRangeException);

    Assert.isTrue(failure.message.startsWith(message), failure.message);
    Assert.areEqual(0, checks);
  }
}
