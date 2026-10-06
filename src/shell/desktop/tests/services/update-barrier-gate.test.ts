/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { UpdateProcess } from "@noldova/teamrun-shell-protocol";
import { type Installation, UpdateBarrier, UpdateBarrierState, UpdateBarrierStatus } from "@noldova/teamrun-shell-runtime";
import { UpdateBarrierGate } from "@noldova/teamrun-shell-desktop";

import { FakeDialogHost } from "../fixtures/fake-dialog-host.fixture.js";

@TestClass
export class UpdateBarrierGateTests {
  private readonly logged: string[] = [];
  private readonly checked: string[] = [];
  private found: UpdateBarrier | Error | null = null;
  private status: UpdateBarrierStatus | Error = UpdateBarrierStatus.None;
  private releaseCount: number = 0;

  @TestMethod
  public async letsTheDesktopStartWithoutAskingWhenNoBarrierHolds(): Promise<void> {
    const dialog = new FakeDialogHost();

    const passes = await this.create(dialog).passAsync();

    Assert.isTrue(passes);
    Assert.areEqual(JSON.stringify(["0.2.0"]), JSON.stringify(this.checked));
    Assert.areEqual(0, dialog.boxes.length);
    Assert.areEqual(0, this.logged.length);
  }

  @TestMethod
  public async tellsThePersonAnUpdateIsInstallingAndKeepsTheDesktopFromStarting(): Promise<void> {
    const dialog = new FakeDialogHost([0]);
    this.status = UpdateBarrierStatus.Held;

    const passes = await this.create(dialog).passAsync();

    Assert.isFalse(passes);
    Assert.areEqual(1, dialog.boxes.length);
    const box = dialog.boxes[0];
    Assert.isNull(box?.windowId ?? null);
    Assert.areEqual(JSON.stringify({
      type: "info", message: "TeamRun is installing an update.", detail: "Open TeamRun again once the update has finished.", buttons: ["OK"], defaultId: 0, cancelId: 0, noLink: true
    }), JSON.stringify(box?.options));
    Assert.areEqual(0, this.releaseCount);
  }

  @TestMethod
  public async keepsAnUnfinishedUpdatesBarrierWhenThePersonQuits(): Promise<void> {
    const dialog = new FakeDialogHost([0]);
    this.status = UpdateBarrierStatus.Unfinished;

    const passes = await this.create(dialog).passAsync();

    Assert.isFalse(passes);
    Assert.areEqual(JSON.stringify({
      type: "warning",
      message: "An update of TeamRun may still be installing, or it did not finish.",
      detail: "If no installer is still running, open TeamRun to go on with the version you have.",
      buttons: ["Quit", "Open TeamRun"],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    }), JSON.stringify(dialog.boxes[0]?.options));
    Assert.areEqual(0, this.releaseCount);
    Assert.areEqual(0, this.logged.length);
  }

  @TestMethod
  public async removesAnUnfinishedUpdatesBarrierWhenThePersonOpensTeamRun(): Promise<void> {
    const dialog = new FakeDialogHost([1]);

    const passes = await this.create(dialog).askAsync(UpdateBarrierStatus.Unfinished);

    Assert.isTrue(passes);
    Assert.areEqual(1, this.releaseCount);
    Assert.areEqual(JSON.stringify(["The person chose to open the application after an unfinished update, so its launch barrier was removed."]), JSON.stringify(this.logged));
  }

  @TestMethod
  public async logsABarrierAnUpdateLeftBeforeItsHandoff(): Promise<void> {
    this.found = UpdateBarrierGateTests.barrier(UpdateBarrierState.Closing);

    const passes = await this.create(new FakeDialogHost()).passAsync();

    Assert.isTrue(passes);
    Assert.areEqual(JSON.stringify(["An update stopped before its handoff, so its launch barrier was removed."]), JSON.stringify(this.logged));
  }

  @TestMethod
  public async logsNothingForAFinishedUpdateOrABarrierThatCouldNotBeParsed(): Promise<void> {
    this.found = UpdateBarrierGateTests.barrier(UpdateBarrierState.HandedOff);
    const finished = await this.create(new FakeDialogHost()).passAsync();
    this.found = new Error("The barrier is not JSON.");
    const unparsed = await this.create(new FakeDialogHost()).passAsync();

    Assert.isTrue(finished);
    Assert.isTrue(unparsed);
    Assert.areEqual(0, this.logged.length);
  }

  @TestMethod
  public async letsTheDesktopStartAndLogsWhenTheBarrierCannotBeRead(): Promise<void> {
    const dialog = new FakeDialogHost();
    this.status = new Error("EACCES: permission denied");

    const passes = await this.create(dialog).passAsync();

    Assert.isTrue(passes);
    Assert.areEqual(0, dialog.boxes.length);
    Assert.areEqual(JSON.stringify(["The launch barrier could not be read: Error: EACCES: permission denied"]), JSON.stringify(this.logged));
  }

  private static barrier(state: UpdateBarrierState): UpdateBarrier {
    return new UpdateBarrier(new UpdateProcess(4120, 1500, 1501, "desktop"), "0.3.0", state);
  }

  private create(dialog: FakeDialogHost): UpdateBarrierGate {
    const installation: Pick<Installation, "readAsync" | "checkAsync" | "releaseAsync"> = {
      readAsync: () => this.found instanceof Error ? Promise.reject(this.found) : Promise.resolve(this.found),
      checkAsync: version => {
        this.checked.push(version);
        return this.status instanceof Error ? Promise.reject(this.status) : Promise.resolve(this.status);
      },
      releaseAsync: () => {
        this.releaseCount++;
        return Promise.resolve();
      }
    };
    return new UpdateBarrierGate(installation, "0.2.0", dialog, t => this.logged.push(t));
  }
}
