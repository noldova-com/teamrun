/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setImmediate } from "node:timers/promises";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { OpenWindow, WindowRecovery } from "@noldova/teamrun-shell-desktop";

import { Condition } from "../fixtures/condition.fixture.js";
import { FakeDesktopLog } from "../fixtures/fake-desktop-log.fixture.js";
import { FakeDesktopProcess } from "../fixtures/fake-desktop-process.fixture.js";
import { FakeDesktopWindow } from "../fixtures/fake-desktop-window.fixture.js";
import { FakeDialogHost } from "../fixtures/fake-dialog-host.fixture.js";
import { FakeDisplayHost } from "../fixtures/fake-display-host.fixture.js";

class Recovered {
  public readonly window: FakeDesktopWindow = new FakeDesktopWindow({}, 7);
  public readonly log: FakeDesktopLog = new FakeDesktopLog();
  public readonly dialog: FakeDialogHost;
  public readonly process: FakeDesktopProcess = new FakeDesktopProcess("linux");
  public quits: number = 0;
  public logFolders: number = 0;

  public constructor(answers: readonly number[], reloadCrashLimit: number = 10_000, rendererEndLimit: number = 1_000) {
    this.dialog = new FakeDialogHost(answers);
    new WindowRecovery(new OpenWindow(this.window, new FakeDisplayHost(), this.log), this.dialog, this.log, this.process, () => this.quits++, () => {
      this.logFolders++;
      return Promise.resolve(true);
    }, reloadCrashLimit, rendererEndLimit);
  }

  public get boxes(): string[] {
    return this.dialog.boxes.map(t => `${t.windowId} ${t.options.message} | ${t.options.detail} | ${JSON.stringify(t.options.buttons)} ${t.options.defaultId} ${t.options.cancelId}`);
  }

  public static async settleAsync(): Promise<void> {
    await setImmediate();
  }
}

@TestClass
export class WindowRecoveryTests {
  private static readonly STOPPED: string = "7 TeamRun's window stopped unexpectedly. | Reload it to continue. Your layout comes back from the last save. | [\"Reload\",\"Quit\"] 0 1";
  private static readonly STOPPED_AGAIN: string = "7 TeamRun's window stopped unexpectedly. | It stopped again right after it was reloaded. The log folder has what it recorded. | [\"Open log folder\",\"Quit\"] 0 1";
  private static readonly NOT_RESPONDING: string = "7 TeamRun's window isn't responding. | You can wait for it or reload it. | [\"Wait\",\"Reload\"] 0 0";

