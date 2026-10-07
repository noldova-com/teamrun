/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { type IShipItProcess, SquirrelHandoff, StaleUpdateException, UpdateException, UpdateHandoffException, UpdateReadyRecord } from "@noldova/teamrun-shell-desktop";

import { Condition } from "../fixtures/condition.fixture.js";
import { FakeNativeUpdater } from "../fixtures/fake-native-updater.fixture.js";
import { FakeUpdater } from "../fixtures/fake-updater.fixture.js";

class FakeShipItProcess implements IShipItProcess {
  public processId: number | null = 5230;
  public removals: number = 0;
  public stoppedRemovals: number = 0;
  public find: () => Promise<number | null> = () => Promise.resolve(this.processId);
  public remove: () => Promise<void> = () => Promise.resolve();
  public removeStopped: () => Promise<void> = () => Promise.resolve();

  public findAsync(): Promise<number | null> {
    return this.find();
  }

  public removeAsync(): Promise<void> {
    this.removals++;
    return this.remove();
  }

  public removeStoppedAsync(): Promise<void> {
    this.stoppedRemovals++;
    return this.removeStopped();
  }
}

class SquirrelHandoffFixture {
  public static readonly CONTENT: string = "TeamRun 1.3.0 for macOS";

  public readonly updater: FakeUpdater;
  public readonly native: FakeNativeUpdater = new FakeNativeUpdater();
  public readonly timers: { delay: number; run: () => void; isCancelled: boolean }[] = [];
  public readonly shipIt: FakeShipItProcess = new FakeShipItProcess();
  public readonly lines: string[] = [];
  public readonly handoff: SquirrelHandoff;

  private constructor(folder: string) {
    this.updater = new FakeUpdater(join(folder, "pending", "TeamRun-macos-arm64.zip"));
    this.handoff = new SquirrelHandoff(this.updater, this.native, this.shipIt, (delay, run) => {
      const timer = { delay, run, isCancelled: false };
      this.timers.push(timer);
      return () => timer.isCancelled = true;
    }, t => this.lines.push(t));
  }

  public static async runAsync(run: (fixture: SquirrelHandoffFixture) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "teamrun-squirrel-handoff-"));
    try {
      const fixture = new SquirrelHandoffFixture(folder);
      await mkdir(dirname(fixture.updater.packagePath), { recursive: true });
      await writeFile(fixture.updater.packagePath, SquirrelHandoffFixture.CONTENT);
      await run(fixture);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  public record(sha512: string = createHash("sha512").update(SquirrelHandoffFixture.CONTENT).digest("base64")): UpdateReadyRecord {
    return new UpdateReadyRecord("1.3.0", this.updater.packagePath, sha512, true);
  }
}

@TestClass
export class SquirrelHandoffTests {
  @TestMethod
  public removesTheJobAFinishedInstallLeftAndLogsOneItCannotRemove(): Promise<void> {
    return SquirrelHandoffFixture.runAsync(async fixture => {
      await fixture.handoff.clearAsync();
      fixture.shipIt.removeStopped = () => Promise.reject(new UpdateHandoffException("The jobs could not be listed."));
      await fixture.handoff.clearAsync();

      Assert.areEqual(2, fixture.shipIt.stoppedRemovals);
      Assert.areEqual(0, fixture.shipIt.removals);
      Assert.areEqual(JSON.stringify(["The job of an installed update could not be removed, so it is tried again at the next start: UpdateHandoffException: The jobs could not be listed."]),
        JSON.stringify(fixture.lines));
    });
  }

  @TestMethod
  public stagesAnUpdateDownloadedInThisProcessAndGivesItsShipItProcess(): Promise<void> {
    return SquirrelHandoffFixture.runAsync(async fixture => {
      fixture.updater.downloadedFile = fixture.updater.packagePath;

      const processId = await fixture.handoff.handOffAsync(fixture.record());

      Assert.areEqual(5230, processId);
      Assert.isNull(fixture.handoff.refusal);
      Assert.areEqual(0, fixture.updater.checks);
      Assert.areEqual(1, fixture.native.checks);
      Assert.areEqual(0, fixture.native.count);
      Assert.areEqual(0, fixture.shipIt.removals);
      Assert.areEqual(JSON.stringify([[120_000, true]]), JSON.stringify(fixture.timers.map(t => [t.delay, t.isCancelled])));
    });
  }

  @TestMethod
  public downloadsAnUpdateRestoredFromItsRecordAgainBeforeStagingIt(): Promise<void> {
    return SquirrelHandoffFixture.runAsync(async fixture => {
      fixture.updater.check = () => Promise.resolve("1.3.0");
      fixture.updater.download = onProgress => {
        onProgress(100);
        return Promise.resolve(fixture.updater.packagePath);
      };

      const processId = await fixture.handoff.handOffAsync(fixture.record());

      Assert.areEqual(5230, processId);
      Assert.areEqual(1, fixture.updater.checks);
      Assert.areEqual(1, fixture.updater.downloads);
      Assert.areEqual(1, fixture.native.checks);
    });
  }

