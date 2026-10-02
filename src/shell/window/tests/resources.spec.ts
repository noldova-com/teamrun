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
    expect(Resources.formatModuleDetails("clock", "Failed", "Its runtime part failed to activate.")).toBe("clock: Failed: Its runtime part failed to activate.");
    expect(Resources.formatModuleDetails("clock", "Active", null)).toBe("clock: Active");
  });

  it("accepts contribution names of the form <module id>.<name> only", () => {
    const valid = ["files.tree", "shell.settings", "git-history.log", "a1.b.c_d-e"];
    const invalid = ["files", ".tree", "Files.tree", "files.", "files..tree", "git--log.x", "files.tree view"];

    expect(valid.filter(t => !Resources.contributionNamePattern.test(t))).toEqual([]);
    expect(invalid.filter(t => Resources.contributionNamePattern.test(t))).toEqual([]);
  });
});
