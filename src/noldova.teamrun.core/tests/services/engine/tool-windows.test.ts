/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Resources, ToolWindows, TurnDetail } from "@noldova/teamrun.core";
import { DetailKind } from "@noldova/teamrun.protocol";

import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class ToolWindowsTests {
  private static readonly start: number = Date.now() + 24 * 60 * 60 * 1_000;
  private static readonly step: number = 60_000;

  @TestMethod
  public countsAFileWrittenWhileAStepRanOrWithinTheSlackOfItsEnds(): void {
    using directory = new TemporaryDataDirectory();
    const windows = new ToolWindows();
    windows.note(ToolWindowsTests.command("c1", { status: "inProgress" }), ToolWindowsTests.at(1));
    windows.note(ToolWindowsTests.command("c1", { status: "completed" }), ToolWindowsTests.at(2));
    const slack = Resources.toolWindowSlackMilliseconds;

    Assert.isTrue(ToolWindowsTests.covers(windows, directory.path, ToolWindowsTests.at(1) + ToolWindowsTests.step / 2));
    Assert.isTrue(ToolWindowsTests.covers(windows, directory.path, ToolWindowsTests.at(1) - slack + 500));
    Assert.isTrue(ToolWindowsTests.covers(windows, directory.path, ToolWindowsTests.at(2) + slack - 500));
    Assert.isFalse(ToolWindowsTests.covers(windows, directory.path, ToolWindowsTests.at(1) - slack - 1_000));
    Assert.isFalse(ToolWindowsTests.covers(windows, directory.path, ToolWindowsTests.at(2) + slack + 1_000));
  }

  @TestMethod
  public endsAClaudeStepWhenANoteWithItsToolUseComesAndAPiStepWhenItCarriesItsOutput(): void {
    using directory = new TemporaryDataDirectory();
    const windows = new ToolWindows();
    windows.note(ToolWindowsTests.command("claude-1", { tool: "Bash", toolUseId: "use-1" }), ToolWindowsTests.at(1));
    windows.note(new TurnDetail(DetailKind.Note, "result", { toolUseId: "use-1" }, "claude-1-result"), ToolWindowsTests.at(2));
    windows.note(new TurnDetail(DetailKind.Note, "result", { toolUseId: "unknown" }, null), ToolWindowsTests.at(3));
    windows.note(new TurnDetail(DetailKind.Note, "plain", null, null), ToolWindowsTests.at(3));
    windows.note(ToolWindowsTests.command("pi-1", { tool: "bash", toolUseId: "pi-1" }), ToolWindowsTests.at(4));
    windows.note(ToolWindowsTests.command("pi-1", { tool: "bash", toolUseId: "pi-1", output: String.empty }), ToolWindowsTests.at(5));
    windows.close(ToolWindowsTests.at(9));

    Assert.isFalse(ToolWindowsTests.covers(windows, directory.path, ToolWindowsTests.at(3)));
    Assert.isFalse(ToolWindowsTests.covers(windows, directory.path, ToolWindowsTests.at(6)));
    Assert.isTrue(ToolWindowsTests.covers(windows, directory.path, ToolWindowsTests.at(4)));
  }

  @TestMethod
  public opensNoWindowForAStepCodexMarksReadOnlyNorForOtherKindsOfStep(): void {
    using directory = new TemporaryDataDirectory();
    const windows = new ToolWindows();
    windows.note(ToolWindowsTests.command("read", { status: "inProgress", readOnly: true }), ToolWindowsTests.at(1));
    windows.note(new TurnDetail(DetailKind.Text, "text", null, "text"), ToolWindowsTests.at(1));
    windows.note(new TurnDetail(DetailKind.Reasoning, "thinking", null, "thinking"), ToolWindowsTests.at(1));
    windows.close(ToolWindowsTests.at(9));

    Assert.isFalse(ToolWindowsTests.covers(windows, directory.path, ToolWindowsTests.at(2)));
  }

  @TestMethod
  public opensAWindowForAToolStepReportedAsANote(): void {
    using directory = new TemporaryDataDirectory();
    const windows = new ToolWindows();
    windows.note(new TurnDetail(DetailKind.Note, "move", { tool: "move", status: "in_progress" }, "acp-tool-1"), ToolWindowsTests.at(1));
    windows.note(new TurnDetail(DetailKind.Note, "move", { tool: "move", status: "completed" }, "acp-tool-1"), ToolWindowsTests.at(2));
    windows.note(new TurnDetail(DetailKind.Note, "fs/write_file", { server: "fs", tool: "write_file", status: "inProgress" }, "codex-1"),
      ToolWindowsTests.at(4));
    windows.note(new TurnDetail(DetailKind.Note, "fs/write_file", { server: "fs", tool: "write_file", status: "completed" }, "codex-1"),
      ToolWindowsTests.at(5));
    windows.note(new TurnDetail(DetailKind.Note, "write", { tool: "mcp__fs__write_file", input: {}, toolUseId: "use-1" }, "claude-1"),
      ToolWindowsTests.at(7));
    windows.note(new TurnDetail(DetailKind.Note, "done", { toolUseId: "use-1", isError: false }, "claude-1-result"), ToolWindowsTests.at(8));
    windows.close(ToolWindowsTests.at(12));

    for (const inside of [1, 4, 7])
      Assert.isTrue(ToolWindowsTests.covers(windows, directory.path, ToolWindowsTests.at(inside) + ToolWindowsTests.step / 2));
    for (const outside of [3, 6, 10])
      Assert.isFalse(ToolWindowsTests.covers(windows, directory.path, ToolWindowsTests.at(outside)));
  }

  @TestMethod
  public timesAFileByItsStatusChangeWhenItIsLaterThanItsModifiedTime(): void {
    using directory = new TemporaryDataDirectory();
    const windows = new ToolWindows();
    const now = Date.now();
    windows.start("mv", now - 60_000);
    const path = join(directory.path, "moved.txt");
    writeFileSync(path, "x\n");
    const old = new Date(now - 24 * 60 * 60 * 1_000);
    utimesSync(path, old, old);

    Assert.isTrue(windows.covers(path, directory.path));
    windows.end("mv", now - 30_000);
    Assert.isFalse(windows.covers(path, directory.path));
  }

  @TestMethod
  public countsAPathAToolStepReportedAsTheToolsWhateverItsTimes(): void {
    using directory = new TemporaryDataDirectory();
    const root = directory.path;
    const windows = new ToolWindows();
    windows.note(ToolWindowsTests.command("mv", { command: "mv old.txt moved/new.txt", writes: ["old.txt", "moved/new.txt"], unnamedWrites: [] }),
      ToolWindowsTests.at(1));
    windows.note(new TurnDetail(DetailKind.Note, "delete", { tool: "delete", status: "completed", files: [join(root, "build"), 7, "relative.txt"] }, "acp-1"),
      ToolWindowsTests.at(1));
    windows.close(ToolWindowsTests.at(2));
    const at = (name: string): string => {
      const path = join(root, name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, "x");
      const old = new Date(ToolWindowsTests.at(8));
      utimesSync(path, old, old);
      return path;
    };

    for (const name of ["old.txt", join("moved", "new.txt"), join("build", "out", "a.js"), "relative.txt"])
      Assert.isTrue(windows.covers(at(name), root));
    Assert.isFalse(windows.covers(at("other.txt"), root));
    Assert.isFalse(windows.covers(at("build.txt"), root));
  }

  @TestMethod
  public countsNothingUnderAReportedPathAtOrAboveTheChatsFolder(): void {
    using directory = new TemporaryDataDirectory();
    const root = join(directory.path, "repo");
    const windows = new ToolWindows();
    windows.note(ToolWindowsTests.command("w", { command: "touch .", writes: ["."], unnamedWrites: [] }), ToolWindowsTests.at(1));
    windows.note(new TurnDetail(DetailKind.Note, "edit", { tool: "edit", status: "completed", files: [root, directory.path, join(root, "own.txt")] }, "acp-1"),
      ToolWindowsTests.at(1));
    windows.close(ToolWindowsTests.at(2));
    const at = (name: string): string => {
      const path = join(root, name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, "x");
      const old = new Date(ToolWindowsTests.at(8));
      utimesSync(path, old, old);
      return path;
    };

    Assert.isTrue(windows.covers(at("own.txt"), root));
    Assert.isFalse(windows.covers(at("pulled.txt"), root));
    Assert.isFalse(windows.covers(at(join("src", "pulled.ts")), root));
  }

  @TestMethod
  public keepsATerminalStepOrABackgroundCommandOpenUntilTheTurnEnds(): void {
    using directory = new TemporaryDataDirectory();
    const terminal = new ToolWindows();
    terminal.note(ToolWindowsTests.command("t1", { terminalId: "terminal", status: "completed" }), ToolWindowsTests.at(1));
    const background = new ToolWindows();
    background.note(ToolWindowsTests.command("b1", { tool: "Bash", input: { command: "npm run watch", run_in_background: true }, toolUseId: "use-b1" }),
      ToolWindowsTests.at(1));
    background.note(new TurnDetail(DetailKind.Note, "started", { toolUseId: "use-b1" }, null), ToolWindowsTests.at(2));

    Assert.isTrue(ToolWindowsTests.covers(terminal, directory.path, ToolWindowsTests.at(5)));
    terminal.close(ToolWindowsTests.at(6));
    background.close(ToolWindowsTests.at(6));
    Assert.isTrue(ToolWindowsTests.covers(terminal, directory.path, ToolWindowsTests.at(5)));
    Assert.isTrue(ToolWindowsTests.covers(background, directory.path, ToolWindowsTests.at(5)));
    Assert.isFalse(ToolWindowsTests.covers(background, directory.path, ToolWindowsTests.at(7)));
  }

  @TestMethod
  public keepsAStepClosedWhenItIsReportedAgainAndTimesAStepWithoutIdsUntilTheTurnEnds(): void {
    using directory = new TemporaryDataDirectory();
    const windows = new ToolWindows();
    windows.note(ToolWindowsTests.command("c1", { status: "completed" }), ToolWindowsTests.at(1));
    windows.note(ToolWindowsTests.command("c1", { status: "inProgress" }), ToolWindowsTests.at(3));
    windows.note(new TurnDetail(DetailKind.FileChange, "edit", null, null), ToolWindowsTests.at(5));
    windows.note(new TurnDetail(DetailKind.Command, "ls", ["ls"], null), ToolWindowsTests.at(7));
    windows.close(ToolWindowsTests.at(8));

    Assert.isFalse(ToolWindowsTests.covers(windows, directory.path, ToolWindowsTests.at(4)));
    Assert.isTrue(ToolWindowsTests.covers(windows, directory.path, ToolWindowsTests.at(6)));
    Assert.isFalse(ToolWindowsTests.covers(windows, directory.path, ToolWindowsTests.at(9)));
  }

  @TestMethod
  public timesABackgroundTaskFromItsStartToItsEnd(): void {
    using directory = new TemporaryDataDirectory();
    const windows = new ToolWindows();
    windows.end("task:never", ToolWindowsTests.at(1));
    windows.start("task:1", ToolWindowsTests.at(2));
    windows.start("task:1", ToolWindowsTests.at(3));

    Assert.isTrue(ToolWindowsTests.covers(windows, directory.path, ToolWindowsTests.at(4)));
    Assert.isFalse(ToolWindowsTests.covers(windows, directory.path, ToolWindowsTests.at(1)));
    windows.end("task:1", ToolWindowsTests.at(4));
    Assert.isTrue(ToolWindowsTests.covers(windows, directory.path, ToolWindowsTests.at(2) + ToolWindowsTests.step / 2));
    Assert.isFalse(ToolWindowsTests.covers(windows, directory.path, ToolWindowsTests.at(5)));
  }

  @TestMethod
  public timesAGoneFileByItsNearestFolderAndCountsAFileItCantTimeAsTheTools(): void {
    using directory = new TemporaryDataDirectory();
    const root = join(directory.path, "repo");
    mkdirSync(join(root, "src"), { recursive: true });
    const windows = new ToolWindows();
    windows.start("c1", ToolWindowsTests.at(1));
    windows.end("c1", ToolWindowsTests.at(2));
    const inside = new Date(ToolWindowsTests.at(1) + ToolWindowsTests.step / 2);
    const later = new Date(ToolWindowsTests.at(5));
    utimesSync(join(root, "src"), inside, inside);
    utimesSync(root, later, later);

    Assert.isTrue(windows.covers(join(root, "src", "gone", "deleted.txt"), root));
    writeFileSync(join(root, "src", "was-folder"), "now a file\n");
    utimesSync(join(root, "src", "was-folder"), inside, inside);
    utimesSync(join(root, "src"), inside, inside);
    utimesSync(root, later, later);
    Assert.isTrue(windows.covers(join(root, "src", "was-folder", "deleted.txt"), root));
    Assert.isTrue(windows.covers(join(root, "src", `bad${String.fromCharCode(0)}name`, "deleted.txt"), root));
    Assert.isFalse(windows.covers(join(root, "deleted.txt"), root));
    Assert.isTrue(windows.covers(join(directory.path, "missing", "deleted.txt"), join(directory.path, "missing")));
  }

  private static at(index: number): number {
    return ToolWindowsTests.start + index * ToolWindowsTests.step;
  }

  private static command(id: string, payload: JsonValue): TurnDetail {
    return new TurnDetail(DetailKind.Command, "command", payload, id);
  }

  private static covers(windows: ToolWindows, folder: string, writtenAt: number): boolean {
    const path = join(folder, "written.txt");
    writeFileSync(path, "x\n");
    const time = new Date(writtenAt);
    utimesSync(path, time, time);
    return windows.covers(path, folder);
  }
}
