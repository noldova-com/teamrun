/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { WorkReport } from "@noldova/teamrun-shell-protocol";
import { QuitChoice, QuitCoordinator, QuitOutcome } from "@noldova/teamrun-shell-desktop";

import { Condition } from "../fixtures/condition.fixture.js";
import { FakeQuitPrompt } from "../fixtures/fake-quit-prompt.fixture.js";

@TestClass
export class QuitCoordinatorTests {
  @TestMethod
  public async quitsWithoutAskingWhenAnotherWindowStaysOpenTheWorkCannotBeReadOrNoneIsInProgress(): Promise<void> {
    const prompt = new FakeQuitPrompt();
    let reads = 0;
    const answers: (WorkReport | null)[] = [null, new WorkReport([], 3)];
    const other = new QuitCoordinator(() => false, () => Promise.resolve(new WorkReport(["Indexing"], 1)), () => Promise.resolve());
    const coordinator = new QuitCoordinator(() => true, () => Promise.resolve(answers[reads++] ?? null), () => Promise.resolve());

    const outcomes = [await other.confirmAsync(prompt), await coordinator.confirmAsync(prompt), await coordinator.confirmAsync(prompt)];

    Assert.areEqual([QuitOutcome.Quit, QuitOutcome.Quit, QuitOutcome.Quit].join(","), outcomes.join(","));
    Assert.areEqual(2, reads);
    Assert.areEqual(0, prompt.shown.length);
  }

  @TestMethod
  public async asksWithTheWorkAndTakesOnlyItsOwnWindowsKnownAnswers(): Promise<void> {
    const prompt = new FakeQuitPrompt();
    const stranger = new FakeQuitPrompt();
    const coordinator = QuitCoordinatorTests.create(new WorkReport(["Indexing the project"], 1));

    const stopping = coordinator.confirmAsync(prompt);
    await Condition.waitAsync(() => prompt.shown.length === 1);
    const second = await coordinator.confirmAsync(stranger);
    const taken = [coordinator.answer(stranger, QuitChoice.Stop), coordinator.answer(prompt, "Later"), coordinator.answer(prompt, QuitChoice.Stop)];
    const outcome = await stopping;
    const cancelling = coordinator.confirmAsync(prompt);
    await Condition.waitAsync(() => prompt.shown.length === 3);
    coordinator.answer(prompt, QuitChoice.Cancel);

    Assert.areEqual(QuitOutcome.Stay, second);
    Assert.areEqual("false,false,true", taken.join(","));
    Assert.areEqual(QuitOutcome.StopWork, outcome);
    Assert.areEqual(QuitOutcome.Stay, await cancelling);
    Assert.isFalse(coordinator.answer(prompt, QuitChoice.Wait));
    Assert.areEqual("Indexing the project,none,Indexing the project,none", prompt.shown.join(","));
    Assert.areEqual(0, stranger.shown.length);
  }

  @TestMethod
  public async keepsTheNewestReportWhenAnEventIsHandledBeforeTheAnswerThatPrecededIt(): Promise<void> {
    const ended = QuitCoordinatorTests.createRacing(new WorkReport(["Indexing"], 1), new WorkReport([], 2));
    const stale = QuitCoordinatorTests.createRacing(new WorkReport([], 2), new WorkReport(["Indexing"], 1));
    const began = QuitCoordinatorTests.createRacing(new WorkReport([], 1), new WorkReport(["Saving"], 2));
    const prompt = new FakeQuitPrompt();

    const outcomes = [await ended.confirmAsync(new FakeQuitPrompt()), await stale.confirmAsync(new FakeQuitPrompt())];
    const asking = began.confirmAsync(prompt);
    await Condition.waitAsync(() => prompt.shown.length === 1);
    began.receive(new WorkReport([], 3));

    Assert.areEqual([QuitOutcome.Quit, QuitOutcome.Quit].join(","), outcomes.join(","));
    Assert.areEqual(QuitOutcome.Quit, await asking);
    Assert.areEqual("Saving,none", prompt.shown.join(","));
  }

  @TestMethod
  public async quitsWhenTheWindowCanNoLongerShowTheQuestionOrTheRuntimeIsGone(): Promise<void> {
    const gone = new FakeQuitPrompt();
    gone.canShow = false;
    const prompt = new FakeQuitPrompt();
    let stops = 0;
    const coordinator = new QuitCoordinator(() => true, () => Promise.resolve(new WorkReport(["Indexing"], 1)), () => {
      stops++;
      return Promise.resolve();
    });

    coordinator.release();
    coordinator.receive(new WorkReport([], 5));
    const unshown = await coordinator.confirmAsync(gone);
    const asking = coordinator.confirmAsync(prompt);
    await Condition.waitAsync(() => prompt.shown.length === 1);
    coordinator.release();
    await coordinator.stopWorkAsync();

    Assert.areEqual(QuitOutcome.Quit, unshown);
    Assert.areEqual(QuitOutcome.Quit, await asking);
    Assert.areEqual("Indexing,none", gone.shown.join(","));
    Assert.areEqual("Indexing,none", prompt.shown.join(","));
    Assert.areEqual(1, stops);
  }

  private static create(report: WorkReport): QuitCoordinator {
    return new QuitCoordinator(() => true, () => Promise.resolve(report), () => Promise.resolve());
  }

  private static createRacing(answered: WorkReport, heard: WorkReport): QuitCoordinator {
    const coordinator: QuitCoordinator = new QuitCoordinator(() => true, () => {
      coordinator.receive(heard);
      coordinator.receive(new WorkReport(["Older"], 0));
      return Promise.resolve(answered);
    }, () => Promise.resolve());
    return coordinator;
  }
}
