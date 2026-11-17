/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import fs, { existsSync, mkdirSync, readFileSync, readdirSync, utimesSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { basename, join } from "node:path";
import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ConversationEngine, Resources, SharedImages } from "@noldova/teamrun.core";
import { ErrorCode, Resources as ProtocolResources } from "@noldova/teamrun.protocol";
import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { RecordingLog } from "../../fixtures/recording-log.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class SharedImagesTests {
  private static readonly LIFETIME: number = 1000;

  @TestMethod
  public namesEachCopyByItsBytesSoDifferentImagesNeverShareANameAndTheSameImageReusesItsCopy(): void {
    using directory = new TemporaryDataDirectory();
    const folder = join(directory.path, "shared-images");
    const images = new SharedImages(folder);
    const [first, second] = [Buffer.from("first image"), Buffer.from("second image")];

    const kept = images.keep(first, "image/png");
    const other = images.keep(second, "image/png");
    const again = images.keep(Buffer.from("first image"), "image/png");
    const jpeg = images.keep(first, "image/jpeg");

    Assert.areEqual(`${SharedImagesTests.sha256(first)}.png`, basename(kept));
    Assert.areEqual(`${SharedImagesTests.sha256(second)}.png`, basename(other));
    Assert.areEqual(kept, again);
    Assert.areEqual(`${SharedImagesTests.sha256(first)}.jpg`, basename(jpeg));
    Assert.areEqual("first image|second image", [kept, other].map(t => readFileSync(t, "latin1")).join("|"));
    Assert.areEqual(3, readdirSync(folder).length);
    Assert.areEqual(ErrorCode.NotFound, Assert.throws(() => images.keep(first, "image/svg+xml"), ServiceException).info.name);
    Assert.areEqual(10 * 60 * 1000, ProtocolResources.fileShareLifetime);
  }

  @TestMethod
  public removesCopiesNoLongerInUseLongestUnusedFirstWhenTheLimitIsReachedAndNeverOneInUse(): void {
    using directory = new TemporaryDataDirectory();
    const folder = join(directory.path, "shared-images");
    let now = Date.now();
    const images = new SharedImages(folder, 30, SharedImagesTests.LIFETIME, () => now);
    const written = (path: string): string => {
      utimesSync(path, now / 1000, now / 1000);
      return path;
    };
    const old = written(images.keep(Buffer.alloc(10, 1), "image/png"));
    const reshared = written(images.keep(Buffer.alloc(10, 2), "image/png"));
    now += SharedImagesTests.LIFETIME / 2;
    images.keep(Buffer.alloc(10, 2), "image/png");
    const recent = written(images.keep(Buffer.alloc(10, 3), "image/png"));

    const full = Assert.throws(() => images.keep(Buffer.alloc(10, 4), "image/png"), ServiceException).info.name;
    now += SharedImagesTests.LIFETIME * 0.6;
    const roomy = images.keep(Buffer.alloc(10, 4), "image/png");

    Assert.areEqual(ErrorCode.TooLarge, full);
    Assert.isFalse(existsSync(old));
    Assert.areEqual("true|true|true", [reshared, recent, roomy].map(t => existsSync(t)).join("|"));
    Assert.areEqual(ErrorCode.TooLarge, Assert.throws(() => images.keep(Buffer.alloc(31, 5), "image/png"), ServiceException).info.name);
    Assert.areEqual(3, readdirSync(folder).length);
  }

  @TestMethod
  public cleansCopiesAndPartialCopiesWhoseSharesEndedWhenItStartsAndKeepsTheOnesStillInUse(): void {
    using directory = new TemporaryDataDirectory();
    const folder = join(directory.path, "shared-images");
    mkdirSync(folder);
    const now = Date.now();
    for (const [name, at] of [["ended.png", now - 2 * SharedImagesTests.LIFETIME], ["ended.png.partial", now - 2 * SharedImagesTests.LIFETIME],
      ["shared.png", now]] as const) {
      writeFileSync(join(folder, name), "x");
      utimesSync(join(folder, name), at / 1000, at / 1000);
    }
    mkdirSync(join(folder, "nested"));

    new SharedImages(folder, 30, SharedImagesTests.LIFETIME, () => now).clean();
    new SharedImages(join(directory.path, "missing"), 30, SharedImagesTests.LIFETIME, () => now).clean();

    Assert.areEqual("nested,shared.png", readdirSync(folder).sort().join(","));
    Assert.isFalse(existsSync(join(directory.path, "missing")));
  }

  @TestMethod
  public keepsACopyTheSystemWontRemoveYetForALaterCleanAndCountsItAgainstTheLimit(): void {
    using directory = new TemporaryDataDirectory();
    const folder = join(directory.path, "shared-images");
    mkdirSync(folder);
    const ended = (Date.now() - 2 * SharedImagesTests.LIFETIME) / 1000;
    writeFileSync(join(folder, "busy.png"), Buffer.alloc(20));
    utimesSync(join(folder, "busy.png"), ended, ended);
    const log = new RecordingLog();
    const images = new SharedImages(folder, 30, SharedImagesTests.LIFETIME, Date.now, log);
    const original = fs.rmSync;
    fs.rmSync = () => {
      throw Object.assign(new Error("The file is in use."), { code: "EBUSY", syscall: "rm" });
    };
    syncBuiltinESMExports();
    let full: string;
    try {
      images.clean();
      full = Assert.throws(() => images.keep(Buffer.alloc(20, 1), "image/png"), ServiceException).info.name;
    }
    finally {
      fs.rmSync = original;
      syncBuiltinESMExports();
    }

    Assert.areEqual(ErrorCode.TooLarge, full);
    Assert.areEqual("busy.png", readdirSync(folder).join(","));
    Assert.areEqual(JSON.stringify(Array(2).fill(Resources.formatSharedImageNotRemoved("busy.png", "Error EBUSY"))), JSON.stringify(log.lines));
    images.clean();
    Assert.areEqual("", readdirSync(folder).join(","));
  }

  @TestMethod
  public letsAnErrorThatIsNotTheFileSystemsOutOfAClean(): void {
    using directory = new TemporaryDataDirectory();
    const folder = join(directory.path, "shared-images");
    mkdirSync(folder);
    const ended = (Date.now() - 2 * SharedImagesTests.LIFETIME) / 1000;
    writeFileSync(join(folder, "ended.png"), Buffer.alloc(20));
    utimesSync(join(folder, "ended.png"), ended, ended);
    const log = new RecordingLog();
    const images = new SharedImages(folder, 30, SharedImagesTests.LIFETIME, Date.now, log);
    const original = fs.rmSync;
    fs.rmSync = () => {
      throw new TypeError("Not the file system's.");
    };
    syncBuiltinESMExports();
    try {
      Assert.throws(() => images.clean(), TypeError);
    }
    finally {
      fs.rmSync = original;
      syncBuiltinESMExports();
    }

    Assert.areEqual("ended.png", readdirSync(folder).join(","));
    Assert.areEqual(0, log.lines.length);
  }

  @TestMethod
  public letsAnErrorThatIsNotTheFileSystemsOutOfAKeepMakingRoom(): void {
    using directory = new TemporaryDataDirectory();
    const folder = join(directory.path, "shared-images");
    mkdirSync(folder);
    const ended = (Date.now() - 2 * SharedImagesTests.LIFETIME) / 1000;
    writeFileSync(join(folder, "ended.png"), Buffer.alloc(20));
    utimesSync(join(folder, "ended.png"), ended, ended);
    const log = new RecordingLog();
    const images = new SharedImages(folder, 30, SharedImagesTests.LIFETIME, Date.now, log);
    const original = fs.rmSync;
    fs.rmSync = () => {
      throw new TypeError("Not the file system's.");
    };
    syncBuiltinESMExports();
    try {
      Assert.throws(() => images.keep(Buffer.alloc(20, 1), "image/png"), TypeError);
    }
    finally {
      fs.rmSync = original;
      syncBuiltinESMExports();
    }

    Assert.areEqual("ended.png", readdirSync(folder).join(","));
    Assert.areEqual(0, log.lines.length);
  }

  @TestMethod
  public flushesANewCopyToDiskBeforeItTakesItsName(): void {
    using directory = new TemporaryDataDirectory();
    const images = new SharedImages(join(directory.path, "shared-images"));
    const bytes = Buffer.from("an image");
    const name = `${SharedImagesTests.sha256(bytes)}.png`;
    const calls: string[] = [];
    const [write, rename] = [fs.writeFileSync, fs.renameSync];
    fs.writeFileSync = (...args: Parameters<typeof fs.writeFileSync>): void => {
      const [file, , options] = args;
      calls.push(`write ${basename(String(file))} ${Object.isString(options) || Object.isNullOrUndefined(options) ? "unflushed" : String(options.flush)}`);
      write(...args);
    };
    fs.renameSync = (...args: Parameters<typeof fs.renameSync>): void => {
      calls.push(`rename ${basename(String(args[1]))}`);
      rename(...args);
    };
    syncBuiltinESMExports();
    try {
      images.keep(bytes, "image/png");
    }
    finally {
      fs.writeFileSync = write;
      fs.renameSync = rename;
      syncBuiltinESMExports();
    }

    Assert.areEqual(JSON.stringify([`write ${name}.partial true`, `rename ${name}`]), JSON.stringify(calls));
  }

  @TestMethod
  public async logsACleanThatFailsWhenTheEngineStartsAndStartsAnyway(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const blocked = join(host.directory.path, "blocked");
    writeFileSync(blocked, "not a folder");

    const engine = new ConversationEngine(host.context, host.projects, host.conversations, host.messages, host.approvals, host.providers, host.teammates,
      host.registry, host.events, host.attachments, undefined, host.log, undefined, null, null, null, null, null, new SharedImages(blocked));
    await engine.sweepFoldersAsync();

    Assert.areEqual(Resources.formatSharedImagesNotCleaned("Error ENOTDIR"), host.log.lines.join("\n"));
  }

  @TestMethod
  public async stopsTheEngineStartOnACleanErrorThatIsNotTheFileSystems(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const images = new SharedImages(join(host.directory.path, "shared-images"));
    images.clean = () => {
      throw new TypeError("Not the file system's.");
    };

    Assert.throws(() => new ConversationEngine(host.context, host.projects, host.conversations, host.messages, host.approvals, host.providers, host.teammates,
      host.registry, host.events, host.attachments, undefined, host.log, undefined, null, null, null, null, null, images), TypeError);
    Assert.areEqual(0, host.log.lines.length);
  }

  private static sha256(bytes: Buffer): string {
    return createHash("sha256").update(bytes).digest("hex");
  }
}
