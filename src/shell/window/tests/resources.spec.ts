/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../src/resources";

describe("Resources", () => {
  it("formats the unregistered-view and unsupported-version messages", () => {
    expect(Resources.formatUnregisteredView("files.tree")).toBe("No view named \"files.tree\" is registered.");
    expect(Resources.formatUnsupportedVersion(2)).toBe("Layout format version 2 is not supported; this build reads version 1.");
    expect(Resources.formatDraggedTab("Files")).toBe("Moving Files");
    expect(Resources.formatForeignDocument("notes", "clock.face")).toBe("The module \"notes\" can open only its own documents, not \"clock.face\".");
    expect(Resources.formatUnregisteredDocument("notes.page")).toBe("No document named \"notes.page\" is registered.");
  });

  it("formats the modules that didn't start and their details, with or without a cause", () => {
    expect(Resources.formatModulesDidNotStart(1)).toBe("1 module didn't start");
    expect(Resources.formatModulesDidNotStart(3)).toBe("3 modules didn't start");
    expect(Resources.formatModuleDidNotStart("Clock")).toBe("Clock didn't start");
    expect(Resources.formatBuildDetails("1.2.3", "abc123")).toBe("TeamRun 1.2.3, build abc123");
    expect(Resources.formatModuleDetails("clock", "0.4.0", "Failed", "Its runtime part failed to activate.")).toBe("clock 0.4.0: Failed: Its runtime part failed to activate.");
    expect(Resources.formatModuleDetails("clock", "0.4.0", "Active", null)).toBe("clock 0.4.0: Active");
  });

  it("formats how long a program has run in minutes, hours and days, its start, its process and a module's count of programs", () => {
    expect([0, 3, 59, 60, 90, 1439, 1440, 1500].map(t => Resources.formatRunningFor(t))).toEqual([
      "Running for less than a minute", "Running for 3 min", "Running for 59 min", "Running for 1 h", "Running for 1 h 30 min",
      "Running for 23 h 59 min", "Running for 1 d", "Running for 1 d 1 h"
    ]);
    expect([Resources.formatProgramStarted("Oct 6, 2026, 8:00 AM"), Resources.formatProcessId(4210)]).toEqual(["Started Oct 6, 2026, 8:00 AM", "Process 4210"]);
    expect([Resources.formatProgramCount(1), Resources.formatProgramCount(2)]).toEqual(["1 program", "2 programs"]);
  });

  it("accepts contribution names of the form <module id>.<name> only", () => {
    const valid = ["files.tree", "shell.settings", "git-history.log", "a1.b.c_d-e"];
    const invalid = ["files", ".tree", "Files.tree", "files.", "files..tree", "git--log.x", "files.tree view"];

    expect(valid.filter(t => !Resources.contributionNamePattern.test(t))).toEqual([]);
    expect(invalid.filter(t => Resources.contributionNamePattern.test(t))).toEqual([]);
  });
});
