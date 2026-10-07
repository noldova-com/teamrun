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
import { join } from "node:path";

import type { JsonObject } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { UpdateException, UpdateController, type UpdateStatus } from "@noldova/teamrun-shell-desktop";

import { Condition } from "../fixtures/condition.fixture.js";
import { FakeDeviceFileStore } from "../fixtures/fake-device-file-store.fixture.js";
import { FakeUpdateCheckLock } from "../fixtures/fake-update-check-lock.fixture.js";
import { FakeUpdater } from "../fixtures/fake-updater.fixture.js";

interface IScheduled {
  readonly delay: number;
  readonly run: () => void;
  isCancelled: boolean;
}

class UpdateControllerFixture {
  public static readonly CONTENT: string = "TeamRun 1.3.0";
  public static readonly HASH: string = createHash("sha512").update(UpdateControllerFixture.CONTENT).digest("base64");

  public readonly folder: string;
  public readonly updater: FakeUpdater;
  public readonly record: FakeDeviceFileStore = new FakeDeviceFileStore();
  public readonly lock: FakeUpdateCheckLock = new FakeUpdateCheckLock();
  public readonly published: UpdateStatus[] = [];
  public readonly posts: string[] = [];
  public readonly lines: string[] = [];
  public readonly scheduled: IScheduled[] = [];
  public post: (version: string) => Promise<boolean> = () => Promise.resolve(true);
  public time: number = 1_000;
  public readonly controller: UpdateController;

  private constructor(folder: string, mustMove: boolean) {
    this.folder = folder;
    this.updater = new FakeUpdater(join(folder, "pending", "TeamRun-linux-x64.AppImage"));
    this.controller = new UpdateController(this.updater, this.record, this.lock, "1.2.0", mustMove, t => this.published.push(t), t => {
      this.posts.push(t);
      return this.post(t);
    }, t => this.lines.push(t), () => this.time, (delay, run) => {
      const entry: IScheduled = { delay, run, isCancelled: false };
      this.scheduled.push(entry);
      return () => entry.isCancelled = true;
    });
  }

  public static async runAsync(run: (fixture: UpdateControllerFixture) => Promise<void>, mustMove: boolean = false, isDownloaded: boolean = true): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "teamrun-update-controller-"));
    try {
      const fixture = new UpdateControllerFixture(folder, mustMove);
      if (isDownloaded) {
        await mkdir(join(folder, "pending"));
        await writeFile(fixture.updater.packagePath, UpdateControllerFixture.CONTENT);
      }
      await run(fixture);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  public get kinds(): string[] {
    return this.published.map(t => t.kind);
  }

  public get pending(): IScheduled[] {
    return this.scheduled.filter(t => !t.isCancelled);
  }

  public get ready(): JsonObject {
    return { version: "1.3.0", file: this.updater.packagePath, sha512: UpdateControllerFixture.HASH, notified: false };
  }

  public fire(): void {
    const entry = this.pending.at(-1);
    Assert.isDefined(entry);
    entry.isCancelled = true;
    this.time += entry.delay;
    entry.run();
  }

  public async publishedAsync(count: number): Promise<void> {
    await Condition.waitAsync(() => this.published.length >= count);
    Assert.areEqual(count, this.published.length);
  }
}

@TestClass
export class UpdateControllerTests {
  @TestMethod
  public checksThirtySecondsAfterTheStartThenEveryHour(): Promise<void> {
    return UpdateControllerFixture.runAsync(async fixture => {
      await fixture.controller.startAsync();
      const first = fixture.pending.map(t => t.delay);
      fixture.time += 5_000;
      fixture.fire();
      await fixture.publishedAsync(2);
      const second = fixture.pending.map(t => t.delay);
      fixture.fire();
      await fixture.publishedAsync(4);
      await Condition.waitAsync(() => fixture.lock.releases === 2);

      Assert.areEqual("UpToDate", fixture.controller.status.kind);
      Assert.areEqual(JSON.stringify([30_000]), JSON.stringify(first));
      Assert.areEqual(JSON.stringify([3_600_000]), JSON.stringify(second));
      Assert.areEqual(2, fixture.updater.checks);
      Assert.areEqual(2, fixture.lock.acquires);
      Assert.areEqual(JSON.stringify(["Checking", "UpToDate", "Checking", "UpToDate"]), JSON.stringify(fixture.kinds));
      Assert.areEqual(fixture.time, fixture.controller.status.checkedAt);
      Assert.areEqual(1, fixture.record.reads);
    });
  }

