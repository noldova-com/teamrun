/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CloseCoordinator } from "@noldova/teamrun-shell-desktop";

@TestClass
export class CloseCoordinatorTests {
  @TestMethod
  @TestData(0)
  @TestData(1.5)
  public needsAPositiveWholeTimeout(timeout: number): void {
    Assert.throws(() => new CloseCoordinator(() => true, timeout), ArgumentOutOfRangeException);
  }

  @TestMethod
  public async closesWhenTheWindowAnswersSaved(): Promise<void> {
    const requestIds: string[] = [];
    const coordinator = new CloseCoordinator(t => requestIds.push(t) > 0, 60000);

    const canClose = coordinator.requestAsync();

    Assert.areEqual(1, requestIds.length);
    Assert.isTrue(coordinator.answer(requestIds[0], true));
    Assert.isTrue(await canClose);
    Assert.isFalse(coordinator.answer(requestIds[0], true));
  }

  @TestMethod
  public async staysOpenWhenTheWindowKeepsWork(): Promise<void> {
    const requestIds: string[] = [];
    const coordinator = new CloseCoordinator(t => requestIds.push(t) > 0, 60000);

    const canClose = coordinator.requestAsync();
    coordinator.answer(requestIds[0], false);

    Assert.isFalse(await canClose);
  }

  @TestMethod
  public async givesEachRequestItsOwnId(): Promise<void> {
    const requestIds: string[] = [];
    const coordinator = new CloseCoordinator(t => requestIds.push(t) > 0, 60000);

    const first = coordinator.requestAsync();
    const second = coordinator.requestAsync();
    coordinator.answer(requestIds[1], false);
    coordinator.answer(requestIds[0], true);

    Assert.areNotEqual(requestIds[0], requestIds[1]);
    Assert.isTrue(await first);
    Assert.isFalse(await second);
  }

  @TestMethod
  public async ignoresAnswersThatDoNotMatchARequest(): Promise<void> {
    const requestIds: string[] = [];
    const coordinator = new CloseCoordinator(t => requestIds.push(t) > 0, 60000);

    const canClose = coordinator.requestAsync();

    Assert.isFalse(coordinator.answer("another", true));
    Assert.isFalse(coordinator.answer(42, true));
    Assert.isFalse(coordinator.answer(requestIds[0], "yes"));
    Assert.isTrue(coordinator.answer(requestIds[0], false));
    Assert.isFalse(await canClose);
  }

  @TestMethod
  public async closesWhenTheRequestCannotBeSent(): Promise<void> {
    const coordinator = new CloseCoordinator(() => false, 60000);

    Assert.isTrue(await coordinator.requestAsync());
  }

  @TestMethod
  public async closesWhenTheWindowDoesNotAnswerInTime(): Promise<void> {
    const requestIds: string[] = [];
    const coordinator = new CloseCoordinator(t => requestIds.push(t) > 0, 1);

    Assert.isTrue(await coordinator.requestAsync());
    Assert.isFalse(coordinator.answer(requestIds[0], false));
  }

  @TestMethod
  public async closesEveryPendingRequestOnRelease(): Promise<void> {
    const coordinator = new CloseCoordinator(() => true, 60000);

    const first = coordinator.requestAsync();
    const second = coordinator.requestAsync();
    coordinator.release();

    Assert.isTrue(await first);
    Assert.isTrue(await second);
  }
}