  @TestMethod
  public refusesAVersionTheFeedNoLongerOffersOrAZipThatChanged(): Promise<void> {
    return SquirrelHandoffFixture.runAsync(async fixture => {
      fixture.updater.check = () => Promise.resolve("1.4.0");
      const gone = await Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record()), StaleUpdateException);
      fixture.updater.check = () => Promise.reject(new UpdateException("TeamRun couldn't reach its update feed."));
      const unreachable = await Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record()), UpdateException);
      fixture.updater.downloadedFile = fixture.updater.packagePath;
      const changed = await Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record("b3RoZXI=")), StaleUpdateException);
      await rm(fixture.updater.packagePath);
      const missing = await Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record()), StaleUpdateException);

      Assert.areEqual("The update feed no longer offers version 1.3.0.", gone.message);
      Assert.areEqual("TeamRun couldn't reach its update feed.", unreachable.message);
      Assert.areEqual("The downloaded update has changed since it was checked, so it wasn't installed.", changed.message);
      Assert.areEqual(changed.message, missing.message);
      Assert.areEqual(0, fixture.updater.downloads);
      Assert.areEqual(0, fixture.native.checks);
      Assert.areEqual(0, fixture.shipIt.removals);
    });
  }

  @TestMethod
  public removesTheShipItJobWhenSquirrelFailsToStageTheUpdateOrHasNotWithinTwoMinutes(): Promise<void> {
    return SquirrelHandoffFixture.runAsync(async fixture => {
      fixture.updater.downloadedFile = fixture.updater.packagePath;
      const reported = new Error("Code signature at URL did not pass validation");
      fixture.native.onCheck = t => t.emit("error", reported);
      const failed = await Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record()), UpdateHandoffException);
      const thrown = new Error("Update check failed. The feed URL is not set.");
      fixture.native.onCheck = () => {
        throw thrown;
      };
      const refused = await Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record()), UpdateHandoffException);
      fixture.native.onCheck = () => undefined;
      const waiting = Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record()), UpdateHandoffException);
      await Condition.waitAsync(() => fixture.timers.length === 3);
      fixture.timers[2]?.run();
      const late = await waiting;
      const removedBeforeStage = fixture.shipIt.removals;
      fixture.native.emit("update-downloaded");
      fixture.native.emit("update-downloaded");

      Assert.areEqual("macOS couldn't prepare the update for installing.", failed.message);
      Assert.areEqual(reported, failed.cause);
      Assert.areEqual(thrown, refused.cause);
      Assert.areEqual("macOS didn't prepare the update for installing within 2 minutes.", late.message);
      Assert.areEqual(3, removedBeforeStage);
      Assert.areEqual(4, fixture.shipIt.removals);
      Assert.areEqual(0, fixture.native.count);
      Assert.areEqual(JSON.stringify([true, true, true]), JSON.stringify(fixture.timers.map(t => t.isCancelled)));
    });
  }

  @TestMethod
  public forgetsALateStageOnceTheNextHandoffStages(): Promise<void> {
    return SquirrelHandoffFixture.runAsync(async fixture => {
      fixture.updater.downloadedFile = fixture.updater.packagePath;
      fixture.native.onCheck = () => undefined;
      const waiting = Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record()), UpdateHandoffException);
      await Condition.waitAsync(() => fixture.timers.length === 1);
      fixture.timers[0]?.run();
      await waiting;
      fixture.native.onCheck = t => t.emit("update-downloaded");

      const processId = await fixture.handoff.handOffAsync(fixture.record());

      Assert.areEqual(5230, processId);
      Assert.areEqual(1, fixture.shipIt.removals);
      Assert.areEqual(0, fixture.native.count);
    });
  }

  @TestMethod
  public stillRemovesTheJobOfALateStageWhenTheNextHandoffFailsBeforeStaging(): Promise<void> {
    return SquirrelHandoffFixture.runAsync(async fixture => {
      fixture.updater.downloadedFile = fixture.updater.packagePath;
      fixture.native.onCheck = () => undefined;
      const waiting = Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record()), UpdateHandoffException);
      await Condition.waitAsync(() => fixture.timers.length === 1);
      fixture.timers[0]?.run();
      await waiting;
      await Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record("b3RoZXI=")), StaleUpdateException);
      const removedBeforeStage = fixture.shipIt.removals;

      fixture.native.emit("update-downloaded");

      Assert.areEqual(1, removedBeforeStage);
      Assert.areEqual(2, fixture.shipIt.removals);
      Assert.areEqual(0, fixture.native.count);
    });
  }

  @TestMethod
  public removesTheJobAndFailsWhenNoShipItProcessWaitsAfterTheStage(): Promise<void> {
    return SquirrelHandoffFixture.runAsync(async fixture => {
      fixture.updater.downloadedFile = fixture.updater.packagePath;
      fixture.shipIt.processId = null;

      const failed = await Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record()), UpdateHandoffException);

      Assert.areEqual("macOS prepared the update, but nothing is waiting to install it.", failed.message);
      Assert.areEqual(1, fixture.shipIt.removals);
    });
  }

  @TestMethod
  public removesTheShipItJobWhenItsProcessCannotBeFoundAndLogsAJobThatStays(): Promise<void> {
    return SquirrelHandoffFixture.runAsync(async fixture => {
      fixture.updater.downloadedFile = fixture.updater.packagePath;
      const lookup = new Error("launchctl exited with code 1");
      fixture.shipIt.find = () => Promise.reject(lookup);
      fixture.shipIt.remove = () => Promise.reject(new Error("Boot-out failed: 5: Input/output error"));

      const failed = await Assert.throwsAsync(() => fixture.handoff.handOffAsync(fixture.record()), Error);

      Assert.areEqual(lookup, failed);
      Assert.areEqual(1, fixture.shipIt.removals);
      Assert.areEqual(JSON.stringify(["A failed handoff left its update staged: Error: Boot-out failed: 5: Input/output error"]),
        JSON.stringify(fixture.lines));
    });
  }
}