  @TestMethod
  public downloadsWhatACheckFindsThenRecordsAndPostsItOnce(): Promise<void> {
    return UpdateControllerFixture.runAsync(async fixture => {
      fixture.updater.check = () => Promise.resolve("1.3.0");
      fixture.updater.download = onProgress => {
        onProgress(-3);
        onProgress(0);
        onProgress(40);
        onProgress(140);
        return Promise.resolve(fixture.updater.packagePath);
      };
      await fixture.controller.startAsync();

      const started = fixture.controller.act("Check");
      await Condition.waitAsync(() => fixture.record.writes.length === 2 && fixture.lock.releases === 1);
      await fixture.controller.notifyAsync();

      Assert.isTrue(started);
      Assert.areEqual(JSON.stringify(["Checking", "Downloading", "Downloading", "Downloading", "Downloading", "Ready"]), JSON.stringify(fixture.kinds));
      Assert.areEqual(JSON.stringify([null, null, 0, 40, 100, null]), JSON.stringify(fixture.published.map(t => t.progress)));
      Assert.areEqual(JSON.stringify({ kind: "Ready", version: "1.3.0", progress: null, checkedAt: 1_000, reason: null, mustMove: false }), JSON.stringify(fixture.controller.status.toJson()));
      Assert.areEqual(JSON.stringify(["1.3.0"]), JSON.stringify(fixture.posts));
      Assert.areEqual(JSON.stringify([fixture.ready, { ...fixture.ready, notified: true }]), JSON.stringify(fixture.record.writes));
    });
  }

  @TestMethod
  public onlyShowsANewerVersionAsAvailableWhenTeamRunMustMove(): Promise<void> {
    return UpdateControllerFixture.runAsync(async fixture => {
      fixture.updater.check = () => Promise.resolve("1.3.0");
      await fixture.controller.startAsync();

      fixture.controller.act("Check");
      await fixture.publishedAsync(2);
      const again = fixture.controller.act("Check");
      await fixture.publishedAsync(4);

      Assert.isTrue(again);
      Assert.areEqual(JSON.stringify({ kind: "Available", version: "1.3.0", progress: null, checkedAt: 1_000, reason: null, mustMove: true }), JSON.stringify(fixture.controller.status.toJson()));
      Assert.areEqual(0, fixture.updater.downloads);
    }, true);
  }

  @TestMethod
  public refusesActionsOtherThanACheckAndChecksWhileBusyOrStopped(): Promise<void> {
    return UpdateControllerFixture.runAsync(async fixture => {
      const check = Promise.withResolvers<string | null>();
      fixture.updater.check = () => check.promise;
      await fixture.controller.startAsync();

      const restart = fixture.controller.act("Restart");
      const first = fixture.controller.act("Check");
      const whileChecking = fixture.controller.act("Check");
      check.resolve(null);
      await fixture.publishedAsync(2);
      fixture.controller.stop();
      const stopped = fixture.controller.act("Check");

      Assert.isFalse(restart);
      Assert.isTrue(first);
      Assert.isFalse(whileChecking);
      Assert.isFalse(stopped);
      Assert.areEqual(1, fixture.updater.checks);
      Assert.areEqual(1, fixture.updater.cancels);
      Assert.areEqual(0, fixture.pending.length);
    });
  }

