/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { TabLabel } from "../../../src/app/models/layout/tab-label";
import { TabLabelService } from "../../../src/app/services/tab-label.service";
import { Resources } from "../../../src/resources";
import { LayoutFixture } from "../../fixtures/layout.fixture";

describe("TabLabelService", () => {
  it("names a tab by its registered title and icon, numbering instances", () => {
    const labels = TestBed.inject(TabLabelService);
    labels.register("files.tree", new TabLabel("Files", "folder"));
    labels.register("terminal.shell", new TabLabel("Terminal", "terminal"));

    expect(labels.of(LayoutFixture.files)).toEqual(new TabLabel("Files", "folder"));
    expect(labels.of(LayoutFixture.secondTerminal)).toEqual(new TabLabel("Terminal 2", "terminal"));
  });

  it("names a tab by its own title before its registered label", () => {
    const labels = TestBed.inject(TabLabelService);
    labels.register("notes.note", new TabLabel("Note", "note"));
    labels.setTitle(LayoutFixture.plan, "Plan for Monday");
    labels.setTitle(LayoutFixture.files, "Project files");

    expect(labels.of(LayoutFixture.plan)).toEqual(new TabLabel("Plan for Monday", "note"));
    expect(labels.of(LayoutFixture.files)).toEqual(new TabLabel("Project files", Resources.viewGlyph));
    expect(labels.of(LayoutFixture.todo)).toEqual(new TabLabel("Note todo", "note"));
    labels.setTitle(LayoutFixture.todo, "Todo");
    expect(labels.of(new DocumentTab("shell.settings", "x"))).toEqual(new TabLabel("x", Resources.documentGlyph));
    expect(labels.of(LayoutFixture.todo).title).toBe("Todo");
    labels.setTitle(LayoutFixture.settings, "Settings");
    expect(labels.of(LayoutFixture.settings)).toEqual(new TabLabel("Settings", Resources.documentGlyph));
  });

  it("falls back to the instance or the name with a generic icon", () => {
    const labels = TestBed.inject(TabLabelService);

    expect(labels.of(LayoutFixture.changes)).toEqual(new TabLabel("git.changes", Resources.viewGlyph));
    expect(labels.of(LayoutFixture.plan)).toEqual(new TabLabel("plan", Resources.documentGlyph));
  });
});