  @TestMethod
  public async showsAWindowWhosePageWentAndReloadsItWhenThePersonChoosesReload(): Promise<void> {
    const recovered = new Recovered([0]);

    recovered.window.webContents.goAway("crashed", 5);
    await Recovered.settleAsync();

    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(recovered.window.calls));
    Assert.areEqual(JSON.stringify(["reload"]), JSON.stringify(recovered.window.webContents.calls));
    Assert.areEqual(JSON.stringify([WindowRecoveryTests.STOPPED]), JSON.stringify(recovered.boxes));
    Assert.areEqual(JSON.stringify(["The window's page stopped: crashed, exit code 5.", "The person chose Reload."]), JSON.stringify(recovered.log.lines));
    Assert.areEqual(0, recovered.quits);
  }

  @TestMethod
  public async quitsWhenThePersonChoosesQuitOrTheBoxGivesNoKnownAnswer(): Promise<void> {
    const quit = new Recovered([1]);
    const unknown = new Recovered([7]);

    quit.window.webContents.goAway("oom", 1);
    unknown.window.webContents.goAway("killed", 9);
    await Recovered.settleAsync();

    Assert.areEqual(1, quit.quits);
    Assert.areEqual("The person chose Quit.", quit.log.lines[1]);
    Assert.areEqual(1, unknown.quits);
    Assert.areEqual(JSON.stringify(["The window's page stopped: killed, exit code 9."]), JSON.stringify(unknown.log.lines));
    Assert.areEqual("[]", JSON.stringify([...quit.window.webContents.calls, ...unknown.window.webContents.calls]));
  }

  @TestMethod
  public async offersTheLogFolderInsteadOfAnotherReloadWhenThePageGoesAgainSoonAfterAReload(): Promise<void> {
    const folder = new Recovered([0, 0]);
    const quit = new Recovered([0, 1]);

    for (const recovered of [folder, quit]) {
      recovered.window.webContents.goAway("crashed", 5);
      await Recovered.settleAsync();
      recovered.window.webContents.goAway("crashed", 5);
      await Recovered.settleAsync();
    }

    Assert.areEqual(JSON.stringify([WindowRecoveryTests.STOPPED, WindowRecoveryTests.STOPPED_AGAIN]), JSON.stringify(folder.boxes));
    Assert.areEqual(JSON.stringify(["reload"]), JSON.stringify(folder.window.webContents.calls));
    Assert.areEqual(1, folder.logFolders);
    Assert.areEqual(0, folder.quits);
    Assert.areEqual(JSON.stringify([
      "The window's page stopped: crashed, exit code 5.",
      "The person chose Reload.",
      "The window's page stopped: crashed, exit code 5.",
      "The window's page stopped again within 10 s of a reload, so the person was offered the log folder instead of another reload.",
      "The person chose Open log folder."
    ]), JSON.stringify(folder.log.lines));
    Assert.areEqual(1, quit.quits);
    Assert.areEqual(0, quit.logFolders);
  }

  @TestMethod
  public async offersReloadAgainWhenThePageGoesLongAfterAReload(): Promise<void> {
    const recovered = new Recovered([0, 0], 20);

    recovered.window.webContents.goAway("crashed", 5);
    await Recovered.settleAsync();
    const reloadSeenAt = Date.now();
    await Condition.waitAsync(() => Date.now() - reloadSeenAt > 20);
    recovered.window.webContents.goAway("crashed", 5);
    await Recovered.settleAsync();

    Assert.areEqual(JSON.stringify([WindowRecoveryTests.STOPPED, WindowRecoveryTests.STOPPED]), JSON.stringify(recovered.boxes));
    Assert.areEqual(JSON.stringify(["reload", "reload"]), JSON.stringify(recovered.window.webContents.calls));
  }

  @TestMethod
  public async ignoresACleanExitAndAPageOfAClosedWindow(): Promise<void> {
    const recovered = new Recovered([0]);

    recovered.window.webContents.goAway("clean-exit");
    recovered.window.destroy();
    recovered.window.webContents.goAway("crashed", 5);
    await Recovered.settleAsync();

    Assert.areEqual(0, recovered.dialog.boxes.length);
    Assert.areEqual(0, recovered.log.lines.length);
  }

  @TestMethod
  public async asksOncePerEpisodeWhileThePageDoesNotRespondAndClosesTheBoxWhenItRespondsAgain(): Promise<void> {
    const recovered = new Recovered([]);

    recovered.window.change("unresponsive");
    recovered.window.change("unresponsive");
    await Recovered.settleAsync();
    recovered.window.change("responsive");
    recovered.window.change("responsive");
    await Recovered.settleAsync();

    Assert.areEqual(JSON.stringify([WindowRecoveryTests.NOT_RESPONDING]), JSON.stringify(recovered.boxes));
    Assert.areEqual(JSON.stringify(["The window's page stopped responding.", "The window's page responds again."]), JSON.stringify(recovered.log.lines));
    Assert.areEqual("[]", JSON.stringify(recovered.window.webContents.calls));
  }

  @TestMethod
  public async waitsWhenThePersonChoosesWaitAndRecordsWhenThePageRespondsAgain(): Promise<void> {
    const recovered = new Recovered([0]);

    recovered.window.change("unresponsive");
    await Recovered.settleAsync();
    recovered.window.change("unresponsive");
    recovered.window.change("responsive");
    await Recovered.settleAsync();

    Assert.areEqual(1, recovered.dialog.boxes.length);
    Assert.areEqual(JSON.stringify(["The window's page stopped responding.", "The person chose Wait.", "The window's page responds again."]), JSON.stringify(recovered.log.lines));
    Assert.areEqual("[]", JSON.stringify(recovered.window.webContents.calls));
  }

  @TestMethod
  public async endsAnUnresponsivePageAndReloadsItWithoutAskingAgainWhenThePersonChoosesReload(): Promise<void> {
    const recovered = new Recovered([1]);

    recovered.window.change("unresponsive");
    await Recovered.settleAsync();
    recovered.window.webContents.goAway("killed", 1);
    await Recovered.settleAsync();
    recovered.window.change("unresponsive");
    await Recovered.settleAsync();

    Assert.areEqual(JSON.stringify(["crash", "reload"]), JSON.stringify(recovered.window.webContents.calls));
    Assert.areEqual(JSON.stringify([WindowRecoveryTests.NOT_RESPONDING, WindowRecoveryTests.NOT_RESPONDING]), JSON.stringify(recovered.boxes));
    Assert.areEqual(JSON.stringify([
      "The window's page stopped responding.",
      "The person chose Reload.",
      "The window's page stopped: killed, exit code 1.",
      "The window's page stopped responding."
    ]), JSON.stringify(recovered.log.lines));
  }

  @TestMethod
  public async endsThePageProcessThatDoesNotStopWhenAskedAndReloadsOnceItHasGone(): Promise<void> {
    const recovered = new Recovered([1], 10_000, 20);

    recovered.window.change("unresponsive");
    await Recovered.settleAsync();
    const callsBeforeItWent = [...recovered.window.webContents.calls];
    await Condition.waitAsync(() => recovered.process.ended.length === 1);
    recovered.window.webContents.goAway("killed", 9);
    await Recovered.settleAsync();

    Assert.areEqual(JSON.stringify(["crash"]), JSON.stringify(callsBeforeItWent));
    Assert.areEqual(JSON.stringify([4242]), JSON.stringify(recovered.process.ended));
    Assert.areEqual(JSON.stringify(["crash", "reload"]), JSON.stringify(recovered.window.webContents.calls));
    Assert.areEqual(JSON.stringify([
      "The window's page stopped responding.",
      "The person chose Reload.",
      "The window's page did not stop when asked, so the desktop ended its process 4242.",
      "The window's page stopped: killed, exit code 9."
    ]), JSON.stringify(recovered.log.lines));
  }

  @TestMethod
  public async recordsAPageProcessItCannotEndAndLeavesAClosedWindowsProcessAlone(): Promise<void> {
    const closed = new Recovered([1], 10_000, 20);
    const failing = new Recovered([1], 10_000, 20);
    failing.process.endFailure = new Error("No such process.");

    closed.window.change("unresponsive");
    failing.window.change("unresponsive");
    await Recovered.settleAsync();
    closed.window.destroy();
    await Condition.waitAsync(() => failing.window.webContents.calls.includes("reload"));

    Assert.areEqual("The window's page did not stop when asked, and its process could not be ended, so the desktop reloads it: Error: No such process.", failing.log.lines.at(-1));
    Assert.areEqual(JSON.stringify(["crash", "reload"]), JSON.stringify(failing.window.webContents.calls));
    Assert.areEqual(0, closed.process.ended.length);
    Assert.areEqual(JSON.stringify(["crash"]), JSON.stringify(closed.window.webContents.calls));
    Assert.areEqual(JSON.stringify(["The window's page stopped responding.", "The person chose Reload."]), JSON.stringify(closed.log.lines));
  }

  @TestMethod
  public async neverEndsProcessZeroOrTheDesktopItselfAndReloadsInstead(): Promise<void> {
    const none = new Recovered([1], 10_000, 20);
    none.window.webContents.osProcessId = 0;
    const own = new Recovered([1], 10_000, 20);
    own.window.webContents.osProcessId = own.process.processId;

    none.window.change("unresponsive");
    own.window.change("unresponsive");
    await Recovered.settleAsync();
    await Condition.waitAsync(() => none.window.webContents.calls.includes("reload") && own.window.webContents.calls.includes("reload"));
    none.window.webContents.goAway("crashed", 5);
    await Recovered.settleAsync();

    Assert.areEqual(0, none.process.ended.length + own.process.ended.length);
    Assert.areEqual("The window's page did not stop when asked and has no renderer process of its own to end (0), so the desktop reloads it.", none.log.lines[2]);
    Assert.areEqual("The window's page did not stop when asked and has no renderer process of its own to end (1000), so the desktop reloads it.", own.log.lines.at(-1));
    Assert.areEqual(JSON.stringify(["crash", "reload"]), JSON.stringify(none.window.webContents.calls));
    Assert.areEqual(JSON.stringify([WindowRecoveryTests.NOT_RESPONDING, WindowRecoveryTests.STOPPED_AGAIN]), JSON.stringify(none.boxes));
    Assert.areEqual(JSON.stringify(["crash", "reload"]), JSON.stringify(own.window.webContents.calls));
  }

  @TestMethod
  public async reloadsAPageAskedToStopEvenWhenItExitsCleanly(): Promise<void> {
    const recovered = new Recovered([1]);

    recovered.window.change("unresponsive");
    await Recovered.settleAsync();
    recovered.window.webContents.goAway("clean-exit");
    await Recovered.settleAsync();

    Assert.areEqual(JSON.stringify(["crash", "reload"]), JSON.stringify(recovered.window.webContents.calls));
    Assert.areEqual("The window's page stopped: clean-exit, exit code 0.", recovered.log.lines.at(-1));
    Assert.areEqual(0, recovered.process.ended.length);
  }

  @TestMethod
  public async closesTheUnresponsiveBoxWhenThePageGoesAndAsksAboutTheGonePage(): Promise<void> {
    const recovered = new Recovered([]);

    recovered.window.change("unresponsive");
    await Recovered.settleAsync();
    recovered.dialog.answers.push(0);
    recovered.window.webContents.goAway("crashed", 3);
    await Recovered.settleAsync();
    recovered.window.change("responsive");

    Assert.areEqual(JSON.stringify([WindowRecoveryTests.NOT_RESPONDING, WindowRecoveryTests.STOPPED]), JSON.stringify(recovered.boxes));
    Assert.areEqual(JSON.stringify(["reload"]), JSON.stringify(recovered.window.webContents.calls));
    Assert.areEqual(JSON.stringify(["The window's page stopped responding.", "The window's page stopped: crashed, exit code 3.", "The person chose Reload."]), JSON.stringify(recovered.log.lines));
  }
}
