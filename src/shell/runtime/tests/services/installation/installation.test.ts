/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs, { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { UpdateProcess } from "@noldova/teamrun-shell-protocol";
import { Installation, UpdateBarrier, UpdateBarrierState, UpdateBarrierStatus } from "@noldova/teamrun-shell-runtime";

import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class InstallationTests {
  private static readonly RUNNING: UpdateProcess = new UpdateProcess(4120, 1500, 1501, "desktop");
  private static readonly GONE: UpdateProcess = new UpdateProcess(4121, 1500, 1501, "desktop");

  @TestMethod
  public isNamedByItsProgramsResolvedPathIgnoringCaseOnWindows(): void {
    const folder = Installation.locate("device", path.join("opt", "TeamRun", "teamrun"), "linux");

    Assert.areEqual(path.join("device", "installations"), path.dirname(folder));
    Assert.isTrue(/^[0-9a-f]{16}$/.test(path.basename(folder)), folder);
    Assert.areEqual(folder, Installation.locate("device", path.join("opt", "other", "..", "TeamRun", "teamrun"), "linux"));
    Assert.areNotEqual(folder, Installation.locate("device", path.join("opt", "TeamRun", "other"), "linux"));
    Assert.areNotEqual(folder, Installation.locate("device", path.join("opt", "teamrun", "TEAMRUN"), "linux"));
    Assert.areEqual(Installation.locate("device", path.join("opt", "TeamRun", "teamrun"), "win32"), Installation.locate("device", path.join("opt", "teamrun", "TEAMRUN"), "win32"));
  }

  @TestMethod
  public async isNamedByTheProgramALinkLeadsTo(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const real = path.join(folder.path, "real");
    const linked = path.join(folder.path, "linked");
    await mkdir(real);
    await writeFile(path.join(real, "teamrun"), "");
    await symlink(real, linked, "junction");

    Assert.areEqual(Installation.locate("device", path.join(real, "teamrun"), process.platform), Installation.locate("device", path.join(linked, "teamrun"), process.platform));
  }

  @TestMethod
  public async recordsEachDataDirectoryOnce(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);
    const first = path.join(folder.path, "first");
    const second = path.join(folder.path, "second");

    await installation.recordAsync(first);
    await installation.recordAsync(path.join(second, "..", "second"));
    await installation.recordAsync(first);

    const files = await readdir(installation.recordFolder);
    const roots = await Promise.all(files.map(async t => JSON.parse(await readFile(path.join(installation.recordFolder, t), "utf8")) as { dataDirectory: string }));
    Assert.areEqual(path.join(folder.path, "installation", "data-directories"), installation.recordFolder);
    Assert.areEqual(2, files.length);
    Assert.isTrue(files.every(t => /^[0-9a-f]{16}\.json$/.test(t)), files.join(","));
    Assert.areEqual([first, second].toSorted().join("|"), roots.map(t => t.dataDirectory).toSorted().join("|"));
  }

  @TestMethod
  public async readsItsBarrier(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);
    const closing = new UpdateBarrier(InstallationTests.RUNNING, "0.3.0", UpdateBarrierState.Closing, null);
    const missing = await installation.readAsync();
    const missingText = await installation.readTextAsync();

    await InstallationTests.writeAsync(installation, closing);
    const found = await installation.readAsync();

    Assert.isNull(missing);
    Assert.isNull(missingText);
    Assert.areEqual(JSON.stringify(closing.toJson()), JSON.stringify(found?.toJson()));
    Assert.areEqual(JSON.stringify(closing.toJson()), await installation.readTextAsync());
  }

  @TestMethod
  public async listsTheRecordedDataDirectoriesThatExistNowAndKeepsTheRecordOfTheOthers(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);
    const kept = path.join(folder.path, "kept");
    await mkdir(kept);
    const empty = await installation.listDataDirectoriesAsync();
    await installation.recordAsync(kept);
    await installation.recordAsync(path.join(folder.path, "gone"));
    await writeFile(path.join(installation.recordFolder, "broken.json"), "{");
    await writeFile(path.join(installation.recordFolder, "other.txt"), "{}");

    const roots = await installation.listDataDirectoriesAsync();

    Assert.areEqual(0, empty.length);
    Assert.areEqual(kept, roots.join("|"));
    Assert.areEqual(["broken.json", "other.txt"].join("|"), (await readdir(installation.recordFolder)).filter(t => !/^[0-9a-f]{16}\.json$/.test(t)).toSorted().join("|"));
    Assert.areEqual(4, (await readdir(installation.recordFolder)).length);
  }

  @TestMethod
  public async listsTheRecordedDesktopsThatRunAndRemovesTheRecordsOfThoseThatExited(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);
    const empty = await installation.listDesktopsAsync();
    await installation.recordDesktopAsync(InstallationTests.RUNNING);
    await installation.recordDesktopAsync(InstallationTests.GONE);
    await writeFile(path.join(installation.desktopFolder, "broken.json"), "{");
    await writeFile(path.join(installation.desktopFolder, "other.txt"), "{}");

    const desktops = await installation.listDesktopsAsync();

    Assert.areEqual(0, empty.length);
    Assert.areEqual(path.join(folder.path, "installation", "desktops"), installation.desktopFolder);
    Assert.areEqual(JSON.stringify([InstallationTests.RUNNING.toJson()]), JSON.stringify(desktops.map(t => t.toJson())));
    Assert.areEqual(["4120.json", "broken.json", "other.txt"].join("|"), (await readdir(installation.desktopFolder)).toSorted().join("|"));
  }

  @TestMethod
  public async skipsADesktopRecordRemovedWhileListingAndPassesOnOneThatCannotBeRead(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);
    await installation.recordDesktopAsync(InstallationTests.RUNNING);
    const original = fs.promises.readFile;
    fs.promises.readFile = () => Promise.reject<never>(Object.assign(new Error("ENOENT: no such file or directory, open"), { code: "ENOENT" }));
    syncBuiltinESMExports();
    let removed: readonly UpdateProcess[];
    try {
      removed = await installation.listDesktopsAsync();
    }
    finally {
      fs.promises.readFile = original;
      syncBuiltinESMExports();
    }
    await mkdir(path.join(installation.desktopFolder, "4130.json"));

    const error = await Assert.throwsAsync(() => installation.listDesktopsAsync(), Error) as NodeJS.ErrnoException;

    Assert.areEqual(0, removed.length);
    Assert.areEqual("EISDIR", error.code);
  }

  @TestMethod
  public async passesOnAnErrorListingTheRecord(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);
    await mkdir(installation.folder, { recursive: true });
    await writeFile(installation.recordFolder, "not a folder");

    const error = await Assert.throwsAsync(() => installation.listDataDirectoriesAsync(), Error) as NodeJS.ErrnoException;

    Assert.areEqual("ENOTDIR", error.code);
  }

  @TestMethod
  public async findsAnotherUpdateUnderWayWhenItsBarrierIsCreatedJustBeforeTheLink(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);
    const other = JSON.stringify(new UpdateBarrier(InstallationTests.RUNNING, "0.4.0", UpdateBarrierState.Preparing, null).toJson());
    const link = fs.promises.link;
    fs.promises.link = async (existing, target) => {
      await writeFile(target, other);
      await link(existing, target);
    };
    syncBuiltinESMExports();
    let isHeld: boolean;
    try {
      isHeld = await installation.holdAsync(new UpdateBarrier(InstallationTests.RUNNING, "0.3.0", UpdateBarrierState.Preparing, null), "0.2.0");
    }
    finally {
      fs.promises.link = link;
      syncBuiltinESMExports();
    }

    Assert.isFalse(isHeld);
    Assert.areEqual(other, await installation.readTextAsync());
    Assert.areEqual("barrier.json", (await readdir(installation.folder)).join(","));
  }

  @TestMethod
  public async holdsItsBarrierWhenItCannotRemoveItsTemporaryFileAndPassesOnAFailedLink(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);
    const preparing = new UpdateBarrier(InstallationTests.RUNNING, "0.3.0", UpdateBarrierState.Preparing, null);
    const original = fs.promises.rm;
    fs.promises.rm = () => Promise.reject(Object.assign(new Error("EBUSY: resource busy or locked, rm"), { code: "EBUSY" }));
    syncBuiltinESMExports();
    let isHeld: boolean;
    try {
      isHeld = await installation.holdAsync(preparing, "0.2.0");
    }
    finally {
      fs.promises.rm = original;
      syncBuiltinESMExports();
    }
    await installation.releaseAsync();
    const link = fs.promises.link;
    fs.promises.link = () => Promise.reject(Object.assign(new Error("EPERM: operation not permitted, link"), { code: "EPERM" }));
    syncBuiltinESMExports();
    let error: Error;
    try {
      error = await Assert.throwsAsync(() => installation.holdAsync(preparing, "0.2.0"), Error);
    }
    finally {
      fs.promises.link = link;
      syncBuiltinESMExports();
    }

    Assert.isTrue(isHeld);
    Assert.areEqual("EPERM: operation not permitted, link", error.message);
    Assert.areEqual(1, (await readdir(installation.folder)).length);
    Assert.isFalse(existsSync(installation.barrierFile));
  }

  @TestMethod
  public async holdsMovesOnAndReleasesItsBarrier(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);
    const preparing = new UpdateBarrier(InstallationTests.RUNNING, "0.3.0", UpdateBarrierState.Preparing, null);
    const missing = await installation.readAsync();

    const isHeld = await installation.holdAsync(preparing, "0.2.0");
    const isHeldAgain = await installation.holdAsync(preparing, "0.2.0");
    await installation.replaceAsync(new UpdateBarrier(InstallationTests.RUNNING, "0.3.0", UpdateBarrierState.Closing, null));
    const closing = await installation.readAsync();
    await installation.releaseAsync();
    await installation.releaseAsync();

    Assert.isNull(missing);
    Assert.isTrue(isHeld);
    Assert.isFalse(isHeldAgain);
    Assert.areEqual(JSON.stringify(new UpdateBarrier(InstallationTests.RUNNING, "0.3.0", UpdateBarrierState.Closing, null).toJson()), JSON.stringify(closing?.toJson()));
    Assert.areEqual(0, (await readdir(installation.folder)).length);
  }

  @TestMethod
  public async holdsInPlaceOfABarrierLeftBeforeTheHandoffButNotOfAnUnfinishedOne(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);
    const preparing = new UpdateBarrier(InstallationTests.RUNNING, "0.3.0", UpdateBarrierState.Preparing, null);

    await InstallationTests.writeAsync(installation, new UpdateBarrier(InstallationTests.GONE, "0.3.0", UpdateBarrierState.Closing, null));
    const afterStopped = await installation.holdAsync(preparing, "0.2.0");
    await InstallationTests.writeAsync(installation, new UpdateBarrier(InstallationTests.GONE, "0.4.0", UpdateBarrierState.HandedOff, null));
    const afterUnfinished = await installation.holdAsync(preparing, "0.2.0");

    Assert.isTrue(afterStopped);
    Assert.isFalse(afterUnfinished);
    Assert.areEqual("0.4.0", (await installation.readAsync())?.version);
  }

  @TestMethod
  public async letsNoReaderSeeABarrierHalfWritten(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);
    const states: string[] = [];
    let isDone = false;

    const holding = installation.holdAsync(new UpdateBarrier(InstallationTests.RUNNING, "0.3.0", UpdateBarrierState.Preparing, null), "0.2.0").finally(() => {
      isDone = true;
    });
    while (!isDone)
      states.push((await installation.readAsync())?.state ?? "None");
    for (const state of [UpdateBarrierState.Closing, UpdateBarrierState.HandedOff]) {
      const replacing = installation.replaceAsync(new UpdateBarrier(InstallationTests.RUNNING, "0.3.0", state, null));
      states.push((await installation.readAsync())?.state ?? "None");
      await replacing;
    }

    Assert.isTrue(await holding);
    Assert.isTrue(states.length >= 3 && states.every(t => t === "None" || Object.values<string>(UpdateBarrierState).includes(t)), states.join(","));
    Assert.areEqual(UpdateBarrierState.HandedOff, (await installation.readAsync())?.state);
    Assert.areEqual("barrier.json", (await readdir(installation.folder)).join(","));
  }

  @TestMethod
  public async findsNoBarrierWhenNoneWasWritten(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);

    Assert.areEqual(UpdateBarrierStatus.None, await installation.checkAsync("0.2.0"));
    Assert.isTrue(await installation.hasEndedAsync());
  }

  @TestMethod
  public async isHeldWhileTheBarriersHolderRuns(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);
    await InstallationTests.writeAsync(installation, new UpdateBarrier(InstallationTests.RUNNING, "0.3.0", UpdateBarrierState.HandedOff, null));

    Assert.areEqual(UpdateBarrierStatus.Held, await installation.checkAsync("0.2.0"));
    Assert.isFalse(await installation.hasEndedAsync());
    Assert.isTrue(existsSync(installation.barrierFile));
  }

  @TestMethod
  public async removesABarrierLeftBeforeTheHandoffOrHandedOffForThisVersion(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);
    const barriers = [
      new UpdateBarrier(InstallationTests.GONE, "0.3.0", UpdateBarrierState.Preparing, null),
      new UpdateBarrier(InstallationTests.GONE, "0.3.0", UpdateBarrierState.Closing, null),
      new UpdateBarrier(InstallationTests.GONE, "0.2.0", UpdateBarrierState.HandedOff, null)
    ];

    const results: string[] = [];
    for (const barrier of barriers) {
      await InstallationTests.writeAsync(installation, barrier);
      const hasEnded = await installation.hasEndedAsync();
      results.push(`${hasEnded} ${await installation.checkAsync("0.2.0")} ${await installation.hasEndedAsync()}`);
    }

    Assert.areEqual(["true None true", "true None true", "false None true"].join("|"), results.join("|"));
    Assert.areEqual("", (await readdir(installation.folder)).join(","));
  }

  @TestMethod
  public async keepsAFreshBarrierThatReplacedTheStaleOneWhileItsHolderWasChecked(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const barrierFile = path.join(folder.path, "installation", "barrier.json");
    const fresh = JSON.stringify(new UpdateBarrier(InstallationTests.RUNNING, "0.3.0", UpdateBarrierState.Preparing, null).toJson());
    const installation = new Installation(path.join(folder.path, "installation"), async t => {
      if (t.processId === InstallationTests.GONE.processId)
        await writeFile(barrierFile, fresh);
      return t.processId === InstallationTests.RUNNING.processId;
    });
    await InstallationTests.writeAsync(installation, new UpdateBarrier(InstallationTests.GONE, "0.3.0", UpdateBarrierState.Preparing, null));

    const status = await installation.checkAsync("0.2.0");

    Assert.areEqual(UpdateBarrierStatus.Held, status);
    Assert.areEqual(fresh, await readFile(barrierFile, "utf8"));
    Assert.areEqual("barrier.json", (await readdir(installation.folder)).join(","));
  }

  @TestMethod
  public async findsNoBarrierWhenAnotherProcessRemovedTheStaleOneWhileItsHolderWasChecked(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const barrierFile = path.join(folder.path, "installation", "barrier.json");
    const installation = new Installation(path.join(folder.path, "installation"), async () => {
      await rm(barrierFile, { force: true });
      return false;
    });
    await InstallationTests.writeAsync(installation, new UpdateBarrier(InstallationTests.GONE, "0.3.0", UpdateBarrierState.Closing, null));

    Assert.areEqual(UpdateBarrierStatus.None, await installation.checkAsync("0.2.0"));
    Assert.areEqual("", (await readdir(installation.folder)).join(","));
  }

  @TestMethod
  public async removesOnlyTheBarrierItReadAndPutsBackOneThatReplacedIt(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);
    await InstallationTests.writeAsync(installation, new UpdateBarrier(InstallationTests.GONE, "0.3.0", UpdateBarrierState.HandedOff, null));
    const judged = String(await installation.readTextAsync());

    const removed = await installation.removeAsync(judged);
    const missing = await installation.removeAsync(judged);
    await InstallationTests.writeAsync(installation, new UpdateBarrier(InstallationTests.RUNNING, "0.3.0", UpdateBarrierState.Preparing, null));
    const replaced = await installation.removeAsync(judged);

    Assert.areEqual("true true false", `${removed} ${missing} ${replaced}`);
    Assert.areEqual(JSON.stringify(new UpdateBarrier(InstallationTests.RUNNING, "0.3.0", UpdateBarrierState.Preparing, null).toJson()), await installation.readTextAsync());
    Assert.areEqual("barrier.json", (await readdir(installation.folder)).join(","));
  }

  @TestMethod
  public async dropsTheBarrierItMovedAsideWhenAnotherTookItsPlaceMeanwhile(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);
    const newest = JSON.stringify(new UpdateBarrier(InstallationTests.RUNNING, "0.4.0", UpdateBarrierState.Preparing, null).toJson());
    await InstallationTests.writeAsync(installation, new UpdateBarrier(InstallationTests.RUNNING, "0.3.0", UpdateBarrierState.Preparing, null));
    const link = fs.promises.link;
    fs.promises.link = async (existing, target) => {
      await writeFile(target, newest);
      await link(existing, target);
    };
    syncBuiltinESMExports();
    let removed: boolean;
    try {
      removed = await installation.removeAsync("{}");
    }
    finally {
      fs.promises.link = link;
      syncBuiltinESMExports();
    }

    Assert.isFalse(removed);
    Assert.areEqual(newest, await installation.readTextAsync());
    Assert.areEqual("barrier.json", (await readdir(installation.folder)).join(","));
  }

  @TestMethod
  public async keepsTheBarrierItMovedAsideWhenItCannotPutItBack(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);
    await InstallationTests.writeAsync(installation, new UpdateBarrier(InstallationTests.RUNNING, "0.3.0", UpdateBarrierState.Preparing, null));
    const link = fs.promises.link;
    fs.promises.link = () => Promise.reject(Object.assign(new Error("EPERM: operation not permitted, link"), { code: "EPERM" }));
    syncBuiltinESMExports();
    let error: Error;
    try {
      error = await Assert.throwsAsync(() => installation.removeAsync("{}"), Error);
    }
    finally {
      fs.promises.link = link;
      syncBuiltinESMExports();
    }

    Assert.areEqual("EPERM: operation not permitted, link", error.message);
    Assert.areEqual(1, (await readdir(installation.folder)).filter(t => t.startsWith("barrier.json.")).length);
  }

  @TestMethod
  public async keepsABarrierHandedOffForAnotherVersionOrThatCannotBeRead(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);

    await InstallationTests.writeAsync(installation, new UpdateBarrier(InstallationTests.GONE, "0.3.0", UpdateBarrierState.HandedOff, null));
    const handedOff = `${await installation.hasEndedAsync()} ${await installation.checkAsync("0.2.0")}`;
    await InstallationTests.writeAsync(installation, new UpdateBarrier(InstallationTests.GONE, "0.3.0", UpdateBarrierState.HandedOff, InstallationTests.RUNNING));
    const installing = `${await installation.hasEndedAsync()} ${await installation.checkAsync("0.2.0")}`;
    await InstallationTests.writeAsync(installation, new UpdateBarrier(InstallationTests.GONE, "0.3.0", UpdateBarrierState.HandedOff, InstallationTests.GONE));
    const installerGone = await installation.checkAsync("0.2.0");
    await writeFile(installation.barrierFile, "{\"holder\":");
    await Assert.throwsAsync(() => installation.hasEndedAsync(), SyntaxError);
    const unreadable = await installation.checkAsync("0.2.0");

    Assert.areEqual("false Unfinished", handedOff);
    Assert.areEqual("false Held", installing);
    Assert.areEqual(UpdateBarrierStatus.Unfinished, installerGone);
    Assert.areEqual(UpdateBarrierStatus.Unfinished, unreadable);
    Assert.isTrue(existsSync(installation.barrierFile));
  }

  @TestMethod
  public async passesOnAnErrorOtherThanAMissingBarrier(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = InstallationTests.open(folder.path);
    await mkdir(installation.barrierFile, { recursive: true });

    const error = await Assert.throwsAsync(() => installation.checkAsync("0.2.0"), Error) as NodeJS.ErrnoException;
    const watched = await Assert.throwsAsync(() => installation.hasEndedAsync(), Error) as NodeJS.ErrnoException;

    Assert.areEqual("EISDIR", error.code);
    Assert.areEqual("EISDIR", watched.code);
  }

  @TestMethod
  public async passesOnAHolderThatCannotBeLookedUp(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const failing = new Installation(path.join(folder.path, "installation"), () => Promise.reject(new Error("ps failed")));
    await InstallationTests.writeAsync(failing, new UpdateBarrier(InstallationTests.GONE, "0.3.0", UpdateBarrierState.Closing, null));

    const error = await Assert.throwsAsync(() => failing.hasEndedAsync(), Error);

    Assert.areEqual("ps failed", error.message);
    Assert.isTrue(existsSync(failing.barrierFile));
  }

  private static open(folder: string): Installation {
    return new Installation(path.join(folder, "installation"), t => Promise.resolve(t.processId === InstallationTests.RUNNING.processId));
  }

  private static async writeAsync(installation: Installation, barrier: UpdateBarrier): Promise<void> {
    await mkdir(installation.folder, { recursive: true });
    await writeFile(installation.barrierFile, JSON.stringify(barrier.toJson()));
  }
}
