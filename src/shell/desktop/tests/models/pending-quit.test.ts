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
export class PendingQuitTests {
  @TestMethod
  public async asksWithItsNewestWorkWaitingOnlyOnceChosenAndIsAnsweredWhenNoWorkIsLeft(): Promise<void> {
    const prompt = new FakeQuitPrompt();
    const coordinator = new QuitCoordinator(() => Promise.resolve(new WorkReport(["Indexing"], 1)));

    const asking = coordinator.askAsync(prompt);
    await Condition.waitAsync(() => prompt.shown.length === 1);
    coordinator.receive(new WorkReport(["Indexing", "Saving"], 2));
    coordinator.answer(prompt, QuitChoice.Wait);
    coordinator.receive(new WorkReport([], 3));

    Assert.areEqual(QuitOutcome.Quit, await asking);
    Assert.areEqual("Indexing,Indexing+Saving,Indexing+Saving waiting,none", prompt.shown.join(","));
  }
}
