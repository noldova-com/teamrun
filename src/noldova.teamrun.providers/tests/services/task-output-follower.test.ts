/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFileSync, renameSync, writeFileSync } from "node:fs";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TaskOutputFollower, TaskOutputReader } from "@noldova/teamrun.providers";
import { ManualTimer } from "@noldova/teamrun.core/testing";

import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

@TestClass
export class TaskOutputFollowerTests {
  private static readonly INTERVAL: number = 10;

  @TestMethod
  public async sendsOutputWrittenInSeveralPiecesAndACharacterSplitBetweenThem(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("task.output");
    writeFileSync(path, "line 1\n");
    const timer = new ManualTimer();
    const pieces: string[] = [];
    const follower = new TaskOutputFollower(path, text => pieces.push(text), timer, TaskOutputFollowerTests.INTERVAL);
    try {
      follower.start();
      const first = JSON.stringify(pieces);
      appendFileSync(path, Buffer.from([0x63, 0x61, 0x66, 0xC3]));
      await TaskOutputFollowerTests.tick(timer);
      appendFileSync(path, Buffer.from([0xA9, 0x0A]));
      await TaskOutputFollowerTests.tick(timer);

      Assert.areEqual(JSON.stringify(["line 1\n"]), first);
      Assert.areEqual(JSON.stringify(["line 1\n", "caf", "é\n"]), JSON.stringify(pieces));
    }
    finally { follower.stop(); }
  }

  @TestMethod
  public async keepsTryingAMissingFileAndSendsItsOutputOnceItAppears(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("late.output");
    const timer = new ManualTimer();
    const pieces: string[] = [];
    const follower = new TaskOutputFollower(path, text => pieces.push(text), timer, TaskOutputFollowerTests.INTERVAL);
    try {
      follower.start();
      await TaskOutputFollowerTests.tick(timer);
      const following = follower.isFollowing;
      const missing = pieces.length;
      writeFileSync(path, "ready\n");
      await TaskOutputFollowerTests.tick(timer);

      Assert.isTrue(following);
      Assert.areEqual(0, missing);
      Assert.areEqual(JSON.stringify(["ready\n"]), JSON.stringify(pieces));
    }
    finally { follower.stop(); }
  }

  @TestMethod
  public async readsAFileFromItsStartOnceItIsTruncated(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("truncated.output");
    writeFileSync(path, Buffer.concat([Buffer.from("first run\n"), Buffer.from("held\r\n", "utf16le")]));
    const timer = new ManualTimer();
    const pieces: string[] = [];
    const follower = new TaskOutputFollower(path, text => pieces.push(text), timer, TaskOutputFollowerTests.INTERVAL);
    try {
      follower.start();
      writeFileSync(path, "again\n");
      await TaskOutputFollowerTests.tick(timer);

      Assert.areEqual(JSON.stringify(["first run\n", "held\r\n", "again\n"]), JSON.stringify(pieces));
    }
    finally { follower.stop(); }
  }

  @TestMethod
  public async readsAFileFromItsStartOnceAnotherFileReplacesIt(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("rotated.output");
    writeFileSync(path, "old\n");
    const timer = new ManualTimer();
    const pieces: string[] = [];
    const follower = new TaskOutputFollower(path, text => pieces.push(text), timer, TaskOutputFollowerTests.INTERVAL);
    try {
      follower.start();
      renameSync(path, directory.resolve("rotated.output.1"));
      writeFileSync(path, "the new file\n");
      await TaskOutputFollowerTests.tick(timer);

      Assert.areEqual(JSON.stringify(["old\n", "the new file\n"]), JSON.stringify(pieces));
    }
    finally { follower.stop(); }
  }

