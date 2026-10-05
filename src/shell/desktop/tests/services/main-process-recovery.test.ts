/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setImmediate } from "node:timers/promises";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DiagnosticRedactor } from "@noldova/teamrun-shell-runtime";
import { MainProcessFailureKind, MainProcessRecovery } from "@noldova/teamrun-shell-desktop";

import { FakeApplicationHost } from "../fixtures/fake-application-host.fixture.js";
import { FakeDesktopLog } from "../fixtures/fake-desktop-log.fixture.js";
import { FakeDesktopProcess } from "../fixtures/fake-desktop-process.fixture.js";
import { FakeDialogHost } from "../fixtures/fake-dialog-host.fixture.js";

class Failed {
  public readonly app: FakeApplicationHost = new FakeApplicationHost(true, false);
  public readonly process: FakeDesktopProcess = new FakeDesktopProcess("linux");
  public readonly log: FakeDesktopLog = new FakeDesktopLog();
  public readonly dialog: FakeDialogHost;
  public readonly recovery: MainProcessRecovery;
  public logFolders: number = 0;

  public constructor(answers: readonly number[], isAttached: boolean = true) {
    this.dialog = new FakeDialogHost(answers);
    this.recovery = new MainProcessRecovery(this.app, this.dialog, this.process.errorOutput, new DiagnosticRedactor(this.process.homeFolder));
    if (isAttached)
      this.recovery.attach(this.log, () => {
        this.logFolders++;
        return Promise.resolve(true);
      });
  }

  public get boxes(): string[] {
    return this.dialog.boxes.map(t => `${t.windowId} ${t.options.type} ${t.options.message} | ${t.options.detail} | ${JSON.stringify(t.options.buttons)} ${t.options.defaultId} ${t.options.cancelId}`);
  }

  public async failReadyAsync(error: unknown, kind: MainProcessFailureKind = MainProcessFailureKind.UncaughtException): Promise<void> {
    this.recovery.receive(error, kind);
    await this.app.becomeReadyAsync();
    await setImmediate();
  }
}

@TestClass
export class MainProcessRecoveryTests {
  private static readonly BOX: string = "null warning TeamRun stopped because of an unexpected error. | Work running in the runtime continues. Changes from the last few seconds may not have been saved. "
    + "Restart TeamRun to go on, or open the log folder to see what happened. | [\"Restart TeamRun\",\"Open log folder\",\"Quit\"] 0 2";
  private static readonly EARLY_BOX: string = "null warning TeamRun stopped because of an unexpected error. | This happened while TeamRun was starting. Restart TeamRun to try again. "
    + "| [\"Restart TeamRun\",\"Quit\"] 0 1";

  @TestMethod
  public async recordsAFailureBeforeItHasALogToStandardErrorRedactedAndOffersOnlyRestartOrQuit(): Promise<void> {
    const failed = new Failed([0], false);

    failed.recovery.receive(new Error(`The data directory under ${failed.process.homeFolder}/data is not usable.`), MainProcessFailureKind.UncaughtException);
    await setImmediate();
    const beforeReady = failed.boxes.length;
    await failed.app.becomeReadyAsync();
    await setImmediate();

    const lines = failed.process.errors.split("\n").filter(t => /^\S+Z /.test(t)).map(t => t.slice(t.indexOf(" ") + 1));
    Assert.areEqual(0, beforeReady);
    Assert.areEqual(JSON.stringify([MainProcessRecoveryTests.EARLY_BOX]), JSON.stringify(failed.boxes));
    Assert.areEqual(JSON.stringify(["The desktop's main process failed with an uncaught exception: Error: The data directory under ~/data is not usable.", "The person chose Restart TeamRun."]),
      JSON.stringify(lines));
    Assert.isTrue(failed.process.errors.includes("\n    at "), "the record keeps the error's stack");
    Assert.areEqual(0, failed.log.lines.length);
    Assert.areEqual(JSON.stringify(["relaunch", "exit 0"]), JSON.stringify(failed.app.calls));
  }

