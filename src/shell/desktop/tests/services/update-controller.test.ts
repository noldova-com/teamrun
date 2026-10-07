/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { UpdateException, UpdateController, type UpdateStatus } from "@noldova/teamrun-shell-desktop";

import { FakeDeviceFileStore } from "../fixtures/fake-device-file-store.fixture.js";
import { FakeUpdater } from "../fixtures/fake-updater.fixture.js";

interface IScheduled {
  readonly delay: number;
  readonly run: () => void;
  isCancelled: boolean;
}

class UpdateControllerFixture {
  public readonly updater: FakeUpdater = new FakeUpdater();
  public readonly record: FakeDeviceFileStore = new FakeDeviceFileStore();
  public readonly published: UpdateStatus[] = [];
  public readonly posts: string[] = [];
  public readonly lines: string[] = [];
  public readonly scheduled: IScheduled[] = [];
  public readonly hashes: Map<string, string> = new Map([[FakeUpdater.FILE, "c2hh"]]);
  public post: (version: string) => Promise<boolean> = () => Promise.resolve(true);
  public time: number = 1_000;
  public readonly controller: UpdateController;

  public constructor(mustMove: boolean = false) {
    this.controller = new UpdateController(this.updater, this.record, t => {
      const hash = this.hashes.get(t);
      return Object.isUndefined(hash) ? Promise.reject(new Error(`ENOENT: ${t}`)) : Promise.resolve(hash);
    }, "1.2.0", mustMove, t => this.published.push(t), t => {
      this.posts.push(t);
      return this.post(t);
    }, t => this.lines.push(t), () => this.time, (delay, run) => {
      const entry: IScheduled = { delay, run, isCancelled: false };
      this.scheduled.push(entry);
      return () => entry.isCancelled = true;
    });
  }

  public get kinds(): string[] {
    return this.published.map(t => t.kind);
  }

  public get pending(): IScheduled[] {
    return this.scheduled.filter(t => !t.isCancelled);
  }

  public async fireAsync(): Promise<void> {
    const entry = this.pending.at(-1);
    Assert.isDefined(entry);
    entry.isCancelled = true;
    this.time += entry.delay;
    entry.run();
    await UpdateControllerFixture.settleAsync();
  }

  public static async settleAsync(): Promise<void> {
    for (let index = 0; index < 5; index++)
      await setImmediate();
  }
}

@TestClass
export class UpdateControllerTests {
  @TestMethod
  public async checksThirtySecondsAfterTheStartThenEveryHour(): Promise<void> {
    const fixture = new UpdateControllerFixture();

    await fixture.controller.startAsync();
    const first = fixture.pending.map(t => t.delay);
    fixture.time += 5_000;
    await fixture.fireAsync();
    const second = fixture.pending.map(t => t.delay);
    await fixture.fireAsync();

    Assert.areEqual("UpToDate", fixture.controller.status.kind);
    Assert.areEqual(JSON.stringify([30_000]), JSON.stringify(first));
    Assert.areEqual(JSON.stringify([3_600_000]), JSON.stringify(second));
    Assert.areEqual(2, fixture.updater.checks);
    Assert.areEqual(JSON.stringify(["Checking", "UpToDate", "Checking", "UpToDate"]), JSON.stringify(fixture.kinds));
    Assert.areEqual(fixture.time, fixture.controller.status.checkedAt);
    Assert.areEqual(1, fixture.record.reads);
  }

