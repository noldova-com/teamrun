/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { FolderCheckTimings, FolderProbe, FolderState } from "@noldova/teamrun.core";
import { ManualTimer } from "@noldova/teamrun.core/testing";

import { HeldFolderStat } from "../../fixtures/held-folder-stat.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class FolderProbeTests {
  @TestMethod
  public async findsAFolderPresentAndAnythingElseMissing(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const folder = join(directory.path, "folder");
    const file = join(directory.path, "file");
    mkdirSync(folder);
    writeFileSync(file, "not a folder");
    const probe = FolderProbeTests.create(new HeldFolderStat(), new ManualTimer());

    const found = await Promise.all([folder, file, join(directory.path, "gone"), join(file, "inside")].map(t => probe.checkAsync(t)));

    Assert.areEqual([FolderState.Present, FolderState.Missing, FolderState.Missing, FolderState.Missing].join(), found.join());
  }

  @TestMethod
  public async countsAPathItCantReadAsMissingWhateverTheError(): Promise<void> {
    const stat = new HeldFolderStat();
    const probe = FolderProbeTests.create(stat, new ManualTimer());
    const codes = ["ENOENT", "EACCES", "ENOTDIR", "EBUSY"];

    for (const code of codes)
      stat.failNext(code, code);

    const found = await Promise.all(codes.map(t => probe.checkAsync(t)));

    Assert.areEqual(codes.map(() => FolderState.Missing).join(), found.join());
  }

  @TestMethod
  public async findsAFolderUnreachableOnceItsReadPassesTheDeadlineAndWaitsOnThatReadUntilItAnswers(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const stat = new HeldFolderStat();
    const timer = new ManualTimer();
    const probe = FolderProbeTests.create(stat, timer);
    stat.hold(directory.path);

    const first = probe.checkAsync(directory.path);
    timer.advance(1_000);
    Assert.areEqual(FolderState.Unreachable, await first);
    const second = probe.checkAsync(directory.path);
    timer.advance(1_000);
    Assert.areEqual(FolderState.Unreachable, await second);
    Assert.areEqual(1, stat.paths.length);

    stat.release(directory.path, true);

    Assert.areEqual(FolderState.Present, await probe.checkAsync(directory.path));
    Assert.areEqual(FolderState.Present, await probe.checkAsync(directory.path));
    Assert.areEqual(2, stat.paths.length);
  }

  @TestMethod
  public async readsAPathAnewForEachCheckWhileNoReadOfItHasStalled(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const stat = new HeldFolderStat();
    const probe = FolderProbeTests.create(stat, new ManualTimer());
    stat.hold(directory.path);
    const first = probe.checkAsync(directory.path);

    Assert.areEqual(FolderState.Present, await probe.checkAsync(directory.path));

    stat.release(directory.path, false);
    Assert.areEqual(FolderState.Missing, await first);
    Assert.areEqual(2, stat.paths.length);
  }

  @TestMethod
  public async readsAtMostTwoLinkedPathsAtOnceAndTheNextInItsTurn(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const stat = new HeldFolderStat();
    const probe = FolderProbeTests.create(stat, new ManualTimer());
    const first = join(directory.path, "first");
    const second = join(directory.path, "second");
    const third = join(directory.path, "third");
    stat.hold(first);
    stat.hold(second);
    mkdirSync(third);

    const checks = [first, second, third].map(t => probe.checkLinkedAsync(t));
    await FolderProbeTests.settle();
    const started = stat.paths.join();
    stat.release(first, true);
    const turned = await Promise.all([checks[0], checks[2]]);
    stat.release(second, false);

    Assert.areEqual([first, second].join(), started);
    Assert.areEqual([FolderState.Present, FolderState.Present].join(), turned.join());
    Assert.areEqual(FolderState.Missing, await checks[1]);
    Assert.areEqual([first, second, third].join(), stat.paths.join());
  }

  @TestMethod
  public async answersALinkedPathUnreachableWithoutAReadWhileTwoLinkedReadsAreStuckAndReadsAgainOnceOneAnswers(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    const stat = new HeldFolderStat();
    const timer = new ManualTimer();
    const probe = FolderProbeTests.create(stat, timer);
    const first = join(directory.path, "first");
    const second = join(directory.path, "second");
    const folder = join(directory.path, "folder");
    stat.hold(first);
    stat.hold(second);
    mkdirSync(folder);

    const late = [first, second, folder].map(t => probe.checkLinkedAsync(t));
    timer.advance(1_000);
    const found = await Promise.all(late);
    const again = probe.checkLinkedAsync(second);
    timer.advance(1_000);
    const stalled = [await again, await probe.checkLinkedAsync(folder)];
    const read = stat.paths.join();
    stat.release(first, true);
    await FolderProbeTests.settle();

    Assert.areEqual([FolderState.Unreachable, FolderState.Unreachable, FolderState.Unreachable].join(), found.join());
    Assert.areEqual([FolderState.Unreachable, FolderState.Unreachable].join(), stalled.join());
    Assert.areEqual([first, second].join(), read);
    Assert.areEqual(FolderState.Present, await probe.checkLinkedAsync(folder));
    Assert.areEqual([first, second, folder].join(), stat.paths.join());
  }

  @TestMethod
  public async endsAListingsWaitWithItsChecksOrOnceTheListWaitPasses(): Promise<void> {
    const timer = new ManualTimer();
    const probe = FolderProbeTests.create(new HeldFolderStat(), timer);

    await probe.withinListWaitAsync(Promise.resolve());
    const ended = timer.pending;
    const waiting = probe.withinListWaitAsync(Promise.withResolvers<void>().promise);
    const started = timer.pending;
    timer.advance(500);
    await waiting;

    Assert.areEqual("0,1,0", [ended, started, timer.pending].join());
  }

  private static settle(): Promise<void> {
    return new Promise<void>(resolve => setImmediate(resolve));
  }

  private static create(stat: HeldFolderStat, timer: ManualTimer): FolderProbe {
    return new FolderProbe(stat.statAsync, new FolderCheckTimings(1_000, 500), timer);
  }
}