  @TestMethod
  public showsTheReasonOfARequestedCheckThatFailsAndKeepsTheStateOfAnAutomaticOne(): Promise<void> {
    return UpdateControllerFixture.runAsync(async fixture => {
      await fixture.controller.startAsync();
      fixture.fire();
      await fixture.publishedAsync(2);
      fixture.updater.check = () => Promise.reject(new UpdateException("TeamRun couldn't reach its update feed."));

      fixture.fire();
      await fixture.publishedAsync(4);
      const automatic = fixture.controller.status.toJson();
      fixture.updater.check = () => Promise.reject(new Error("unexpected"));
      fixture.controller.act("Check");
      await fixture.publishedAsync(6);

      Assert.areEqual(JSON.stringify({ kind: "UpToDate", version: null, progress: null, checkedAt: 31_000, reason: "TeamRun couldn't reach its update feed.", mustMove: false }), JSON.stringify(automatic));
      Assert.areEqual(JSON.stringify({ kind: "Failed", version: null, progress: null, checkedAt: 31_000, reason: "The update stopped on an unexpected error.", mustMove: true }),
        JSON.stringify(fixture.controller.status.toJson()));
      Assert.areEqual(JSON.stringify(["The update failed: UpdateException: TeamRun couldn't reach its update feed.", "The update failed: Error: unexpected"]), JSON.stringify(fixture.lines));
    }, true);
  }

  @TestMethod
  public skipsACheckWhileAnotherDesktopOfTheInstallationChecks(): Promise<void> {
    return UpdateControllerFixture.runAsync(async fixture => {
      await fixture.controller.startAsync();
      fixture.fire();
      await fixture.publishedAsync(2);
      const before = fixture.controller.status;
      fixture.lock.acquire = () => Promise.resolve(false);

      fixture.fire();
      await fixture.publishedAsync(4);
      const automatic = fixture.controller.status;
      fixture.controller.act("Check");
      await fixture.publishedAsync(6);

      Assert.areEqual(before, automatic);
      Assert.areEqual(JSON.stringify({ kind: "Failed", version: null, progress: null, checkedAt: 31_000, reason: "Another TeamRun is checking for updates.", mustMove: false }),
        JSON.stringify(fixture.controller.status.toJson()));
      Assert.areEqual(1, fixture.updater.checks);
      Assert.areEqual(1, fixture.lock.releases);
    });
  }

  @TestMethod
  public failsACheckWhoseLockFailsAndLogsALockItCannotRelease(): Promise<void> {
    return UpdateControllerFixture.runAsync(async fixture => {
      await fixture.controller.startAsync();
      fixture.lock.acquire = () => Promise.reject(new UpdateException("The desktop could not identify its own process, so it cannot check for updates."));

      fixture.controller.act("Check");
      await fixture.publishedAsync(2);
      const failed = fixture.controller.status.reason;
      fixture.lock.acquire = () => Promise.resolve(true);
      fixture.lock.release = () => Promise.reject(new Error("EBUSY"));
      fixture.controller.act("Check");
      await Condition.waitAsync(() => fixture.lines.length === 2);

      Assert.areEqual("The desktop could not identify its own process, so it cannot check for updates.", failed);
      Assert.areEqual("UpToDate", fixture.controller.status.kind);
      Assert.areEqual("The update check could not let go of its lock: Error: EBUSY", fixture.lines[1]);
    });
  }

  @TestMethod
  public downloadsNothingForACheckThatEndsOnceStopped(): Promise<void> {
    return UpdateControllerFixture.runAsync(async fixture => {
      const check = Promise.withResolvers<string | null>();
      fixture.updater.check = () => check.promise;
      await fixture.controller.startAsync();

      fixture.controller.act("Check");
      fixture.controller.stop();
      check.resolve("1.3.0");
      await Condition.waitAsync(() => fixture.lock.releases === 1);

      Assert.areEqual(0, fixture.updater.downloads);
      Assert.areEqual(JSON.stringify(["Checking"]), JSON.stringify(fixture.kinds));
      Assert.areEqual(1, fixture.updater.cancels);
    });
  }

  @TestMethod
  public async keepsNothingFromADownloadThatEndsOnceStopped(): Promise<void> {
    for (const isFinished of [true, false])
      await UpdateControllerFixture.runAsync(async fixture => {
        const download = Promise.withResolvers<string>();
        fixture.updater.check = () => Promise.resolve("1.3.0");
        fixture.updater.download = () => download.promise;
        await fixture.controller.startAsync();

        fixture.controller.act("Check");
        await fixture.publishedAsync(2);
        fixture.controller.stop();
        if (isFinished)
          download.resolve(fixture.updater.packagePath);
        else
          download.reject(new UpdateException("The download was interrupted."));
        await Condition.waitAsync(() => fixture.lock.releases === 1);

        Assert.areEqual(JSON.stringify(["Checking", "Downloading"]), JSON.stringify(fixture.kinds));
        Assert.areEqual(0, fixture.record.writes.length);
        Assert.areEqual(0, fixture.posts.length);
        Assert.areEqual(0, fixture.lines.length);
      });
  }