  @TestMethod
  public async downloadsWhatACheckFindsThenRecordsAndPostsItOnce(): Promise<void> {
    const fixture = new UpdateControllerFixture();
    fixture.updater.check = () => Promise.resolve("1.3.0");
    fixture.updater.download = onProgress => {
      onProgress(-3);
      onProgress(0);
      onProgress(40);
      onProgress(140);
      return Promise.resolve(FakeUpdater.FILE);
    };
    await fixture.controller.startAsync();

    const started = fixture.controller.act("Check");
    await UpdateControllerFixture.settleAsync();
    await fixture.controller.notifyAsync();

    Assert.isTrue(started);
    Assert.areEqual(JSON.stringify(["Checking", "Downloading", "Downloading", "Downloading", "Downloading", "Ready"]), JSON.stringify(fixture.kinds));
    Assert.areEqual(JSON.stringify([null, null, 0, 40, 100, null]), JSON.stringify(fixture.published.map(t => t.progress)));
    Assert.areEqual(JSON.stringify({ kind: "Ready", version: "1.3.0", progress: null, checkedAt: 1_000, reason: null, mustMove: false }), JSON.stringify(fixture.controller.status.toJson()));
    Assert.areEqual(JSON.stringify(["1.3.0"]), JSON.stringify(fixture.posts));
    Assert.areEqual(JSON.stringify([
      { version: "1.3.0", file: FakeUpdater.FILE, sha512: "c2hh", notified: false },
      { version: "1.3.0", file: FakeUpdater.FILE, sha512: "c2hh", notified: true }
    ]), JSON.stringify(fixture.record.writes));
  }

  @TestMethod
  public async onlyShowsANewerVersionAsAvailableWhenTeamRunMustMove(): Promise<void> {
    const fixture = new UpdateControllerFixture(true);
    fixture.updater.check = () => Promise.resolve("1.3.0");
    await fixture.controller.startAsync();

    fixture.controller.act("Check");
    await UpdateControllerFixture.settleAsync();
    const again = fixture.controller.act("Check");
    await UpdateControllerFixture.settleAsync();

    Assert.isTrue(again);
    Assert.areEqual(JSON.stringify({ kind: "Available", version: "1.3.0", progress: null, checkedAt: 1_000, reason: null, mustMove: true }), JSON.stringify(fixture.controller.status.toJson()));
    Assert.areEqual(0, fixture.updater.downloads);
  }

  @TestMethod
  public async refusesActionsOtherThanACheckAndChecksWhileBusyOrStopped(): Promise<void> {
    const fixture = new UpdateControllerFixture();
    const check = Promise.withResolvers<string | null>();
    fixture.updater.check = () => check.promise;
    await fixture.controller.startAsync();

    const restart = fixture.controller.act("Restart");
    const first = fixture.controller.act("Check");
    const whileChecking = fixture.controller.act("Check");
    check.resolve(null);
    await UpdateControllerFixture.settleAsync();
    fixture.controller.stop();
    const stopped = fixture.controller.act("Check");

    Assert.isFalse(restart);
    Assert.isTrue(first);
    Assert.isFalse(whileChecking);
    Assert.isFalse(stopped);
    Assert.areEqual(1, fixture.updater.checks);
    Assert.areEqual(0, fixture.pending.length);
  }

  @TestMethod
  public async showsTheReasonOfARequestedCheckThatFailsAndKeepsTheStateOfAnAutomaticOne(): Promise<void> {
    const fixture = new UpdateControllerFixture(true);
    await fixture.controller.startAsync();
    await fixture.fireAsync();
    fixture.updater.check = () => Promise.reject(new UpdateException("TeamRun couldn't reach its update feed."));

    await fixture.fireAsync();
    const automatic = fixture.controller.status.toJson();
    fixture.updater.check = () => Promise.reject(new Error("unexpected"));
    fixture.controller.act("Check");
    await UpdateControllerFixture.settleAsync();

    Assert.areEqual(JSON.stringify({ kind: "UpToDate", version: null, progress: null, checkedAt: 31_000, reason: "TeamRun couldn't reach its update feed.", mustMove: false }), JSON.stringify(automatic));
    Assert.areEqual(JSON.stringify({ kind: "Failed", version: null, progress: null, checkedAt: 31_000, reason: "The update stopped on an unexpected error.", mustMove: true }),
      JSON.stringify(fixture.controller.status.toJson()));
    Assert.areEqual(JSON.stringify(["The update failed: UpdateException: TeamRun couldn't reach its update feed.", "The update failed: Error: unexpected"]), JSON.stringify(fixture.lines));
  }

