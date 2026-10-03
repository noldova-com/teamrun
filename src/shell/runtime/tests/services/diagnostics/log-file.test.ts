/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DiagnosticRedactor, LogFile } from "@noldova/teamrun-shell-runtime";

import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class LogFileTests {
  private static readonly MOMENT: Date = new Date("2026-10-02T23:40:01.250Z");
  private static readonly STAMP: string = "2026-10-02T23:40:01.250Z";
  private static readonly LIMIT: number = 160;

  @TestMethod
  public stampsRedactsAndEndsEveryRecord(): void {
    const log = new LogFile("log", "previous", new DiagnosticRedactor("/home/person"), () => LogFileTests.MOMENT);

    Assert.areEqual(`${LogFileTests.STAMP} in ~/notes with [redacted]\nand more\n`, log.format(`in /home/person/notes with ${"a1B2_c3D4-".repeat(4)}\nand more`));
  }

  @TestMethod
  public cutsARecordToAQuarterOfTheLimit(): void {
    const log = new LogFile("log", "previous", new DiagnosticRedactor("/home/person"), () => LogFileTests.MOMENT, LogFileTests.LIMIT);

    const line = log.format("word ".repeat(LogFileTests.LIMIT));

    Assert.areEqual(LogFileTests.LIMIT / 4, line.length);
    Assert.isTrue(line.startsWith(`${LogFileTests.STAMP} word`));
    Assert.isTrue(line.endsWith("word\n"));
  }

  @TestMethod
  public cutsAMultibyteRecordUnderItsByteLimitAtACharacterBoundary(): void {
    const log = new LogFile("log", "previous", new DiagnosticRedactor("/home/person"), () => LogFileTests.MOMENT, LogFileTests.LIMIT);

    const euros = log.format("€ ".repeat(LogFileTests.LIMIT));
    const faces = log.format("😀 ".repeat(LogFileTests.LIMIT));

    Assert.areEqual(`${LogFileTests.STAMP} € € € \n`, euros);
    Assert.areEqual(`${LogFileTests.STAMP} 😀 😀 😀\n`, faces);
    Assert.isTrue(Buffer.byteLength(euros) <= LogFileTests.LIMIT / 4);
    Assert.isTrue(Buffer.byteLength(faces) <= LogFileTests.LIMIT / 4);
  }

  @TestMethod
  public becomesThePreviousFileInsteadOfPassingItsLimit(): Promise<void> {
    return LogFileTests.runAsync(async (log, file, previous) => {
      const lines = Array.from({ length: 9 }, (_, i) => log.format(`record ${i + 1}`));
      Assert.areEqual(34, lines[0]?.length);
      log.open();

      for (const line of lines) {
        log.append(line);
        Assert.isTrue((await stat(file)).size <= LogFileTests.LIMIT);
      }

      Assert.areEqual(lines.slice(8).join(""), await readFile(file, "utf8"));
      Assert.areEqual(lines.slice(4, 8).join(""), await readFile(previous, "utf8"));
    });
  }

  @TestMethod
  public keepsTheFileAndThrowsWhenThePreviousCannotBeReplaced(): Promise<void> {
    return LogFileTests.runAsync(async (log, file, previous) => {
      const lines = Array.from({ length: 5 }, (_, i) => log.format(`record ${i + 1}`));
      log.open();
      for (const line of lines.slice(0, 4))
        log.append(line);
      await mkdir(path.join(previous, "held"), { recursive: true });

      Assert.throws(() => log.append(lines[4] ?? ""), Error);
      Assert.throws(() => log.open(), Error);

      Assert.areEqual(lines.slice(0, 4).join(""), await readFile(file, "utf8"));
    });
  }

  @TestMethod
  public replacesTheExistingFileWhenOpened(): Promise<void> {
    return LogFileTests.runAsync(async (log, file, previous) => {
      await writeFile(previous, "oldest\n");
      await writeFile(file, "older\n");

      log.open();

      Assert.areEqual("", await readFile(file, "utf8"));
      Assert.areEqual("older\n", await readFile(previous, "utf8"));
    });
  }

  private static async runAsync(test: (log: LogFile, file: string, previous: string) => Promise<void>): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "app.log");
    const previous = path.join(folder.path, "app.previous.log");
    await test(new LogFile(file, previous, new DiagnosticRedactor("/home/person"), () => LogFileTests.MOMENT, LogFileTests.LIMIT), file, previous);
  }
}
