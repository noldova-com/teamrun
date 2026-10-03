/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DesktopLog } from "@noldova/teamrun-shell-desktop";
import { DataDirectory, DiagnosticRedactor } from "@noldova/teamrun-shell-runtime";

import { FakeDesktopProcess } from "../fixtures/fake-desktop-process.fixture.js";

@TestClass
export class DesktopLogTests {
  private static readonly MOMENT: Date = new Date("2026-10-02T23:40:01.250Z");
  private static readonly TOKEN: string = "a1B2_c3D4-".repeat(4);

  @TestMethod
  public async stampsAndRedactsEveryLineAndKeepsItOnStandardErrorOnlyUntilTheFileOpens(): Promise<void> {
    await DesktopLogTests.runAsync(async (folder, directory) => {
      const process = new FakeDesktopProcess("linux");
      const log = new DesktopLog(directory, process.errorOutput, new DiagnosticRedactor(folder), () => DesktopLogTests.MOMENT);

      log.write("Before the file.");
      log.open();
      log.write(`Saved in ${path.join(folder, "notes")} with ${DesktopLogTests.TOKEN}.`);

      const later = `2026-10-02T23:40:01.250Z Saved in ${path.join("~", "notes")} with [redacted].\n`;
      Assert.areEqual(`2026-10-02T23:40:01.250Z Before the file.\n${later}`, process.errors);
      Assert.areEqual(later, await readFile(directory.desktopLog, "utf8"));
    });
  }

  @TestMethod
  public async keepsExactlyOnePreviousLogAndStartsOnlyOncePerDesktop(): Promise<void> {
    await DesktopLogTests.runAsync(async (folder, directory) => {
      for (const start of ["first", "second", "third"]) {
        const log = new DesktopLog(directory, new FakeDesktopProcess("linux").errorOutput, new DiagnosticRedactor(folder), () => DesktopLogTests.MOMENT);
        log.open();
        log.write(start);
        log.open();
        log.write(`${start} again`);
      }

      Assert.areEqual("desktop.log,desktop.previous.log", (await readdir(directory.logsFolder)).sort().join(","));
      Assert.areEqual("2026-10-02T23:40:01.250Z third\n2026-10-02T23:40:01.250Z third again\n", await readFile(directory.desktopLog, "utf8"));
      Assert.areEqual("2026-10-02T23:40:01.250Z second\n2026-10-02T23:40:01.250Z second again\n", await readFile(directory.previousDesktopLog, "utf8"));
    });
  }

  @TestMethod
  public async becomesThePreviousLogInsteadOfPassingItsSizeLimit(): Promise<void> {
    await DesktopLogTests.runAsync(async (folder, directory) => {
      const log = new DesktopLog(directory, new FakeDesktopProcess("linux").errorOutput, new DiagnosticRedactor(folder), () => DesktopLogTests.MOMENT);
      log.open();

      for (let i = 0; i < 5; i++)
        log.write(`${i}${"word ".repeat(60000)}`);

      Assert.isTrue((await stat(directory.desktopLog)).size <= 1048576);
      Assert.isTrue((await readFile(directory.desktopLog, "utf8")).includes(" 4word"));
      Assert.isTrue((await readFile(directory.previousDesktopLog, "utf8")).includes(" 3word"));
    });
  }

  @TestMethod
  public async writesToStandardErrorOnlyWhenTheDirectoryIsNotUsable(): Promise<void> {
    await DesktopLogTests.runAsync(async folder => {
      const missing = new DataDirectory(path.join(folder, "missing"));
      const blocked = new DataDirectory(path.join(folder, "blocked"));
      await mkdir(blocked.root);
      await writeFile(blocked.logsFolder, "");
      const missingProcess = new FakeDesktopProcess("linux");
      const blockedProcess = new FakeDesktopProcess("linux");
      const missingLog = new DesktopLog(missing, missingProcess.errorOutput, new DiagnosticRedactor(folder));
      const blockedLog = new DesktopLog(blocked, blockedProcess.errorOutput, new DiagnosticRedactor(folder));

      missingLog.open();
      blockedLog.open();
      missingLog.write("Still recorded.");

      Assert.isFalse(existsSync(missing.root));
      Assert.areEqual(2, missingProcess.errors.split("\n").length - 1);
      Assert.isTrue(missingProcess.errors.includes(" The desktop's log could not be written, so its records go to standard error only: Error: "));
      Assert.isTrue(missingProcess.errors.endsWith(" Still recorded.\n"));
      Assert.isTrue(blockedProcess.errors.includes(" The desktop's log could not be written, so its records go to standard error only: Error: "));
    });
  }

  @TestMethod
  public async goesOnOnStandardErrorWhenTheFileCanNoLongerBeWritten(): Promise<void> {
    await DesktopLogTests.runAsync(async (folder, directory) => {
      const process = new FakeDesktopProcess("linux");
      const log = new DesktopLog(directory, process.errorOutput, new DiagnosticRedactor(folder));
      log.open();
      await rm(directory.logsFolder, { recursive: true });

      log.write("Lost from the file.");
      log.write("Only on standard error.");

      Assert.isFalse(existsSync(directory.logsFolder));
      const lines = process.errors.trimEnd().split("\n").map(t => t.slice(t.indexOf(" ") + 1));
      Assert.areEqual("Lost from the file.", lines[0]);
      Assert.isTrue(lines[1]?.startsWith("The desktop's log could not be written, so its records go to standard error only: Error: ") === true);
      Assert.areEqual("Only on standard error.", lines[2]);
      Assert.areEqual(3, lines.length);
    });
  }

  private static async runAsync(test: (folder: string, directory: DataDirectory) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(os.tmpdir(), "teamrun-desktop-log-"));
    try {
      const directory = new DataDirectory(path.join(folder, "data"));
      await mkdir(directory.root);
      await test(folder, directory);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