  @TestMethod
  public failsADownloadThatBreaksOrCannotBeHashed(): Promise<void> {
    return UpdateControllerFixture.runAsync(async fixture => {
      fixture.updater.check = () => Promise.resolve("1.3.0");
      fixture.updater.download = () => Promise.reject(new UpdateException("The download doesn't match the release."));
      await fixture.controller.startAsync();

      fixture.controller.act("Check");
      await fixture.publishedAsync(3);
      const broken = fixture.controller.status.toJson();
      fixture.updater.download = () => Promise.resolve(join(fixture.folder, "gone.AppImage"));
      fixture.controller.act("Check");
      await fixture.publishedAsync(6);

      Assert.areEqual(JSON.stringify({ kind: "Failed", version: null, progress: null, checkedAt: 1_000, reason: "The download doesn't match the release.", mustMove: false }), JSON.stringify(broken));
      Assert.areEqual("The update stopped on an unexpected error.", fixture.controller.status.reason);
      Assert.areEqual(0, fixture.record.writes.length);
      Assert.areEqual(0, fixture.posts.length);
    });
  }

  @TestMethod
  public staysReadyWhenTheRecordCannotBeWrittenAndLogsIt(): Promise<void> {
    return UpdateControllerFixture.runAsync(async fixture => {
      fixture.updater.check = () => Promise.resolve("1.3.0");
      fixture.record.writeFailure = new Error("EACCES");
      await fixture.controller.startAsync();

      fixture.controller.act("Check");
      await Condition.waitAsync(() => fixture.lines.length === 2);

      Assert.areEqual("Ready", fixture.controller.status.kind);
      Assert.areEqual(JSON.stringify(["1.3.0"]), JSON.stringify(fixture.posts));
      Assert.areEqual(JSON.stringify([
        "The ready update could not be recorded, so it downloads again after a restart: Error: EACCES",
        "The ready update's notification could not be posted or recorded: Error: EACCES"
      ]), JSON.stringify(fixture.lines));
    });
  }

  @TestMethod
  public showsAReadyRecordAtTheStartWithoutTheNetworkAndPostsItUntilTheRuntimeTakesIt(): Promise<void> {
    return UpdateControllerFixture.runAsync(async fixture => {
      fixture.record.kept = { ...fixture.ready, version: "1.10.0" };
      fixture.post = () => Promise.resolve(false);

      await fixture.controller.startAsync();
      await fixture.controller.notifyAsync();
      const refused = fixture.record.writes.length;
      fixture.post = () => Promise.resolve(true);
      await fixture.controller.notifyAsync();
      await fixture.controller.notifyAsync();
      fixture.fire();

      Assert.areEqual(JSON.stringify({ kind: "Ready", version: "1.10.0", progress: null, checkedAt: null, reason: null, mustMove: false }), JSON.stringify(fixture.controller.status.toJson()));
      Assert.areEqual(0, refused);
      Assert.areEqual(JSON.stringify(["1.10.0", "1.10.0"]), JSON.stringify(fixture.posts));
      Assert.areEqual(JSON.stringify([{ ...fixture.ready, version: "1.10.0", notified: true }]), JSON.stringify(fixture.record.writes));
      Assert.areEqual(0, fixture.updater.checks);
      Assert.areEqual(1, fixture.pending.length);
    });
  }