  @TestMethod
  public sendsOnlyTheEndOfALargeOutputAsTheEndOfTheFileIsReadToday(): void {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("large.output");
    writeFileSync(path, "head ééé tail");
    const pieces: string[] = [];
    const follower = new TaskOutputFollower(path, text => pieces.push(text), new ManualTimer(), TaskOutputFollowerTests.INTERVAL, 7);

    follower.start();
    follower.stop();

    Assert.areEqual(JSON.stringify([TaskOutputReader.readTail(path, 7)]), JSON.stringify(pieces));
    Assert.areEqual(JSON.stringify(["é tail"]), JSON.stringify(pieces));
  }

  @TestMethod
  public async sendsUpToFourTimesTheLimitOnceSomethingWasSentWithoutACharacterTheCutBroke(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("busy.output");
    writeFileSync(path, "abc\n");
    const timer = new ManualTimer();
    const pieces: string[] = [];
    const follower = new TaskOutputFollower(path, text => pieces.push(text), timer, TaskOutputFollowerTests.INTERVAL, 7);
    try {
      follower.start();
      appendFileSync(path, "€".repeat(10));
      await TaskOutputFollowerTests.tick(timer);

      Assert.areEqual(JSON.stringify(["abc\n", TaskOutputReader.readTail(path, 28)]), JSON.stringify(pieces));
      Assert.areEqual(JSON.stringify(["abc\n", "€".repeat(9)]), JSON.stringify(pieces));
    }
    finally { follower.stop(); }
  }

  @TestMethod
  public async sendsUtf16OutputThenUtf8AsTheEndOfTheFileReadsIt(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("wsl.output");
    writeFileSync(path, "wsl:\n");
    const timer = new ManualTimer();
    const pieces: string[] = [];
    const follower = new TaskOutputFollower(path, text => pieces.push(text), timer, TaskOutputFollowerTests.INTERVAL);

    follower.start();
    appendFileSync(path, Buffer.from("Ubuntu (Default)\r\n", "utf16le"));
    await TaskOutputFollowerTests.tick(timer);
    const open = pieces.join("");
    appendFileSync(path, "done\n");
    await TaskOutputFollowerTests.tick(timer);
    follower.finish();

    Assert.areEqual(TaskOutputReader.readTail(path), pieces.join(""));
    Assert.areEqual("wsl:\nUbuntu (Defaul", open);
    Assert.areEqual("wsl:\nUbuntu (Default)\r\ndone\n", pieces.join(""));
  }

  @TestMethod
  public async sendsWhatTheEndOfTheFileReadGivesWhereverReadsSplitUtf16Output(): Promise<void> {
    using directory = new TemporaryDirectory();
    const failures: string[] = [];
    let index = 0;
    for (const bytes of TaskOutputFollowerTests.utf16Samples()) {
      index += 1;
      for (const idle of [false, true]) {
        const pause = idle ? " with a pause" : String.empty;
        const byByte = directory.resolve(`${index}-bytes${pause}.output`);
        if (await TaskOutputFollowerTests.followByByte(byByte, bytes, idle) !== TaskOutputReader.readTail(byByte))
          failures.push(`${index} byte by byte${pause}`);
        for (let split = 1; split < bytes.length; split++) {
          const path = directory.resolve(`${index}-${split}${pause}.output`);
          if (await TaskOutputFollowerTests.followInTwo(path, bytes, split, idle) !== TaskOutputReader.readTail(path))
            failures.push(`${index} split at ${split}${pause}`);
        }
      }
    }

    Assert.areEqual("[]", JSON.stringify(failures));
    Assert.areEqual("ok\n50% done\r\nok\n", TaskOutputReader.readTail(directory.resolve("1-bytes.output")));
  }

