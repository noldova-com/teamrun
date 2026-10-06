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
  private readonly statuses: (UpdateBarrierStatus | Error)[] = [];
  private readonly texts: (string | null)[] = [];
  private readonly removals: (boolean | Error)[] = [];
  private readonly removed: string[] = [];
  private status: UpdateBarrierStatus | Error = UpdateBarrierStatus.None;

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
    Assert.areEqual(0, this.removed.length);
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
    Assert.areEqual(0, this.removed.length);
    Assert.areEqual(0, this.logged.length);
  }

  @TestMethod
  public async removesTheUnfinishedUpdatesBarrierItJudgedAgainWhenThePersonOpensTeamRun(): Promise<void> {
    const dialog = new FakeDialogHost([1]);
    this.texts.push("{\"judged\":1}");
    this.statuses.push(UpdateBarrierStatus.Unfinished);
    this.removals.push(true);

    const passes = await this.create(dialog).askAsync(UpdateBarrierStatus.Unfinished);

    Assert.isTrue(passes);
    Assert.areEqual(JSON.stringify(["{\"judged\":1}"]), JSON.stringify(this.removed));
    Assert.areEqual(JSON.stringify(["0.2.0"]), JSON.stringify(this.checked));
    Assert.areEqual(JSON.stringify(["The person chose to open the application after an unfinished update, so its launch barrier was removed."]), JSON.stringify(this.logged));
  }

  @TestMethod
  public async opensTeamRunWhenTheBarrierWentWhileThePersonDecided(): Promise<void> {
    const dialog = new FakeDialogHost([1]);
    this.texts.push(null);

    const passes = await this.create(dialog).askAsync(UpdateBarrierStatus.Unfinished);

    Assert.isTrue(passes);
    Assert.areEqual(0, this.removed.length);
    Assert.areEqual(0, this.logged.length);
  }

  @TestMethod
  public async tellsThePersonAnUpdateIsInstallingWhenOneBeganWhileTheyDecided(): Promise<void> {
    const dialog = new FakeDialogHost([1, 0]);
    this.texts.push("{\"newer\":1}");
    this.statuses.push(UpdateBarrierStatus.Held);

    const passes = await this.create(dialog).askAsync(UpdateBarrierStatus.Unfinished);

    Assert.isFalse(passes);
    Assert.areEqual(0, this.removed.length);
    Assert.areEqual("TeamRun is installing an update.", dialog.boxes[1]?.options.message);
  }

  @TestMethod
  public async judgesAgainABarrierThatReplacedTheOneItWasAboutToRemove(): Promise<void> {
    const dialog = new FakeDialogHost([1]);
    this.texts.push("{\"judged\":1}", "{\"replaced\":1}");
    this.statuses.push(UpdateBarrierStatus.Unfinished, UpdateBarrierStatus.Unfinished);
    this.removals.push(false, true);

    const passes = await this.create(dialog).askAsync(UpdateBarrierStatus.Unfinished);

    Assert.isTrue(passes);
    Assert.areEqual(JSON.stringify(["{\"judged\":1}", "{\"replaced\":1}"]), JSON.stringify(this.removed));
    Assert.areEqual(1, dialog.boxes.length);
  }

  @TestMethod
  public async tellsThePersonAndQuitsWhenTheBarrierCannotBeRemoved(): Promise<void> {
    const dialog = new FakeDialogHost([1, 0]);
    this.texts.push("{\"judged\":1}");
    this.statuses.push(UpdateBarrierStatus.Unfinished);
    this.removals.push(new Error("EPERM: operation not permitted"));

    const passes = await this.create(dialog).askAsync(UpdateBarrierStatus.Unfinished);

    Assert.isFalse(passes);
    Assert.areEqual(JSON.stringify({
      type: "error",
      message: "TeamRun could not clear the unfinished update, so it will quit.",
      detail: "Open TeamRun again in a moment. If this keeps happening, its log has the reason.",
      buttons: ["Quit"],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    }), JSON.stringify(dialog.boxes[1]?.options));
    Assert.areEqual(JSON.stringify(["The launch barrier of an unfinished update could not be removed: Error: EPERM: operation not permitted"]), JSON.stringify(this.logged));
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
    return new UpdateBarrier(new UpdateProcess(4120, 1500, 1501, "desktop"), "0.3.0", state, null);
  }

  private create(dialog: FakeDialogHost): UpdateBarrierGate {
    const installation: Pick<Installation, "readAsync" | "readTextAsync" | "checkAsync" | "removeAsync"> = {
      readAsync: () => this.found instanceof Error ? Promise.reject(this.found) : Promise.resolve(this.found),
      readTextAsync: () => Promise.resolve(this.texts.shift() ?? null),
      checkAsync: version => {
        this.checked.push(version);
        const status = this.statuses.shift() ?? this.status;
        return status instanceof Error ? Promise.reject(status) : Promise.resolve(status);
      },
      removeAsync: text => {
        this.removed.push(text);
        const removal = this.removals.shift() ?? true;
        return removal instanceof Error ? Promise.reject(removal) : Promise.resolve(removal);
      }
    };
    return new UpdateBarrierGate(installation, "0.2.0", dialog, t => this.logged.push(t));
  }
}
