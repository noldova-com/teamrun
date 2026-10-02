/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { DocumentTab } from "../../../../src/app/models/layout/document-tab";
import { ViewTab } from "../../../../src/app/models/layout/view-tab";

describe("Tab", () => {
  it("requires a contribution name and an instance that is not blank", () => {
    expect(() => new ViewTab("files")).toThrow(ArgumentException);
    expect(() => new DocumentTab("Notes.note")).toThrow(ArgumentException);
    expect(() => new ViewTab("terminal.shell", "")).toThrow(ArgumentException);
    expect(() => new DocumentTab("notes.note", "  ")).toThrow(ArgumentException);
  });

  it("keys a tab by its kind, name and instance", () => {
    expect(new ViewTab("files.tree").key).toBe("view/files.tree");
    expect(new ViewTab("terminal.shell", "1").key).toBe("view/terminal.shell/1");
    expect(new DocumentTab("notes.note", "plan").key).toBe("document/notes.note/plan");
    expect(new ViewTab("terminal.shell").instance).toBeUndefined();
    expect(new ViewTab("terminal.shell", "1").instance).toBe("1");
  });

  it("equals another tab with the same key only", () => {
    expect(new ViewTab("terminal.shell", "1").equals(new ViewTab("terminal.shell", "1"))).toBe(true);
    expect(new ViewTab("terminal.shell", "1").equals(new ViewTab("terminal.shell", "2"))).toBe(false);
    expect(new ViewTab("notes.note").equals(new DocumentTab("notes.note"))).toBe(false);
    expect(new ViewTab("files.tree").equals(null)).toBe(false);
  });
});