  @TestMethod
  public async recordsAnUncaughtExceptionWithItsStackInTheLogAndRestartsWhenThePersonChoosesRestart(): Promise<void> {
    const failed = new Failed([0]);

    await failed.failReadyAsync(new Error("The pipe broke."));

    Assert.areEqual(JSON.stringify([MainProcessRecoveryTests.BOX]), JSON.stringify(failed.boxes));
    Assert.isTrue(failed.log.lines[0]?.startsWith("The desktop's main process failed with an uncaught exception: Error: The pipe broke.\n    at ") === true, failed.log.lines.join("\n"));
    Assert.areEqual("The person chose Restart TeamRun.", failed.log.lines[1]);
    Assert.areEqual("", failed.process.errors);
    Assert.areEqual(JSON.stringify(["relaunch", "exit 0"]), JSON.stringify(failed.app.calls));
  }

  @TestMethod
  public async recordsAnUnhandledRejectionAndExitsWithoutRestartingWhenThePersonQuits(): Promise<void> {
    const failed = new Failed([2]);

    await failed.failReadyAsync("not an error", MainProcessFailureKind.UnhandledRejection);

    Assert.areEqual(JSON.stringify(["The desktop's main process failed with an unhandled rejection: 'not an error'", "The person chose Quit."]), JSON.stringify(failed.log.lines));
    Assert.areEqual(JSON.stringify(["exit 0"]), JSON.stringify(failed.app.calls));
  }

  @TestMethod
  public async opensTheLogFolderAndAsksAgainUntilThePersonRestartsOrQuits(): Promise<void> {
    const failed = new Failed([1, 1, 2]);

    await failed.failReadyAsync(new Error("The pipe broke."));

    Assert.areEqual(3, failed.boxes.length);
    Assert.areEqual(2, failed.logFolders);
    Assert.areEqual(JSON.stringify(["The person chose Open log folder.", "The person chose Open log folder.", "The person chose Quit."]), JSON.stringify(failed.log.lines.slice(1)));
    Assert.areEqual(JSON.stringify(["exit 0"]), JSON.stringify(failed.app.calls));
  }

  @TestMethod
  public async quitsForAnAnswerThatNamesNoButton(): Promise<void> {
    const failed = new Failed([9]);

    await failed.failReadyAsync(new Error("The pipe broke."));

    Assert.areEqual("The person chose Quit.", failed.log.lines[1]);
    Assert.areEqual(JSON.stringify(["exit 0"]), JSON.stringify(failed.app.calls));
  }

  @TestMethod
  public async recordsALaterFailureWithoutAskingAgain(): Promise<void> {
    const failed = new Failed([]);

    await failed.failReadyAsync(new Error("The pipe broke."));
    failed.recovery.receive(new RangeError("The offset is out of range."), MainProcessFailureKind.UncaughtException);
    await setImmediate();

    Assert.areEqual(1, failed.boxes.length);
    Assert.isTrue(failed.log.lines[1]?.startsWith("The desktop's main process failed with an uncaught exception: RangeError: The offset is out of range.\n") === true, failed.log.lines.join("\n"));
    Assert.areEqual(JSON.stringify([]), JSON.stringify(failed.app.calls));
  }

  @TestMethod
  public async exitsWithAFailureWhenItCannotAsk(): Promise<void> {
    const failed = new Failed([]);
    failed.dialog.failure = new Error("No display.");

    await failed.failReadyAsync(new Error("The pipe broke."));

    Assert.isTrue(failed.log.lines[1]?.startsWith("The desktop could not ask what to do after its main process failed, so it quits: Error: No display.\n    at ") === true, failed.log.lines.join("\n"));
    Assert.areEqual(JSON.stringify(["exit 1"]), JSON.stringify(failed.app.calls));
  }
}