  @TestMethod
  public async sendsWhatTheEndOfTheFileReadGivesWhenUtf16OutputPausesBetweenItsPieces(): Promise<void> {
    using directory = new TemporaryDirectory();
    const little = (text: string): Buffer => Buffer.from(text, "utf16le");
    const cases: [string, readonly Buffer[], string][] = [
      ["a byte order mark alone", [Buffer.from([0xFF, 0xFE]), little("hello world\r\n")], "hello world\r\n"],
      ["a progress dot at a time", [...Array.from({ length: 6 }, () => little(".")), little(" done\r\n")], "...... done\r\n"],
      ["UTF-8 then UTF-16", [Buffer.from("Ubuntu\r\n"), little("OK\r\n")], "Ubuntu\r\nOK\r\n"],
      ["a UTF-16 line in pieces", [little("hello"), little(" world"), little("!")], "hello world!"],
      ["a short run after a byte order mark", [Buffer.concat([Buffer.from([0xFF, 0xFE]), little("ab")]), little("cd")], "abcd"]
    ];
    const shown: string[] = [];
    for (const [name, parts] of cases) {
      const path = directory.resolve(`${shown.length}.output`);
      writeFileSync(path, "");
      const timer = new ManualTimer();
      const pieces: string[] = [];
      const follower = new TaskOutputFollower(path, text => pieces.push(text), timer, TaskOutputFollowerTests.INTERVAL);
      follower.start();
      for (const part of parts) {
        appendFileSync(path, part);
        await TaskOutputFollowerTests.tick(timer);
        await TaskOutputFollowerTests.tick(timer);
      }
      follower.finish();
      shown.push(`${name}: ${JSON.stringify(pieces.join(""))}, ${JSON.stringify(TaskOutputReader.readTail(path))}`);
    }

    Assert.areEqual(cases.map(([name, , expected]) => `${name}: ${JSON.stringify(expected)}, ${JSON.stringify(expected)}`).join("\n"), shown.join("\n"));
  }

  @TestMethod
  public async sendsAUtf16RunItHeldBackOnceAReadFindsNothingNew(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("held.output");
    writeFileSync(path, Buffer.concat([Buffer.from("ok\n"), Buffer.from("done\r\n", "utf16le")]));
    const timer = new ManualTimer();
    const pieces: string[] = [];
    const follower = new TaskOutputFollower(path, text => pieces.push(text), timer, TaskOutputFollowerTests.INTERVAL);
    try {
      follower.start();
      const first = JSON.stringify(pieces);
      await TaskOutputFollowerTests.tick(timer);

      Assert.areEqual(JSON.stringify(["ok\n"]), first);
      Assert.areEqual(JSON.stringify(["ok\n", "done\r\n"]), JSON.stringify(pieces));
    }
    finally { follower.stop(); }
  }

  @TestMethod
  public async sendsUtf16OutputWhoseByteOrderMarkArrivesAfterAnEmptyStart(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("marked.output");
    writeFileSync(path, "");
    const timer = new ManualTimer();
    const pieces: string[] = [];
    const follower = new TaskOutputFollower(path, text => pieces.push(text), timer, TaskOutputFollowerTests.INTERVAL);

    follower.start();
    appendFileSync(path, Buffer.from([0xFF, 0xFE]));
    await TaskOutputFollowerTests.tick(timer);
    const marked = pieces.length;
    appendFileSync(path, Buffer.from("hi there\n", "utf16le"));
    await TaskOutputFollowerTests.tick(timer);
    follower.finish();

    Assert.areEqual(0, marked);
    Assert.areEqual(TaskOutputReader.readTail(path), pieces.join(""));
    Assert.areEqual("hi there\n", pieces.join(""));
  }

  @TestMethod
  public tellsWhetherAPathNamesTheFileItRead(): void {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("named.output");
    const other = directory.resolve("other.output");
    writeFileSync(path, "named\n");
    writeFileSync(other, "other\n");
    const follower = new TaskOutputFollower(path, () => undefined, new ManualTimer(), TaskOutputFollowerTests.INTERVAL);

    const unread = follower.reads(path);
    follower.finish();

    Assert.isFalse(unread);
    Assert.isTrue(follower.reads(path));
    Assert.isFalse(follower.reads(other));
    Assert.isFalse(follower.reads(directory.resolve("missing.output")));
  }