  @TestMethod
  public async failsADownloadThatBreaksOrCannotBeHashed(): Promise<void> {
    const fixture = new UpdateControllerFixture();
    fixture.updater.check = () => Promise.resolve("1.3.0");
    fixture.updater.download = () => Promise.reject(new UpdateException("The download doesn't match the release."));
    await fixture.controller.startAsync();

    fixture.controller.act("Check");
    await UpdateControllerFixture.settleAsync();
    const broken = fixture.controller.status.toJson();
    fixture.updater.download = () => Promise.resolve("/downloads/gone.AppImage");
    fixture.controller.act("Check");
    await UpdateControllerFixture.settleAsync();

    Assert.areEqual(JSON.stringify({ kind: "Failed", version: null, progress: null, checkedAt: 1_000, reason: "The download doesn't match the release.", mustMove: false }), JSON.stringify(broken));
    Assert.areEqual("The update stopped on an unexpected error.", fixture.controller.status.reason);
    Assert.areEqual(0, fixture.record.writes.length);
    Assert.areEqual(0, fixture.posts.length);
  }

  @TestMethod
  public async staysReadyWhenTheRecordCannotBeWrittenAndLogsIt(): Promise<void> {
    const fixture = new UpdateControllerFixture();
    fixture.updater.check = () => Promise.resolve("1.3.0");
    fixture.record.writeFailure = new Error("EACCES");
    await fixture.controller.startAsync();

    fixture.controller.act("Check");
    await UpdateControllerFixture.settleAsync();

    Assert.areEqual("Ready", fixture.controller.status.kind);
    Assert.areEqual(JSON.stringify(["1.3.0"]), JSON.stringify(fixture.posts));
    Assert.areEqual(JSON.stringify([
      "The ready update could not be recorded, so it downloads again after a restart: Error: EACCES",
      "The ready update's notification could not be posted or recorded: Error: EACCES"
    ]), JSON.stringify(fixture.lines));
  }

  @TestMethod
  public async showsAReadyRecordAtTheStartWithoutTheNetworkAndPostsItUntilTheRuntimeTakesIt(): Promise<void> {
    const fixture = new UpdateControllerFixture();
    fixture.record.kept = { version: "1.10.0", file: FakeUpdater.FILE, sha512: "c2hh", notified: false };
    fixture.post = () => Promise.resolve(false);

    await fixture.controller.startAsync();
    await fixture.controller.notifyAsync();
    const refused = fixture.record.writes.length;
    fixture.post = () => Promise.resolve(true);
    await Promise.all([fixture.controller.notifyAsync(), fixture.controller.notifyAsync()]);
    await fixture.controller.notifyAsync();
    await fixture.fireAsync();

    Assert.areEqual(JSON.stringify({ kind: "Ready", version: "1.10.0", progress: null, checkedAt: null, reason: null, mustMove: false }), JSON.stringify(fixture.controller.status.toJson()));
    Assert.areEqual(0, refused);
    Assert.areEqual(JSON.stringify(["1.10.0", "1.10.0"]), JSON.stringify(fixture.posts));
    Assert.areEqual(JSON.stringify([{ version: "1.10.0", file: FakeUpdater.FILE, sha512: "c2hh", notified: true }]), JSON.stringify(fixture.record.writes));
    Assert.areEqual(0, fixture.updater.checks);
    Assert.areEqual(1, fixture.pending.length);
  }

  @TestMethod
  public async logsAPostThatFails(): Promise<void> {
    const fixture = new UpdateControllerFixture();
    fixture.record.kept = { version: "1.3.0", file: FakeUpdater.FILE, sha512: "c2hh", notified: false };
    fixture.post = () => Promise.reject(new Error("closed"));

    await fixture.controller.startAsync();
    await fixture.controller.notifyAsync();

    Assert.areEqual(JSON.stringify(["The ready update's notification could not be posted or recorded: Error: closed"]), JSON.stringify(fixture.lines));
  }

