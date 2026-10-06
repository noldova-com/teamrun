/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { UpdateSaveCoordinator } from "@noldova/teamrun-shell-desktop";

@TestClass
export class UpdateSaveCoordinatorTests {
  @TestMethod
  @TestData(0)
  @TestData(1.5)
  public needsAPositiveWholeTimeout(timeout: number): void {
    Assert.throws(() => new UpdateSaveCoordinator(() => true, timeout), ArgumentOutOfRangeException);
  }

  @TestMethod
  public async passesOnWhatTheWindowCouldNotSave(): Promise<void> {
    const requestIds: string[] = [];
    const coordinator = new UpdateSaveCoordinator(t => requestIds.push(t) > 0, 60000);

    const first = coordinator.requestAsync(1);
    const second = coordinator.requestAsync(1);

    Assert.areNotEqual(requestIds[0], requestIds[1]);
    Assert.isTrue(coordinator.answer(requestIds[1], []));
    Assert.isTrue(coordinator.answer(requestIds[0], ["Notes couldn't save"]));
    Assert.isFalse(coordinator.answer(requestIds[0], []));
    Assert.areEqual("Notes couldn't save", (await first).join("|"));
    Assert.areEqual(0, (await second).length);
  }

  @TestMethod
  public async ignoresAnswersThatDoNotMatchARequest(): Promise<void> {
    const requestIds: string[] = [];
    const coordinator = new UpdateSaveCoordinator(t => requestIds.push(t) > 0, 60000);

    const problems = coordinator.requestAsync(1);

    Assert.isFalse(coordinator.answer("another", []));
    Assert.isFalse(coordinator.answer(42, []));
    Assert.isFalse(coordinator.answer(requestIds[0], "Notes couldn't save"));
    Assert.isFalse(coordinator.answer(requestIds[0], [42]));
    Assert.isTrue(coordinator.answer(requestIds[0], []));
    Assert.areEqual(0, (await problems).length);
  }

  @TestMethod
  public async countsAWindowThatIsGoneAsNotSaved(): Promise<void> {
    const gone = new UpdateSaveCoordinator(() => false, 60000);
    const released = new UpdateSaveCoordinator(() => true, 60000);

    const waiting = released.requestAsync(2);
    released.release();

    Assert.areEqual("Window 1 closed before it saved.", (await gone.requestAsync(1)).join("|"));
    Assert.areEqual("Window 2 closed before it saved.", (await waiting).join("|"));
  }

  @TestMethod
  public async countsAWindowThatDoesNotAnswerInTimeAsNotSaved(): Promise<void> {
    const coordinator = new UpdateSaveCoordinator(() => true, 1);

    Assert.areEqual("Window 1 did not finish saving within 5 seconds.", (await coordinator.requestAsync(1)).join("|"));
  }
}
