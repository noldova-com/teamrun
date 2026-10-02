/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setTimeout as delay } from "node:timers/promises";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { OpenWindow, WindowRecovery } from "@noldova/teamrun-shell-desktop";

import { FakeDesktopLog } from "../fixtures/fake-desktop-log.fixture.js";
import { FakeDesktopWindow } from "../fixtures/fake-desktop-window.fixture.js";
import { FakeDialogHost } from "../fixtures/fake-dialog-host.fixture.js";
import { FakeDisplayHost } from "../fixtures/fake-display-host.fixture.js";

class Recovered {
  public readonly window: FakeDesktopWindow = new FakeDesktopWindow({}, 7);
  public readonly log: FakeDesktopLog = new FakeDesktopLog();
  public readonly dialog: FakeDialogHost;
  public quits: number = 0;
  public logFolders: number = 0;

  public constructor(answers: readonly number[], reloadCrashLimit: number = 10_000) {
    this.dialog = new FakeDialogHost(answers);
    new WindowRecovery(new OpenWindow(this.window, new FakeDisplayHost(), this.log), this.dialog, this.log, () => this.quits++, () => {
      this.logFolders++;
      return Promise.resolve(true);
    }, reloadCrashLimit);
  }

  public get boxes(): string[] {
    return this.dialog.boxes.map(t => `${t.windowId} ${t.options.message} | ${t.options.detail} | ${JSON.stringify(t.options.buttons)} ${t.options.defaultId} ${t.options.cancelId}`);
  }

  public static async settleAsync(): Promise<void> {
    await delay(10);
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
    await delay(40);
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