  @TestMethod
  public async sendsNothingOnceStoppedAndTheRestWithACutCharacterOnceFinished(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("ended.output");
    writeFileSync(path, "running\n");
    const timer = new ManualTimer();
    const pieces: string[] = [];
    const follower = new TaskOutputFollower(path, text => pieces.push(text), timer, TaskOutputFollowerTests.INTERVAL);

    follower.start();
    follower.stop();
    appendFileSync(path, Buffer.from([0x64, 0x6F, 0x6E, 0x65, 0xC3]));
    timer.advance(TaskOutputFollowerTests.INTERVAL);
    await TaskOutputFollowerTests.settle();
    const stopped = JSON.stringify(pieces);
    const pending = timer.pending;
    follower.finish();

    Assert.isFalse(follower.isFollowing);
    Assert.areEqual(0, pending);
    Assert.areEqual(JSON.stringify(["running\n"]), stopped);
    Assert.areEqual(TaskOutputReader.readTail(path), pieces.join(""));
    Assert.areEqual(JSON.stringify(["running\n", "done", "�"]), JSON.stringify(pieces));
  }

  @TestMethod
  public async readsNothingMoreWhenStoppedAsItsTimerElapses(): Promise<void> {
    using directory = new TemporaryDirectory();
    const path = directory.resolve("raced.output");
    writeFileSync(path, "a\n");
    const timer = new ManualTimer();
    const pieces: string[] = [];
    const follower = new TaskOutputFollower(path, text => pieces.push(text), timer, TaskOutputFollowerTests.INTERVAL);

    follower.start();
    appendFileSync(path, "b\n");
    timer.advance(TaskOutputFollowerTests.INTERVAL);
    follower.stop();
    await TaskOutputFollowerTests.settle();

    Assert.areEqual(0, timer.pending);
    Assert.areEqual(JSON.stringify(["a\n"]), JSON.stringify(pieces));
  }

  private static async tick(timer: ManualTimer): Promise<void> {
    timer.advance(TaskOutputFollowerTests.INTERVAL);
    await TaskOutputFollowerTests.settle();
  }

  private static async followByByte(path: string, bytes: Buffer, idle: boolean): Promise<string> {
    writeFileSync(path, "");
    const timer = new ManualTimer();
    const pieces: string[] = [];
    const follower = new TaskOutputFollower(path, text => pieces.push(text), timer, TaskOutputFollowerTests.INTERVAL);
    follower.start();
    for (const byte of bytes) {
      appendFileSync(path, Buffer.from([byte]));
      await TaskOutputFollowerTests.tick(timer);
      if (idle)
        await TaskOutputFollowerTests.tick(timer);
    }
    follower.finish();
    return pieces.join("");
  }

  private static async followInTwo(path: string, bytes: Buffer, split: number, idle: boolean): Promise<string> {
    writeFileSync(path, bytes.subarray(0, split));
    const timer = new ManualTimer();
    const pieces: string[] = [];
    const follower = new TaskOutputFollower(path, text => pieces.push(text), timer, TaskOutputFollowerTests.INTERVAL);
    follower.start();
    if (idle)
      await TaskOutputFollowerTests.tick(timer);
    appendFileSync(path, bytes.subarray(split));
    await TaskOutputFollowerTests.tick(timer);
    if (idle)
      await TaskOutputFollowerTests.tick(timer);
    follower.finish();
    return pieces.join("");
  }

  private static utf16Samples(): Buffer[] {
    const little = (text: string): Buffer => Buffer.from(text, "utf16le");
    const big = (text: string): Buffer => Buffer.from(text, "utf16le").swap16();
    return [
      Buffer.concat([Buffer.from("ok\n"), little("50% done\r\n"), Buffer.from("ok\n")]),
      Buffer.concat([Buffer.from([0xFF, 0xFE]), little("hi there\r\n")]),
      Buffer.concat([Buffer.from([0xFE, 0xFF]), big("hi there\r\n")]),
      big("hi there\r\n"),
      Buffer.concat([Buffer.from("ok\n"), little("ab"), Buffer.from("x")]),
      Buffer.concat([Buffer.from("ok\n"), little("abcd")])
    ];
  }

  private static settle(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve));
  }
}