  @TestMethod
  public async postsNothingWithoutAReadyUpdateOrForOneAlreadyPosted(): Promise<void> {
    const fixture = new UpdateControllerFixture();
    await fixture.controller.notifyAsync();
    fixture.record.kept = { version: "1.3.0", file: FakeUpdater.FILE, sha512: "c2hh", notified: true };

    await fixture.controller.startAsync();
    await fixture.controller.notifyAsync();

    Assert.areEqual("Ready", fixture.controller.status.kind);
    Assert.areEqual(0, fixture.posts.length);
  }

  @TestMethod
  public async removesARecordThatIsInstalledChangedOrUnreadable(): Promise<void> {
    const records = [
      { version: "1.2.0", file: FakeUpdater.FILE, sha512: "c2hh", notified: true },
      { version: "1.1.9", file: FakeUpdater.FILE, sha512: "c2hh", notified: true },
      { version: "1.3.0", file: FakeUpdater.FILE, sha512: "b3RoZXI=", notified: true },
      { version: "1.3.0", file: "/downloads/gone.AppImage", sha512: "c2hh", notified: true },
      { version: "1.3.0" }
    ];
    const lines: string[] = [];

    for (const record of records) {
      const fixture = new UpdateControllerFixture();
      fixture.record.kept = record;
      await fixture.controller.startAsync();
      Assert.areEqual("UpToDate", fixture.controller.status.kind);
      Assert.areEqual(1, fixture.record.deletes);
      lines.push(...fixture.lines);
    }

    Assert.areEqual("The ready update's record was removed, since version 1.2.0 is no newer than the installed one.", lines[0]);
    Assert.areEqual("The ready update's record was removed, since version 1.1.9 is no newer than the installed one.", lines[1]);
    Assert.areEqual("The ready update's record was removed, since the downloaded file has changed or is gone.", lines[2]);
    Assert.areEqual("The ready update's record was removed, since Error: ENOENT: /downloads/gone.AppImage.", lines[3]);
    Assert.isTrue(lines[4]?.startsWith("The ready update's record was removed, since JsonException:") === true);
    Assert.areEqual(5, lines.length);
  }

  @TestMethod
  public async logsARecordItCannotRemove(): Promise<void> {
    const fixture = new UpdateControllerFixture();
    fixture.record.readFailure = new SyntaxError("Unexpected end of JSON input");
    fixture.record.deleteFailure = new Error("EPERM");

    await fixture.controller.startAsync();

    Assert.areEqual(JSON.stringify([
      "The ready update's record was removed, since SyntaxError: Unexpected end of JSON input.",
      "The ready update's record was removed, since Error: EPERM."
    ]), JSON.stringify(fixture.lines));
    Assert.areEqual(1, fixture.pending.length);
  }

  @TestMethod
  public async checksOnceAtTheStartOrOnlyOnRequestAsTheSettingSays(): Promise<void> {
    const fixture = new UpdateControllerFixture();
    fixture.controller.follow("AtStart");
    const beforeStart = fixture.scheduled.length;
    await fixture.controller.startAsync();
    await fixture.fireAsync();
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
  }

  @TestMethod
  public async checksAtOnceWhenTheDueTimeHasPassed(): Promise<void> {
    const fixture = new UpdateControllerFixture();
    fixture.controller.follow("OnRequest");
    await fixture.controller.startAsync();
    fixture.time += 60_000;

    fixture.controller.follow("AtStart");

    Assert.areEqual(JSON.stringify([0]), JSON.stringify(fixture.pending.map(t => t.delay)));
  }

  @TestMethod
  public async skipsAnAutomaticCheckWhileBusyAndArmsTheNext(): Promise<void> {
    const fixture = new UpdateControllerFixture();
    const check = Promise.withResolvers<string | null>();
    fixture.updater.check = () => check.promise;
    await fixture.controller.startAsync();
    fixture.controller.act("Check");

    await fixture.fireAsync();
    check.resolve(null);
    await UpdateControllerFixture.settleAsync();

    Assert.areEqual(1, fixture.updater.checks);
    Assert.areEqual(JSON.stringify([3_600_000]), JSON.stringify(fixture.pending.map(t => t.delay)));
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
