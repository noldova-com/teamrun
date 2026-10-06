/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { WorkReport } from "@noldova/teamrun-shell-protocol";
import { QuitChoice, QuitCoordinator, QuitFlow } from "@noldova/teamrun-shell-desktop";

import { Condition } from "../fixtures/condition.fixture.js";
import { FakeQuitHost } from "../fixtures/fake-quit-host.fixture.js";
import { FakeQuitPrompt } from "../fixtures/fake-quit-prompt.fixture.js";

@TestClass
export class QuitFlowTests {
  @TestMethod
  public async closesAWindowThatIsNotTheLastOrOneTeamRunKeepsRunningWithoutAndQuitsForTheLastOtherwise(): Promise<void> {
    const host = new FakeQuitHost();
    const flow = QuitFlowTests.create(host, null);
    const prompt = new FakeQuitPrompt();

    host.isLastWindow = false;
    const notLast = await flow.canCloseAsync(prompt);
    host.isLastWindow = true;
    host.keepsRunning = true;
    const kept = await flow.canCloseAsync(prompt);
    host.keepsRunning = false;
    const last = await flow.canCloseAsync(prompt);

    Assert.areEqual("true,true,false", [notLast, kept, last].join(","));
    Assert.areEqual("quit", host.calls.join(","));
  }

  @TestMethod
  public async exitsWithoutAskingOnceTheWindowsHaveSavedWhenTheRuntimeStopsOrIsKept(): Promise<void> {
    const host = new FakeQuitHost();

    await QuitFlowTests.create(host, new WorkReport(["Indexing"], 1)).quitAsync();

    Assert.areEqual("save,stop IfIdle,exit", host.calls.join(","));
  }

  @TestMethod
  public async staysWithoutStoppingWhenAWindowCannotSave(): Promise<void> {
    const first = new FakeQuitHost();
    first.saves.push(false);
    const second = new FakeQuitHost();
    second.busy.push(true);
    second.saves.push(true, false);

    await QuitFlowTests.create(first, null).quitAsync();
    await QuitFlowTests.create(second, null).quitAsync();

    Assert.areEqual("save", first.calls.join(","));
    Assert.areEqual("save,stop IfIdle,prompt,save", second.calls.join(","));
  }

  @TestMethod
  public async asksWhileWorkRunsAndSavesAgainBeforeStoppingTheWorkOrStaysWhenCancelled(): Promise<void> {
    const prompt = new FakeQuitPrompt();
    const stopping = new FakeQuitHost();
    stopping.busy.push(true);
    stopping.prompt = prompt;
    const cancelling = new FakeQuitHost();
    cancelling.busy.push(true);
    cancelling.prompt = prompt;
    const asker = new QuitCoordinator(() => Promise.resolve(new WorkReport(["Indexing"], 1)));

    const stopped = new QuitFlow(stopping, asker).quitAsync();
    await Condition.waitAsync(() => prompt.shown.length === 1);
    asker.answer(prompt, QuitChoice.Stop);
    await stopped;
    const cancelled = new QuitFlow(cancelling, asker).quitAsync();
    await Condition.waitAsync(() => prompt.shown.length === 3);
    asker.answer(prompt, QuitChoice.Cancel);
    await cancelled;

    Assert.areEqual("save,stop IfIdle,prompt,save,stop StopWork,exit", stopping.calls.join(","));
    Assert.areEqual("save,stop IfIdle,prompt", cancelling.calls.join(","));
  }

  @TestMethod
  public async asksTheRuntimeToStopOnlyIfIdleAgainOnceTheWorkIsGoneOrNoWindowCanAsk(): Promise<void> {
    const ended = new FakeQuitHost();
    ended.busy.push(true, true);
    ended.prompt = new FakeQuitPrompt();
    const unasked = new FakeQuitHost();
    unasked.busy.push(true);
    unasked.prompt = null;

    await QuitFlowTests.create(ended, new WorkReport([], 2)).quitAsync();
    await QuitFlowTests.create(unasked, new WorkReport(["Indexing"], 1)).quitAsync();

    Assert.areEqual("save,stop IfIdle,prompt,save,stop IfIdle,exit", ended.calls.join(","));
    Assert.areEqual("save,stop IfIdle,prompt,save,stop IfIdle,exit", unasked.calls.join(","));
  }

  @TestMethod
  public async runsOneQuitAtATimeAndLetsAWindowClosingMeanwhileEndItsQuestion(): Promise<void> {
    const host = new FakeQuitHost();
    const prompt = new FakeQuitPrompt();
    const saving = Promise.withResolvers<void>();
    host.saving = saving.promise;
    host.busy.push(true);
    host.isLastWindow = false;
    host.prompt = prompt;
    const flow = QuitFlowTests.create(host, new WorkReport(["Indexing"], 1));

    const first = flow.quitAsync();
    const second = flow.quitAsync();
    const isSame = first === second;
    saving.resolve();
    await Condition.waitAsync(() => prompt.shown.length === 1);
    const closing = flow.canCloseAsync(prompt);
    await first;
    const canClose = await closing;
    await flow.quitAsync();

    Assert.isTrue(isSame);
    Assert.isTrue(canClose);
    Assert.areEqual("Indexing,none", prompt.shown.join(","));
    Assert.areEqual("save,stop IfIdle,prompt,save,stop IfIdle,exit", host.calls.join(","));
  }

  @TestMethod
  public async keepsAWindowOpenOnceTeamRunIsExiting(): Promise<void> {
    const host = new FakeQuitHost();
    host.hasExited = true;

    Assert.isFalse(await QuitFlowTests.create(host, null).canCloseAsync(new FakeQuitPrompt()));
    Assert.areEqual(0, host.calls.length);
  }

  private static create(host: FakeQuitHost, work: WorkReport | null): QuitFlow {
    return new QuitFlow(host, new QuitCoordinator(() => Promise.resolve(work)));
  }
}
