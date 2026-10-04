/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFile } from "node:fs/promises";
import { uptime } from "node:os";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ProcessClock } from "@noldova/teamrun-shell-runtime";

import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class ProcessClockTests {
  private static readonly BOOT_ID: string = "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";

  @TestMethod
  public async countsFromBootAndNamesTheBootByTheKernelsIdOnLinux(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "boot_id");
    await writeFile(file, `${ProcessClockTests.BOOT_ID}\n`);

    const clock = ProcessClock.create("linux", file);
    const before = uptime() * 1000;
    const now = clock.now();
    const after = uptime() * 1000;

    Assert.areEqual(ProcessClockTests.BOOT_ID, clock.boot);
    Assert.isTrue(now >= Math.round(before) && now <= Math.round(after), `${before} ${now} ${after}`);
    Assert.isTrue(clock.isSameBoot(ProcessClockTests.BOOT_ID));
    Assert.isFalse(clock.isSameBoot("7f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b"));
    Assert.isFalse(clock.isSameBoot(String(Number.NaN)));
  }

  @TestMethod
  public usesTheWallClockAndNamesTheBootByWhenTheSystemStartedElsewhere(): void {
    const before = Date.now();
    const clock = ProcessClock.create("win32");
    const now = clock.now();
    const boot = Number(clock.boot);

    Assert.isTrue(now >= before && now <= Date.now());
    Assert.isTrue(Math.abs(boot - (before / 1000 - uptime())) <= 2, clock.boot);
    Assert.isTrue(clock.isSameBoot(String(boot + 60)));
    Assert.isTrue(clock.isSameBoot(String(boot - 60)));
    Assert.isFalse(clock.isSameBoot(String(boot + 61)));
    Assert.isFalse(clock.isSameBoot(ProcessClockTests.BOOT_ID));
  }

  @TestMethod
  public async notesNoOffsetForAClockThatCountsFromBootOnLinux(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "boot_id");
    await writeFile(file, ProcessClockTests.BOOT_ID);

    const clock = ProcessClock.create("linux", file);

    Assert.areEqual(0, clock.offset());
    Assert.isFalse(clock.hasStepped(0));
    Assert.isFalse(clock.hasStepped(1_500));
    Assert.isTrue(clock.hasStepped(1_501));
    Assert.isTrue(clock.hasStepped(-1_501));
  }

  @TestMethod
  public notesHowFarTheWallClockIsFromTheTimeSinceBootElsewhere(): void {
    const clock = ProcessClock.create("win32");

    const expected = Date.now() - uptime() * 1000;
    const offset = clock.offset();

    Assert.areEqual(offset, Math.round(offset));
    Assert.isTrue(Math.abs(offset - expected) <= 50, `${offset} ${expected}`);
    Assert.isFalse(clock.hasStepped(offset));
    Assert.isTrue(clock.hasStepped(offset + 5_000));
    Assert.isTrue(clock.hasStepped(offset - 5_000));
  }
}