  @TestMethod
  public postsAgainWhenAskedDuringAPostThatFails(): Promise<void> {
    return UpdateControllerFixture.runAsync(async fixture => {
      const first = Promise.withResolvers<boolean>();
      fixture.record.kept = fixture.ready;
      fixture.post = () => first.promise;
      await fixture.controller.startAsync();

      const posting = fixture.controller.notifyAsync();
      await Condition.waitAsync(() => fixture.posts.length === 1);
      const during = fixture.controller.notifyAsync();
      const again = fixture.controller.notifyAsync();
      fixture.post = () => Promise.resolve(true);
      first.resolve(false);
      await Promise.all([posting, during, again]);

      Assert.areEqual(JSON.stringify(["1.3.0", "1.3.0"]), JSON.stringify(fixture.posts));
      Assert.areEqual(JSON.stringify([{ ...fixture.ready, notified: true }]), JSON.stringify(fixture.record.writes));
    });
  }

  @TestMethod
  public postsNothingThatAnotherDesktopHasPosted(): Promise<void> {
    return UpdateControllerFixture.runAsync(async fixture => {
      fixture.record.kept = fixture.ready;
      await fixture.controller.startAsync();
      fixture.record.kept = { ...fixture.ready, notified: true };

      await fixture.controller.notifyAsync();
      await fixture.controller.notifyAsync();

      Assert.areEqual(0, fixture.posts.length);
      Assert.areEqual(2, fixture.record.reads);
      Assert.areEqual("Ready", fixture.controller.status.kind);
    });
  }

  @TestMethod
  public postsARecordThatAnotherDesktopReplacedOrRemoved(): Promise<void> {
    return UpdateControllerFixture.runAsync(async fixture => {
      fixture.record.kept = fixture.ready;
      fixture.post = () => Promise.resolve(false);
      await fixture.controller.startAsync();
      fixture.record.kept = { ...fixture.ready, version: "1.4.0", notified: true };

      await fixture.controller.notifyAsync();
      fixture.record.kept = null;
      await fixture.controller.notifyAsync();

      Assert.areEqual(JSON.stringify(["1.3.0", "1.3.0"]), JSON.stringify(fixture.posts));
    });
  }

  @TestMethod
  public logsAPostThatFails(): Promise<void> {
    return UpdateControllerFixture.runAsync(async fixture => {
      fixture.record.kept = fixture.ready;
      fixture.post = () => Promise.reject(new Error("closed"));

      await fixture.controller.startAsync();
      await fixture.controller.notifyAsync();

      Assert.areEqual(JSON.stringify(["The ready update's notification could not be posted or recorded: Error: closed"]), JSON.stringify(fixture.lines));
    });
  }

  @TestMethod
  public postsNothingWithoutAReadyUpdateOrForOneAlreadyPosted(): Promise<void> {
    return UpdateControllerFixture.runAsync(async fixture => {
      await fixture.controller.notifyAsync();
      fixture.record.kept = { ...fixture.ready, notified: true };

      await fixture.controller.startAsync();
      await fixture.controller.notifyAsync();

      Assert.areEqual("Ready", fixture.controller.status.kind);
      Assert.areEqual(0, fixture.posts.length);
    });
  }

  @TestMethod
  public postsNothingOnceStopped(): Promise<void> {
    return UpdateControllerFixture.runAsync(async fixture => {
      fixture.record.kept = fixture.ready;
      await fixture.controller.startAsync();

      fixture.controller.stop();
      await fixture.controller.notifyAsync();

      Assert.areEqual("Ready", fixture.controller.status.kind);
      Assert.areEqual(0, fixture.posts.length);
    });
  }

  @TestMethod
  public async removesARecordThatIsInstalledChangedElsewhereOrUnreadable(): Promise<void> {
    const lines: string[] = [];
    const cases: [(fixture: UpdateControllerFixture) => JsonObject, boolean][] = [
      [t => ({ ...t.ready, version: "1.2.0" }), true],
      [t => ({ ...t.ready, version: "1.1.9" }), true],
      [t => ({ ...t.ready, sha512: "b3RoZXI=" }), true],
      [t => t.ready, false],
      [t => ({ ...t.ready, file: join(t.folder, "TeamRun-linux-x64.AppImage") }), true],
      [() => ({ version: "1.3.0" }), true]
    ];

    for (const [create, isDownloaded] of cases)
      await UpdateControllerFixture.runAsync(async fixture => {
        fixture.record.kept = create(fixture);
        await fixture.controller.startAsync();
        Assert.areEqual("UpToDate", fixture.controller.status.kind);
        Assert.areEqual(1, fixture.record.deletes);
        lines.push(...fixture.lines);
      }, false, isDownloaded);

    Assert.areEqual("The ready update's record was removed, since version 1.2.0 is no newer than the installed one.", lines[0]);
    Assert.areEqual("The ready update's record was removed, since version 1.1.9 is no newer than the installed one.", lines[1]);
    Assert.areEqual("The ready update's record was removed, since the downloaded file has changed or is gone.", lines[2]);
    Assert.areEqual("The ready update's record was removed, since the downloaded file has changed or is gone.", lines[3]);
    Assert.areEqual("The ready update's record was removed, since its file is not the package in the updater's cache.", lines[4]);
    Assert.isTrue(lines[5]?.startsWith("The ready update's record was removed, since JsonException:") === true);
    Assert.areEqual(6, lines.length);
  }

