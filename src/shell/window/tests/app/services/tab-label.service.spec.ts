/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

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

  it("falls back to the instance or the name with a generic icon", () => {
    const labels = TestBed.inject(TabLabelService);

    expect(labels.of(LayoutFixture.changes)).toEqual(new TabLabel("git.changes", Resources.viewGlyph));
    expect(labels.of(LayoutFixture.plan)).toEqual(new TabLabel("plan", Resources.documentGlyph));
  });
});
