/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setImmediate } from "node:timers/promises";

import type { MessageBoxOptions, MessageBoxReturnValue } from "electron";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { MainProcessRecovery } from "@noldova/teamrun-shell-desktop";

import { FakeApplicationHost } from "../fixtures/fake-application-host.fixture.js";
import { FakeDesktopLog } from "../fixtures/fake-desktop-log.fixture.js";
import { FakeDialogHost } from "../fixtures/fake-dialog-host.fixture.js";

class Failed {
  public readonly app: FakeApplicationHost = new FakeApplicationHost(true, false);
  public readonly log: FakeDesktopLog = new FakeDesktopLog();
  public readonly dialog: FakeDialogHost;
  public readonly recovery: MainProcessRecovery;
  public logFolders: number = 0;

  public constructor(answers: readonly number[]) {
    this.dialog = new FakeDialogHost(answers);
    this.recovery = new MainProcessRecovery(this.app, this.dialog, this.log, () => {
      this.logFolders++;
      return Promise.resolve(true);
    });
  }

  public get boxes(): string[] {
    return this.dialog.boxes.map(t => `${t.windowId} ${t.options.type} ${t.options.message} | ${t.options.detail} | ${JSON.stringify(t.options.buttons)} ${t.options.defaultId} ${t.options.cancelId}`);
  }

  public async failReadyAsync(error: unknown, origin: string): Promise<void> {
    this.recovery.receive(error, origin);
    await this.app.becomeReadyAsync();
    await Failed.settleAsync();
  }

  public static async settleAsync(): Promise<void> {
    await setImmediate();
  }
}

@TestClass
export class MainProcessRecoveryTests {
  private static readonly BOX: string = "null warning TeamRun stopped because of an unexpected error. | Work running in the runtime continues. Changes from the last few seconds may not have been saved. "
    + "Restart TeamRun to go on, or open the log folder to see what happened. | [\"Restart TeamRun\",\"Open log folder\",\"Quit\"] 0 2";

  @TestMethod
  public async recordsAnUncaughtExceptionWithItsStackAndRestartsWhenThePersonChoosesRestart(): Promise<void> {
    const failed = new Failed([0]);

    failed.recovery.receive(new Error("The pipe broke."), "uncaughtException");
    await Failed.settleAsync();
    const beforeReady = failed.boxes.length;
    await failed.app.becomeReadyAsync();
    await Failed.settleAsync();

    Assert.areEqual(0, beforeReady);
    Assert.areEqual(JSON.stringify([MainProcessRecoveryTests.BOX]), JSON.stringify(failed.boxes));
    Assert.areEqual(true, failed.log.lines[0]?.startsWith("The desktop's main process failed with an uncaught exception: Error: The pipe broke.\n    at "));
    Assert.areEqual("The person chose Restart TeamRun.", failed.log.lines[1]);
    Assert.areEqual(JSON.stringify(["relaunch", "exit 1"]), JSON.stringify(failed.app.calls));
  }

  @TestMethod
  public async recordsAnUnhandledRejectionAndExitsWithoutRestartingWhenThePersonQuits(): Promise<void> {
    const failed = new Failed([2]);

    await failed.failReadyAsync("not an error", "unhandledRejection");

    Assert.areEqual(JSON.stringify(["The desktop's main process failed with an unhandled rejection: 'not an error'", "The person chose Quit."]), JSON.stringify(failed.log.lines));
    Assert.areEqual(JSON.stringify(["exit 1"]), JSON.stringify(failed.app.calls));
  }

  @TestMethod
  public async opensTheLogFolderAndAsksAgainUntilThePersonRestartsOrQuits(): Promise<void> {
    const failed = new Failed([1, 1, 2]);

    await failed.failReadyAsync(new Error("The pipe broke."), "uncaughtException");

    Assert.areEqual(3, failed.boxes.length);
    Assert.areEqual(2, failed.logFolders);
    Assert.areEqual(JSON.stringify(["The person chose Open log folder.", "The person chose Open log folder.", "The person chose Quit."]), JSON.stringify(failed.log.lines.slice(1)));
    Assert.areEqual(JSON.stringify(["exit 1"]), JSON.stringify(failed.app.calls));
  }

  @TestMethod
  public async quitsForAnAnswerThatNamesNoButton(): Promise<void> {
    const failed = new Failed([9]);

    await failed.failReadyAsync(new Error("The pipe broke."), "uncaughtException");

    Assert.areEqual("The person chose Quit.", failed.log.lines[1]);
    Assert.areEqual(JSON.stringify(["exit 1"]), JSON.stringify(failed.app.calls));
  }

  @TestMethod
  public async recordsALaterFailureWithoutAskingAgain(): Promise<void> {
    const failed = new Failed([]);

    await failed.failReadyAsync(new Error("The pipe broke."), "uncaughtException");
    failed.recovery.receive(new RangeError("The offset is out of range."), "uncaughtException");
    await Failed.settleAsync();

    Assert.areEqual(1, failed.boxes.length);
    Assert.areEqual(true, failed.log.lines[1]?.startsWith("The desktop's main process failed with an uncaught exception: RangeError: The offset is out of range.\n"));
    Assert.areEqual(JSON.stringify([]), JSON.stringify(failed.app.calls));
  }

  @TestMethod
  public async exitsWhenItCannotAsk(): Promise<void> {
    const app = new FakeApplicationHost(true, false);
    const log = new FakeDesktopLog();
    const dialog = { showMessageBox: (_windowId: number | null, _options: MessageBoxOptions): Promise<MessageBoxReturnValue> => Promise.reject(new Error("No display.")) };
    const recovery = new MainProcessRecovery(app, dialog, log, () => Promise.resolve(true));

    recovery.receive(new Error("The pipe broke."), "uncaughtException");
    await app.becomeReadyAsync();
    await Failed.settleAsync();

    Assert.areEqual(true, log.lines[1]?.startsWith("The desktop could not ask what to do after its main process failed, so it quits: Error: No display.\n    at "));
    Assert.areEqual(JSON.stringify(["exit 1"]), JSON.stringify(app.calls));
  }
}
