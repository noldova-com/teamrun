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
  public async waitsUntilNoWorkIsLeftEvenWhenWorkBeginsWhileWaiting(): Promise<void> {
    const prompt = new FakeQuitPrompt();
    const coordinator = new QuitCoordinator(() => true, () => Promise.resolve(new WorkReport(["Indexing"], 1)), () => Promise.resolve());
    let isSettled = false;

    const waiting = coordinator.confirmAsync(prompt).then(t => {
      isSettled = true;
      return t;
    });
    await Condition.waitAsync(() => prompt.shown.length === 1);
    coordinator.answer(prompt, QuitChoice.Wait);
    coordinator.receive(new WorkReport(["Indexing", "Saving"], 2));
    coordinator.receive(new WorkReport([], 1));
    coordinator.receive(new WorkReport(["Saving"], 3));
    await Promise.resolve();
    const settledWhileWorking = isSettled;
    coordinator.receive(new WorkReport([], 4));

    Assert.isFalse(settledWhileWorking);
    Assert.areEqual(QuitOutcome.Quit, await waiting);
    Assert.areEqual("Indexing,Indexing waiting,Indexing+Saving waiting,Saving waiting,none", prompt.shown.join(","));
  }
}
