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
  });

  it("accepts contribution names of the form <module id>.<name> only", () => {
    const valid = ["files.tree", "shell.settings", "git-history.log", "a1.b.c_d-e"];
    const invalid = ["files", ".tree", "Files.tree", "files.", "files..tree", "git--log.x", "files.tree view"];

    expect(valid.filter(t => !Resources.contributionNamePattern.test(t))).toEqual([]);
    expect(invalid.filter(t => Resources.contributionNamePattern.test(t))).toEqual([]);
  });
});