  @TestMethod
  public logsARecordItCannotRemove(): Promise<void> {
    return UpdateControllerFixture.runAsync(async fixture => {
      fixture.record.readFailure = new SyntaxError("Unexpected end of JSON input");
      fixture.record.deleteFailure = new Error("EPERM");

      await fixture.controller.startAsync();

      Assert.areEqual(JSON.stringify([
        "The ready update's record was removed, since SyntaxError: Unexpected end of JSON input.",
        "The ready update's record was removed, since Error: EPERM."
      ]), JSON.stringify(fixture.lines));
      Assert.areEqual(1, fixture.pending.length);
    });
  }

  @TestMethod
  public checksOnceAtTheStartOrOnlyOnRequestAsTheSettingSays(): Promise<void> {
    return UpdateControllerFixture.runAsync(async fixture => {
      fixture.controller.follow("AtStart");
      const beforeStart = fixture.scheduled.length;
      await fixture.controller.startAsync();
      fixture.fire();
      await fixture.publishedAsync(2);
      const afterFirst = fixture.pending.length;
      fixture.controller.follow("Automatic");
      const automatic = fixture.pending.map(t => t.delay);
      fixture.controller.follow("Automatic");
      fixture.controller.follow("OnRequest");
      const onRequest = fixture.pending.length;
      fixture.controller.follow(42);

      Assert.areEqual(0, beforeStart);
      Assert.areEqual(0, afterFirst);
      Assert.areEqual(JSON.stringify([3_600_000]), JSON.stringify(automatic));
      Assert.areEqual(0, onRequest);
      Assert.areEqual(JSON.stringify([3_600_000]), JSON.stringify(fixture.pending.map(t => t.delay)));
      Assert.areEqual(3, fixture.scheduled.length);
    });
  }

  @TestMethod
  public checksAtOnceWhenTheDueTimeHasPassed(): Promise<void> {
    return UpdateControllerFixture.runAsync(async fixture => {
      fixture.controller.follow("OnRequest");
      await fixture.controller.startAsync();
      fixture.time += 60_000;

      fixture.controller.follow("AtStart");

      Assert.areEqual(JSON.stringify([0]), JSON.stringify(fixture.pending.map(t => t.delay)));
    });
  }

  @TestMethod
  public skipsAnAutomaticCheckWhileBusyAndArmsTheNext(): Promise<void> {
    return UpdateControllerFixture.runAsync(async fixture => {
      const check = Promise.withResolvers<string | null>();
      fixture.updater.check = () => check.promise;
      await fixture.controller.startAsync();
      fixture.controller.act("Check");

      fixture.fire();
      check.resolve(null);
      await fixture.publishedAsync(2);

      Assert.areEqual(1, fixture.updater.checks);
      Assert.areEqual(JSON.stringify([3_600_000]), JSON.stringify(fixture.pending.map(t => t.delay)));
    });
  }

  @TestMethod
  public async hashesAFileInBase64(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "teamrun-update-hash-"));
    try {
      const file = join(folder, "TeamRun-linux-x64.AppImage");
      await writeFile(file, "TeamRun 1.3.0");

      Assert.areEqual(createHash("sha512").update("TeamRun 1.3.0").digest("base64"), await UpdateController.hashFileAsync(file));
      await Assert.throwsAsync(() => UpdateController.hashFileAsync(join(folder, "gone")), Error);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
