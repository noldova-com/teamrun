/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { DockSide } from "../../../../src/app/enums/dock-side";
import { ViewRegistry } from "../../../../src/app/models/layout/view-registry";
import { ViewType } from "../../../../src/app/models/layout/view-type";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("ViewRegistry", () => {
  it("lists views in registration order and answers for views and documents", () => {
    const registry = LayoutFixture.createRegistry();

    expect(registry.views.map(t => t.name)).toEqual(["files.tree", "files.search", "git.changes", "terminal.shell"]);
    expect(registry.view("git.changes").defaultSide).toBe(DockSide.Right);
    expect([registry.hasView("files.tree"), registry.hasView("notes.note")]).toEqual([true, false]);
    expect([registry.hasDocument("notes.note"), registry.hasDocument("files.tree")]).toEqual([true, false]);
    expect(() => registry.view("gone.view")).toThrow("No view named \"gone.view\" is registered.");
  });

  it("is empty when created empty", () => {
    expect(ViewRegistry.createEmpty().views).toEqual([]);
  });

  it("rejects repeated names and invalid document names", () => {
    const tree = new ViewType("files.tree", DockSide.Left, true);

    expect(() => new ViewRegistry([tree, new ViewType("files.tree", DockSide.Right, false)], [])).toThrow(ArgumentException);
    expect(() => new ViewRegistry([], ["notes.note", "notes.note"])).toThrow(ArgumentException);
    expect(() => new ViewRegistry([], ["note"])).toThrow(ArgumentException);
  });
});
